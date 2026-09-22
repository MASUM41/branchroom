import fs from 'node:fs/promises';
import ts from 'typescript';
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from 'drizzle-kit/api';
try{await fs.access('drizzle/0000_learning_workspaces.sql');throw new Error('The initial migration already exists. Add a new Drizzle migration instead of rewriting applied history.');}catch(error){if(error.code!=='ENOENT')throw error;}
const source=await fs.readFile('db/schema.ts','utf8');
await fs.mkdir('.sites-runtime',{recursive:true});
await fs.writeFile('.sites-runtime/schema.mjs',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
const schema=await import('../.sites-runtime/schema.mjs');
const old=await generateSQLiteDrizzleJson({});const current=await generateSQLiteDrizzleJson(schema,old.id);
const sql=await generateSQLiteMigration(old,current);
await fs.mkdir('drizzle/meta',{recursive:true});
await fs.writeFile('drizzle/0000_learning_workspaces.sql',sql.join('\n--> statement-breakpoint\n')+'\n');
await fs.writeFile('drizzle/meta/0000_snapshot.json',JSON.stringify(current,null,2));
await fs.writeFile('drizzle/meta/_journal.json',JSON.stringify({version:'7',dialect:'sqlite',entries:[{idx:0,version:'6',when:Date.now(),tag:'0000_learning_workspaces',breakpoints:true}]},null,2));
console.log(sql.join('\n'));
