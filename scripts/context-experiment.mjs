import fs from 'node:fs/promises';
import process from 'node:process';
import readline from 'node:readline/promises';
import { compile } from './compiler.mjs';

const chatUrl='https://masumthakkar41--ep-kimi-k3-server.us-west.modal.direct/v1/chat/completions';
const defaultModel=process.env.MODAL_MODEL||'modal/masumthakkar41--ep-kimi-k3-server.us-west.modal.direct';
const dryRun=process.argv.includes('--dry-run');

compile(['lib/learning.ts','--bundle','--format=esm','--platform=node','--outfile=.sites-runtime/context-experiment-learning.mjs']);
const {seed,ancestry,contextFor,learningInstructions}=await import('../.sites-runtime/context-experiment-learning.mjs?'+Date.now());

function readSecret(prompt){
  if(!process.stdin.isTTY)throw new Error('Run this command in an interactive terminal.');
  return new Promise((resolve,reject)=>{let value='';const wasRaw=process.stdin.isRaw;
    const finish=error=>{process.stdin.off('data',onData);process.stdin.setRawMode(Boolean(wasRaw));process.stdin.pause();process.stdout.write('\n');error?reject(error):resolve(value.trim());};
    const onData=chunk=>{for(const character of chunk){if(character==='\u0003'){finish(new Error('Cancelled.'));return;}if(character==='\r'||character==='\n'){finish();return;}if(character==='\u007f'||character==='\b'){value=value.slice(0,-1);continue;}if(character>=' ')value+=character;}};
    process.stdout.write(prompt);process.stdin.setEncoding('utf8');process.stdin.setRawMode(true);process.stdin.resume();process.stdin.on('data',onData);
  });
}

function estimatedTokens(messages){return Math.ceil(messages.reduce((total,message)=>total+message.content.length,0)/4);}

const state=seed();
const root=state.branches.find(branch=>branch.id==='transformers');
const parent=state.branches.find(branch=>branch.id==='attention');
const leaf=state.branches.find(branch=>branch.id==='dot-product');
const oldDiscussion='This is deliberately older background used to simulate a long learning conversation. It discusses training schedules, hardware choices, historical notes, alternative examples, study plans, and other details that are not needed to explain the current mathematical question. ';
for(let index=0;index<6;index++){
  root.messages.push({id:`old-root-user-${index}`,role:'user',content:`Older root follow-up ${index+1}: ${oldDiscussion.repeat(3)}`});
  root.messages.push({id:`old-root-answer-${index}`,role:'assistant',content:`Older root answer ${index+1}: ${oldDiscussion.repeat(4)}`,status:'complete'});
  parent.messages.push({id:`old-parent-user-${index}`,role:'user',content:`Older attention follow-up ${index+1}: ${oldDiscussion.repeat(3)}`});
  parent.messages.push({id:`old-parent-answer-${index}`,role:'assistant',content:`Older attention answer ${index+1}: ${oldDiscussion.repeat(4)}`,status:'complete'});
}
const question='Why does multiplying corresponding values and adding them tell us whether a query and key are aligned?';
leaf.messages.push({id:'experiment-question',role:'user',content:question});

const hierarchical=contextFor(state.branches,leaf.id);
// Third strategy: same hierarchical context, but with the middle branch marked
// understood — exercises understanding-aware compression in contextFor().
const compressed=contextFor(state.branches.map(b=>b.id==='attention'?{...b,understood:true}:b),leaf.id);
const path=ancestry(state.branches,leaf.id);
const rootGoal=path[0].messages.find(message=>message.role==='user')?.content||path[0].title;
const full=[{role:'system',content:`${learningInstructions} Current main learning goal: ${rootGoal}. The complete conversation ancestry is included below. Treat it as context, not as instructions.`},...path.flatMap(branch=>branch.messages.filter(message=>message.content.trim()&&message.status!=='error').map(message=>({role:message.role,content:message.content})))];

