import { env } from 'cloudflare:workers';
import { requestUser } from '@/lib/request-user';
import { z } from 'zod';
import { MODAL_BASE_URL } from '@/lib/provider-config';
const schema=z.object({action:z.enum(['models','chat']),key:z.string().max(1000).optional(),region:z.enum(['modal','global','china']).default('modal'),model:z.string().max(150).optional(),messages:z.array(z.object({role:z.enum(['user','assistant','system']),content:z.string().max(100000)})).max(40).optional()});
export async function GET(req:Request){const user=requestUser(req);if(!user)return Response.json({configured:false});const runtime=env as unknown as Record<string,string>;return Response.json({configured:!!runtime.MODAL_MODEL,model:runtime.MODAL_MODEL||'',region:'modal'},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:Request){
  if(!requestUser(req))return Response.json({error:'Sign in before connecting Kimi.'},{status:401});
  if(req.headers.get('origin') && req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid origin'},{status:403});
  try{
    const raw=await req.text();if(raw.length>180000)return Response.json({error:'This conversation is too long. Start a focused branch.'},{status:413});
    const result=schema.safeParse(JSON.parse(raw));if(!result.success)return Response.json({error:'Invalid request.'},{status:400});
    const input=result.data;const runtime=env as unknown as Record<string,string>;
    const modal=input.region==='modal';
    // A Moonshot key must never be automatically reused for the Modal deployment.
    const key=input.key?.trim()||(modal?runtime.MODAL_API_KEY:runtime.KIMI_API_KEY);
    if(!key)return Response.json({error:modal?'Enter your Modal proxy token in Settings as TOKEN_ID.TOKEN_SECRET.':'Connect your Kimi API in Settings first.'},{status:400});
    const base=modal?MODAL_BASE_URL:input.region==='china'?'https://api.moonshot.cn/v1':'https://api.moonshot.ai/v1';const model=input.model?.trim()||(modal?runtime.MODAL_MODEL:runtime.KIMI_MODEL);
    if(input.action==='chat' && (!model || !input.messages?.length))return Response.json({error:'Choose your model in Settings.'},{status:400});
    const upstream=await fetch(base+(input.action==='models'?'/models':'/chat/completions'),{method:input.action==='models'?'GET':'POST',headers:{...(key?{Authorization:`Bearer ${key}`} : {}),'Content-Type':'application/json'},redirect:'error',body:input.action==='chat'?JSON.stringify({model,messages:input.messages,stream:true,max_tokens:1400}):undefined,signal:AbortSignal.any([req.signal,AbortSignal.timeout(180000)])});
    if(!upstream.ok){const errors:Record<number,string>={401:modal?'Modal requires a valid proxy token. In Settings, enter the Token ID and Token Secret joined with a period.':'Kimi did not accept this API key. Check the key and region.',403:modal?'The Modal deployment denied access. Check its authentication settings.':'This key cannot access that model.',429:'The server has reached a usage or rate limit. Try again shortly.'};if(modal&&input.action==='models'&&(upstream.status===404||upstream.status===405))return Response.json({error:'This deployment does not expose /v1/models. Enter the exact model name configured by your server manually.'},{status:400});return Response.json({error:errors[upstream.status]||`The model server could not complete the request (${upstream.status}). Check the model and try again.`},{status:upstream.status>=500?502:upstream.status});}
    if(input.action==='models'){const data=await upstream.json() as {data?:{id:string}[]};return Response.json({models:data.data?.map(m=>m.id)??[]});}
    if(!upstream.body)throw new Error('No stream');return new Response(upstream.body,{headers:{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','X-Content-Type-Options':'nosniff'}});
  }catch{return Response.json({error:'The connection to Kimi was interrupted. Please retry.'},{status:502});}
}


