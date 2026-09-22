import fs from 'node:fs/promises';
import path from 'node:path';
import { compile } from './compiler.mjs';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

// Compile without the service IPC pipe used by the framework development tools.
await fs.mkdir('dist/client/assets',{recursive:true});
await fs.mkdir('dist/server',{recursive:true});
await fs.mkdir('dist/.openai',{recursive:true});
const common=['--bundle','--format=esm','--target=es2022','--minify','--tsconfig=tsconfig.json'];
compile(['app/client.tsx',...common,'--outfile=dist/client/assets/app.js','--platform=browser','--define:process.env.NODE_ENV="production"']);
compile(['worker/app.ts',...common,'--outfile=dist/server/index.js','--platform=neutral','--external:cloudflare:workers','--loader:.html=text']);
const styles=await postcss([tailwind({base:process.cwd()})]).process('@import "./app/globals.css";\n@import "./app/branchroom.css";',{from:path.resolve('entry.css')});
await fs.writeFile('dist/client/assets/app.css',styles.css.replaceAll('./node_modules/katex/dist/fonts/','./fonts/'));
await fs.cp('node_modules/katex/dist/fonts','dist/client/assets/fonts',{recursive:true});
await fs.cp('public','dist/client',{recursive:true});
await fs.copyFile('app/index.html','dist/client/index.html');
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');
await fs.cp('drizzle','dist/.openai/drizzle',{recursive:true});
await fs.writeFile('dist/server/wrangler.json',JSON.stringify({name:'branchroom',main:'index.js',compatibility_date:'2026-09-01',assets:{directory:'../client',binding:'ASSETS',run_worker_first:true},d1_databases:[{binding:'DB',database_name:'branchroom',database_id:'local'}]},null,2));
console.log('Branchroom client, Worker, styles, and migrations are ready.');
