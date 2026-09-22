import { requestUser } from '@/lib/request-user';
import { database } from '@/lib/database';
import { z } from 'zod';
const message=z.object({id:z.string().max(100),role:z.enum(['user','assistant']),content:z.string().max(100000),status:z.enum(['complete','interrupted','error']).optional(),demo:z.boolean().optional()});
const branch=z.object({id:z.string().max(100),parentId:z.string().max(100).nullable(),sourceMessageId:z.string().max(100).optional(),quote:z.string().max(10000).optional(),sourceSnapshot:z.string().max(100000).optional(),title:z.string().min(1).max(200),messages:z.array(message).max(500),understood:z.boolean(),createdAt:z.number()});
const schema=z.object({revision:z.number().int().min(0),state:z.object({branches:z.array(branch).min(1).max(1000)})});
export async function GET(req:Request) {
  const user=requestUser(req);if(!user)return Response.json({error:'Sign in to save your learning trees.'},{status:401});
  try {const row=await database().prepare('SELECT state, revision FROM learning_workspaces WHERE user_id = ?').bind(user.userId).first<{state:string;revision:number}>();return Response.json({state:row?JSON.parse(row.state):null,revision:row?.revision??0},{headers:{'Cache-Control':'no-store'}});} catch {return Response.json({error:'Your trees could not be loaded. Please retry.'},{status:503});}
}
export async function PUT(req:Request) {
  const user=requestUser(req);if(!user)return Response.json({error:'Sign in to save your learning trees.'},{status:401});
  if(req.headers.get('origin') && req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid origin'},{status:403});
  try {
    const raw=await req.text();if(raw.length>4000000)return Response.json({error:'This workspace is too large to save. Export a backup.'},{status:413});
    const parsed=schema.safeParse(JSON.parse(raw));if(!parsed.success)return Response.json({error:'The learning tree has an invalid shape.'},{status:400});
    const {state,revision}=parsed.data; const ids=new Set(state.branches.map(b=>b.id));
    if(ids.size!==state.branches.length || state.branches.some(b=>b.parentId && !ids.has(b.parentId)))return Response.json({error:'Invalid branch links.'},{status:400});
    for(const b of state.branches){let p=b;const seen=new Set<string>();while(p.parentId){if(seen.has(p.id))return Response.json({error:'A tree cannot contain a cycle.'},{status:400});seen.add(p.id);p=state.branches.find(n=>n.id===p.parentId)!;}}
    const db=database();
    const result=revision===0?await db.prepare('INSERT INTO learning_workspaces (user_id, state, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO NOTHING').bind(user.userId,JSON.stringify(state),Date.now()).run():await db.prepare('UPDATE learning_workspaces SET state = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?').bind(JSON.stringify(state),Date.now(),user.userId,revision).run();
    if(!result.meta.changes)return Response.json({error:'This tree was changed in another tab. Export your work, then reload to avoid overwriting it.'},{status:409});
    return Response.json({revision:revision+1});
  }catch{return Response.json({error:'Your changes are still open here, but could not be saved. Retry saving.'},{status:503});}
}

