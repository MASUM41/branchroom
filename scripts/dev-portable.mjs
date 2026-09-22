import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { Readable } from 'node:stream';
import { compile } from './compiler.mjs';
await fs.mkdir('.sites-runtime',{recursive:true});
compile(['worker/app.ts','--outfile=.sites-runtime/local-worker.mjs','--bundle','--format=esm','--platform=node','--target=es2022','--loader:.html=text','--alias:cloudflare:workers=./scripts/local-env.ts']);
const db=new DatabaseSync('.sites-runtime/learning.sqlite');
db.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
for(const file of (await fs.readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())if(!db.prepare('SELECT name FROM local_migrations WHERE name = ?').get(file)){db.exec(await fs.readFile(path.join('drizzle',file),'utf8'));db.prepare('INSERT INTO local_migrations (name) VALUES (?)').run(file);}
const d1={prepare(sql){let values=[];return {bind(...v){values=v;return this;},async first(){return db.prepare(sql).get(...values)||null;},async run(){const result=db.prepare(sql).run(...values);return {success:true,meta:{changes:Number(result.changes)}};}}}};
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'};
const assetRoot=path.resolve('dist/client');
globalThis.__branchroomLocalEnv={DB:d1,KIMI_API_KEY:process.env.KIMI_API_KEY||'',KIMI_MODEL:process.env.KIMI_MODEL||'',MODAL_API_KEY:process.env.MODAL_API_KEY||'',MODAL_MODEL:process.env.MODAL_MODEL||''};
const worker=(await import('../.sites-runtime/local-worker.mjs')).default;
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1:5173');
    // The local preview is bound to loopback and has one local-only identity.
    if(!['127.0.0.1:5173','localhost:5173'].includes(req.headers.host||'')){res.writeHead(403).end();return;}
    const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v&&!k.startsWith('oai-authenticated-'))headers.set(k,Array.isArray(v)?v.join(', '):v);
    headers.set('oai-authenticated-user-id','local_preview');headers.set('oai-authenticated-user-email','local@branchroom.test');
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
    const request=new Request(url,{method:req.method,headers,...(body.length?{body}:{}),duplex:'half'});
    const response=await worker.fetch(request,{ASSETS:{async fetch(request){const relative=decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '');const filename=path.resolve(assetRoot,relative);if(!filename.startsWith(assetRoot+path.sep))return new Response('Not found',{status:404});try{return new Response(await fs.readFile(filename),{headers:{'Content-Type':types[path.extname(filename)]||'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}}}});
    res.writeHead(response.status,Object.fromEntries(response.headers));if(response.body)Readable.fromWeb(response.body).pipe(res);else res.end();
  }catch(error){console.error(error.message);res.writeHead(500).end('The preview could not serve this request.');}
});
server.listen(5173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:5173/'));