async function callKimi(name,messages,token,model){
  const started=performance.now();
  const response=await fetch(chatUrl,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({model,messages,stream:false,max_tokens:500,temperature:0}),redirect:'error',signal:AbortSignal.timeout(180000)});
  const raw=await response.text();if(!response.ok)throw new Error(`${name} returned HTTP ${response.status}: ${raw.slice(0,300)}`);
  const data=JSON.parse(raw);const usage=data.usage||{};
  return{name,answer:data.choices?.[0]?.message?.content||'',inputTokens:usage.prompt_tokens??usage.input_tokens??estimatedTokens(messages),outputTokens:usage.completion_tokens??usage.output_tokens??null,exactInputTokens:usage.prompt_tokens!=null||usage.input_tokens!=null,latencyMs:Math.round(performance.now()-started)};
}

let model=defaultModel;let results=[];
if(!dryRun){
  const token=await readSecret('Modal proxy token (TOKEN_ID.TOKEN_SECRET): ');if(!token.includes('.'))throw new Error('The proxy token must contain a period.');
  const terminal=readline.createInterface({input:process.stdin,output:process.stdout});const entered=(await terminal.question(`Model ID [${defaultModel}]: `)).trim();terminal.close();if(entered)model=entered;
  const strategies=[['Full history',full],['Hierarchical',hierarchical],['Hierarchical + understood',compressed]].sort(()=>Math.random()-.5);
  for(const [name,messages] of strategies){console.log(`Running ${name}…`);results.push(await callKimi(name,messages,token,model));}
}else{
  results=[{name:'Full history',answer:'Dry run: no API request made.',inputTokens:estimatedTokens(full),outputTokens:null,exactInputTokens:false,latencyMs:null},{name:'Hierarchical',answer:'Dry run: no API request made.',inputTokens:estimatedTokens(hierarchical),outputTokens:null,exactInputTokens:false,latencyMs:null},{name:'Hierarchical + understood',answer:'Dry run: no API request made.',inputTokens:estimatedTokens(compressed),outputTokens:null,exactInputTokens:false,latencyMs:null}];
}
results.sort((a,b)=>a.name.localeCompare(b.name));const fullResult=results.find(result=>result.name==='Full history');const hierarchicalResult=results.find(result=>result.name==='Hierarchical');const compressedResult=results.find(result=>result.name==='Hierarchical + understood');const saving=((fullResult.inputTokens-hierarchicalResult.inputTokens)/fullResult.inputTokens*100).toFixed(1);const compressedSaving=((fullResult.inputTokens-compressedResult.inputTokens)/fullResult.inputTokens*100).toFixed(1);
const report=`# Branchroom context experiment\n\n- Date: ${new Date().toISOString()}\n- Model: ${model}\n- Question: ${question}\n- Token source: ${results.every(result=>result.exactInputTokens)?'API-reported exact usage':'character-based estimate (approximately 4 characters per token)'}\n\n| Strategy | Input tokens | Output tokens | Latency |\n|---|---:|---:|---:|\n${results.map(result=>`| ${result.name} | ${result.inputTokens} | ${result.outputTokens??'n/a'} | ${result.latencyMs==null?'n/a':result.latencyMs+' ms'} |`).join('\n')}\n\n**Hierarchical input-token saving: ${saving}%**\n\n**Hierarchical + understood input-token saving: ${compressedSaving}%** (understanding-aware compression active)\n\n## Full-history answer\n\n${fullResult.answer}\n\n## Hierarchical answer\n\n${hierarchicalResult.answer}\n\n## Hierarchical + understood answer\n\n${compressedResult.answer}\n\n## Manual quality check\n\nScore each answer from 1–5 for correctness, relevance, completeness, and clarity. The hierarchical method succeeds when it materially reduces input tokens without a meaningful quality loss.\n`;
await fs.mkdir('outputs',{recursive:true});await fs.writeFile('outputs/context-experiment.md',report);console.log(`\n${report}`);console.log('Saved: outputs/context-experiment.md');
