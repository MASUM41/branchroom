'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowLeft, BookOpen, Check, CheckCheck, ChevronDown, ChevronUp, ChevronRight, Copy, Download, GitBranch, Leaf, LoaderCircle, Menu, MoreHorizontal, Plus, Search, Settings, Square, Trash2, X, Pencil, CornerDownRight, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Sparkles, Moon, Sun, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ancestry, contextFor, demoAnswer, id, seed, type Branch, type LearningState, type Message } from '@/lib/learning';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { MODAL_CHAT_URL, type ProviderRegion } from '@/lib/provider-config';

type Selection = { branchId:string; messageId:string; text:string; snapshot:string; x:number; y:number };
type Connection = { key:string; model:string; region:ProviderRegion; connected:boolean };
type ApiData = {state:LearningState|null;revision:number;error?:string;models:string[];configured?:boolean;model?:string};
const initialConnection:Connection={key:'',model:'',region:'modal',connected:false};
type Theme='light'|'dark';

function preferredTheme():Theme{
  try{const saved=localStorage.getItem('branchroom-theme');if(saved==='light'||saved==='dark')return saved;return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}catch{return 'light';}
}

function exportState(state:LearningState) {
  const blob=new Blob([JSON.stringify({format:'branchroom-v1',exportedAt:new Date().toISOString(),...state},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`branchroom-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function Workspace(){
  const [state,setState]=useState<LearningState>(seed);const latest=useRef(state);latest.current=state;
  const [activeId,setActiveId]=useState('attention');const [loaded,setLoaded]=useState(false);const [authenticated,setAuthenticated]=useState(false);
  const [saveStatus,setSaveStatus]=useState('Loading your trees…');const [saveError,setSaveError]=useState('');const [loadError,setLoadError]=useState('');
  const revision=useRef(0),persisted=useRef(''),saving=useRef(false),saveBlocked=useRef(false);
  const [connection,setConnection]=useState<Connection>(initialConnection);const [settings,setSettings]=useState(false);
  const [busy,setBusy]=useState<string|null>(null);const abort=useRef<AbortController|null>(null);
  const [selection,setSelection]=useState<Selection|null>(null);const [branchDialog,setBranchDialog]=useState<Selection|null>(null);const [branchQuestion,setBranchQuestion]=useState('');
  const [toast,setToast]=useState('');const [mobileTree,setMobileTree]=useState(false);const [sidebarCollapsed,setSidebarCollapsed]=useState(()=>{try{return localStorage.getItem('branchroom-sidebar-collapsed')==='true';}catch{return false;}});const [topBarCollapsed,setTopBarCollapsed]=useState(()=>{try{return localStorage.getItem('branchroom-topbar-collapsed')==='true';}catch{return false;}});const [branchFocus,setBranchFocus]=useState(false);const [branchPanelCollapsed,setBranchPanelCollapsed]=useState(false);const [theme,setTheme]=useState<Theme>(preferredTheme);const [query,setQuery]=useState('');const [collapsed,setCollapsed]=useState<string[]>([]);
  const [editing,setEditing]=useState<Branch|null>(null);const [editTitle,setEditTitle]=useState('');const [deleteDialog,setDeleteDialog]=useState<Branch|null>(null);
  const [drafts,setDrafts]=useState<Record<string,string>>({});const scrollPositions=useRef<Record<string,number>>({});
  const active=state.branches.find(b=>b.id===activeId)||state.branches[0];const path=ancestry(state.branches,active.id);const root=path[0];
  const notify=(text:string)=>setToast(text);
  useEffect(()=>{if(toast){const timer=setTimeout(()=>setToast(''),4200);return()=>clearTimeout(timer);}},[toast]);
  useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('branchroom-theme',theme);}catch{}const meta=document.querySelector('meta[name="theme-color"]');meta?.setAttribute('content',theme==='dark'?'#101713':'#26794d');},[theme]);
  useEffect(()=>{try{localStorage.setItem('branchroom-sidebar-collapsed',String(sidebarCollapsed));}catch{}},[sidebarCollapsed]);
  useEffect(()=>{try{localStorage.setItem('branchroom-topbar-collapsed',String(topBarCollapsed));}catch{}},[topBarCollapsed]);

  const load=useCallback(async()=>{
    setLoadError('');
    try{const res=await fetch('/api/workspace');const data=await res.json() as ApiData;
      if(res.status===401){setAuthenticated(false);setLoaded(true);setSaveStatus('Demo · not saved');return;}
      if(!res.ok)throw new Error(data.error);setAuthenticated(true);revision.current=data.revision;
      if(data.state){setState(data.state);latest.current=data.state;persisted.current=JSON.stringify(data.state);const previous=localStorage.getItem('branchroom-active');setActiveId(data.state.branches.find((b:Branch)=>b.id===previous)?.id||data.state.branches[0].id);}
      setLoaded(true);setSaveStatus(data.state?'All changes saved':'Preparing your tree…');
    }catch(error){setLoadError(error instanceof Error?error.message:'Your trees could not be loaded.');setSaveStatus('Could not load');}
  },[]);
  useEffect(()=>{void load();try{setDrafts(JSON.parse(localStorage.getItem('branchroom-drafts')||'{}'));const model=localStorage.getItem('branchroom-model-modal')||'';setConnection(c=>({...c,model}));}catch{}
    void fetch('/api/provider').then(async r=>await r.json() as ApiData).then(d=>{if(d.configured)setConnection(c=>({...c,connected:true,model:d.model||c.model}));}).catch(()=>{});
    return()=>abort.current?.abort();
  },[load]);
  const save=useCallback(async()=>{
    if(!authenticated||saving.current||saveBlocked.current)return;
    const snapshot=JSON.stringify(latest.current);if(snapshot===persisted.current)return;
    saving.current=true;setSaveStatus('Saving…');
    try{const res=await fetch('/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:JSON.parse(snapshot),revision:revision.current})});const data=await res.json() as ApiData;if(!res.ok){if(res.status===409)saveBlocked.current=true;throw new Error(data.error);}
      revision.current=data.revision;persisted.current=snapshot;setSaveError('');setSaveStatus('All changes saved');
    }catch(error){setSaveError(error instanceof Error?error.message:'Could not save.');setSaveStatus('Changes not saved');saveBlocked.current=true;}finally{saving.current=false;}
  },[authenticated]);
  useEffect(()=>{if(!loaded)return;const timer=setInterval(()=>void save(),1500);return()=>clearInterval(timer);},[loaded,save]);
  useEffect(()=>{if(authenticated&&!saving.current&&!saveBlocked.current&&JSON.stringify(state)!==persisted.current)setSaveStatus('Unsaved changes');},[state,authenticated]);
  useEffect(()=>{const leave=(e:BeforeUnloadEvent)=>{if(authenticated&&JSON.stringify(latest.current)!==persisted.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave);},[authenticated]);
  useEffect(()=>{try{localStorage.setItem('branchroom-drafts',JSON.stringify(drafts));}catch{}},[drafts]);
  const navigate=(branchId:string)=>{setActiveId(branchId);setSelection(null);setMobileTree(false);setBranchPanelCollapsed(false);if(!latest.current.branches.find(b=>b.id===branchId)?.parentId)setBranchFocus(false);try{localStorage.setItem('branchroom-active',branchId);}catch{}};
  const updateBranch=(branchId:string,fn:(b:Branch)=>Branch)=>setState(s=>({branches:s.branches.map(b=>b.id===branchId?fn(b):b)}));

  async function generate(branchId:string,question:string,provided?:LearningState,retryMessageId?:string){
    if(abort.current)return; const controller=new AbortController();abort.current=controller;setBusy(branchId);setSelection(null);
    let next=provided||latest.current;const answerId=id();
    next={branches:next.branches.map(b=>b.id===branchId?{...b,messages:retryMessageId?b.messages.filter(m=>m.id!==retryMessageId):[...b.messages,{id:id(),role:'user',content:question,demo:!connection.connected}]}:b)};
    const context=contextFor(next.branches,branchId);const branch=next.branches.find(b=>b.id===branchId)!;
    next={branches:next.branches.map(b=>b.id===branchId?{...b,messages:[...b.messages,{id:answerId,role:'assistant',content:'',status:'interrupted',demo:!connection.connected}]}:b)};
    setState(next);latest.current=next;setDrafts(d=>({...d,[branchId]:''}));
    let content='';let done=false;
    const append=(text:string)=>{content+=text;updateBranch(branchId,b=>({...b,messages:b.messages.map(m=>m.id===answerId?{...m,content}:m)}));};
    try{
      if(!connection.connected){const answer=demoAnswer(question,branch.quote);for(const chunk of answer.match(/.{1,30}(?:\s|$)|.{1,30}/gs)||[]){if(controller.signal.aborted)throw new DOMException('Stopped','AbortError');append(chunk);await new Promise(r=>setTimeout(r,22));}done=true;}
      else{
        const response=await fetch('/api/provider',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'chat',key:connection.key,model:connection.model,region:connection.region,messages:context}),signal:controller.signal});
        if(!response.ok){const data=await response.json() as ApiData;throw new Error(data.error||'Kimi could not answer.');}
        const reader=response.body!.getReader();const decoder=new TextDecoder();let buffer='';
        while(true){const result=await reader.read();buffer+=decoder.decode(result.value,{stream:!result.done});const lines=buffer.split('\n');buffer=lines.pop()||'';
          for(const line of lines){if(!line.startsWith('data:'))continue;const value=line.slice(5).trim();if(value==='[DONE]'){done=true;continue;}if(!value)continue;const event=JSON.parse(value);if(event.error)throw new Error('Kimi interrupted the answer. Please retry.');const delta=event.choices?.[0]?.delta?.content;if(delta)append(delta);if(event.choices?.[0]?.finish_reason==='length')throw new Error('The answer reached its length limit. Ask “continue” to keep going.');}
          if(result.done)break;
        }
        if(!done)throw new Error('The response ended early. Retry to get a complete answer.');
      }
      updateBranch(branchId,b=>({...b,messages:b.messages.map(m=>m.id===answerId?{...m,status:'complete'}:m)}));
    }catch(error){const stopped=controller.signal.aborted;const message=stopped?'Answer stopped.':error instanceof Error?error.message:'The response was interrupted.';
      updateBranch(branchId,b=>({...b,messages:b.messages.map(m=>m.id===answerId?{...m,content:content||message,status:content?'interrupted':'error'}:m)}));notify(message);
    }finally{abort.current=null;setBusy(null);}
  }

  function createBranch(source:Selection,question?:string){
    if(busy){notify('Wait for the current answer, or stop it first.');return;}
    const quote=source.text.trim();if(!quote)return;
    const child:Branch={id:id(),parentId:source.branchId,sourceMessageId:source.messageId,quote,sourceSnapshot:source.snapshot,title:quote.slice(0,65),messages:[],understood:false,createdAt:Date.now()};
    const next={branches:[...latest.current.branches,child]};setState(next);navigate(child.id);setBranchDialog(null);setBranchQuestion('');setCollapsed(c=>c.filter(x=>x!==source.branchId));window.getSelection()?.removeAllRanges();
    void generate(child.id,question?.trim()||`Explain “${quote}” in this context.`,next);
  }
  function newTree(){if(!loaded)return;const b:Branch={id:id(),parentId:null,title:'New learning tree',messages:[],understood:false,createdAt:Date.now()};setState(s=>({branches:[...s.branches,b]}));navigate(b.id);}
  function send(branchId:string,text:string){if(!text.trim()||busy)return;const b=state.branches.find(b=>b.id===branchId)!;let next=state;if(!b.messages.length&&!b.parentId){next={branches:state.branches.map(n=>n.id===branchId?{...n,title:text.trim().slice(0,65)}:n)};}void generate(branchId,text.trim(),next);}
  function deleteBranch(){if(!deleteDialog||busy)return;const remove=new Set(state.branches.filter(b=>ancestry(state.branches,b.id).some(p=>p.id===deleteDialog.id)).map(b=>b.id));let branches=state.branches.filter(b=>!remove.has(b.id));if(!branches.length)branches=[{id:id(),parentId:null,title:'New learning tree',messages:[],understood:false,createdAt:Date.now()}];setState({branches});if(remove.has(activeId))navigate(deleteDialog.parentId||branches[0].id);setDeleteDialog(null);}
  function captureSelection(branchId:string,message:Message){const selection=window.getSelection();const text=selection?.toString().trim();if(!text||text.length>10000||!selection?.rangeCount){setSelection(null);return;}const element=document.getElementById(`message-${message.id}`);const range=selection.getRangeAt(0);if(!element?.contains(range.commonAncestorContainer))return;const rect=range.getBoundingClientRect();setSelection({branchId,messageId:message.id,text,snapshot:message.content,x:Math.max(100,Math.min(window.innerWidth-130,rect.left+rect.width/2)),y:Math.max(56,rect.top-48)});}
  function sourceJump(branch:Branch){if(!branch.parentId)return;navigate(branch.parentId);setTimeout(()=>document.getElementById(`message-${branch.sourceMessageId}`)?.scrollIntoView({behavior:'smooth',block:'center'}),80);}

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){setSelection(null);setMobileTree(false);}if((event.ctrlKey||event.metaKey)&&event.key==='['){event.preventDefault();const current=latest.current.branches.find(b=>b.id===activeId);if(current?.parentId)navigate(current.parentId);}};
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[activeId]);
  useEffect(()=>{
    const context=(document as Document & {modelContext?:{registerTool:(tool:unknown,options:unknown)=>void}}).modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();
    try{context.registerTool({name:'read_learning_tree',description:'Read the saved learning branch structure and current selection.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({activeId,branches:latest.current.branches.map(({id,parentId,title,understood})=>({id,parentId,title,understood}))})},{signal:lifecycle.signal});
    context.registerTool({name:'navigate_learning_branch',description:'Open an existing learning branch in the reading panel.',inputSchema:{type:'object',properties:{branchId:{type:'string'}},required:['branchId'],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input:unknown)=>{const branchId=(input as {branchId?:string})?.branchId;if(typeof branchId!=='string'||!latest.current.branches.some(b=>b.id===branchId))throw new Error('Unknown branch');navigate(branchId);return{activeId:branchId};}},{signal:lifecycle.signal});}catch{}return()=>lifecycle.abort();
  },[activeId]);

  function treeNode(branch:Branch,depth=0):React.ReactNode{
    const children=state.branches.filter(b=>b.parentId===branch.id);const expanded=!collapsed.includes(branch.id)||!!query;
    const matches=!query||[branch,...state.branches.filter(b=>ancestry(state.branches,b.id).some(p=>p.id===branch.id))].some(b=>(b.title+' '+b.messages.map(m=>m.content).join(' ')).toLowerCase().includes(query.toLowerCase()));if(!matches)return null;
    return <div className="tree-node" key={branch.id}><div className={`tree-row ${active.id===branch.id?'selected':''} ${!branch.parentId?'root-row':''}`} style={{paddingLeft:12+Math.min(depth,8)*16}}>
      <button className={`tree-toggle ${children.length?'':'invisible'}`} aria-label={`${expanded?'Collapse':'Expand'} ${branch.title}`} onClick={()=>setCollapsed(c=>c.includes(branch.id)?c.filter(x=>x!==branch.id):[...c,branch.id])}>{expanded?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</button>
      <button className="tree-label" onClick={()=>navigate(branch.id)} title={branch.title}>{branch.understood?<Check size={15} className="understood-icon"/>:branch.parentId?<GitBranch size={14}/>:<BookOpen size={16}/>}<span>{branch.title}</span></button>
      {busy===branch.id&&<LoaderCircle size={13} className="spin"/>}
    </div>{expanded&&children.map(c=>treeNode(c,depth+1))}</div>;
  }

  function pane(branch:Branch,isDetail:boolean){return <ConversationPane key={branch.id} branch={branch} detail={isDetail} childrenBranches={state.branches.filter(b=>b.parentId===branch.id)} busy={busy===branch.id} anyBusy={!!busy} enabled={loaded} draft={drafts[branch.id]||''} setDraft={value=>setDrafts(d=>({...d,[branch.id]:value}))} onSend={text=>send(branch.id,text)} onStop={()=>abort.current?.abort()} onNavigate={navigate} onSelect={m=>captureSelection(branch.id,m)} onExplore={m=>{setBranchDialog({branchId:branch.id,messageId:m.id,text:'',snapshot:m.content,x:0,y:0});setBranchQuestion('');}} onRetry={m=>{const previous=branch.messages.slice(0,branch.messages.indexOf(m)).reverse().find(m=>m.role==='user');void generate(branch.id,previous?.content||'Explain this.',undefined,m.id);}} onCopy={async m=>{try{await navigator.clipboard.writeText(m.content);notify('Copied explanation');}catch{notify('Could not copy. Select the text to copy it.');}}} connected={connection.connected} onConnect={()=>setSettings(true)} scrollPositions={scrollPositions.current} onSource={()=>sourceJump(branch)} />;}

  const childBranches=state.branches.filter(b=>b.parentId===active.id);
  return <main className={`app-shell ${sidebarCollapsed?'sidebar-collapsed':''}`}>
    {mobileTree&&<div className="sidebar-scrim" onClick={()=>setMobileTree(false)}/>}
    <aside className={`sidebar ${mobileTree?'mobile-open':''}`}>
      <div className="sidebar-brand-row"><a href="/" className="brand" aria-label="Branchroom home"><span className="brand-symbol"><GitBranch size={22}/></span><span>branchroom<span className="brand-period">.</span></span></a><button className="icon-button sidebar-close" aria-label="Close learning trees" title="Close sidebar" onClick={()=>{setSidebarCollapsed(true);setMobileTree(false);}}><PanelLeftClose size={19}/></button></div>
      <Button className="new-tree" onClick={newTree} disabled={!loaded}><Plus size={17}/>New learning tree<span className="shortcut">＋</span></Button>
      <label className="search-box"><Search size={15}/><input aria-label="Search your trees" placeholder="Find in your trees" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Clear search" onClick={()=>setQuery('')}><X size={14}/></button>}</label>
      <div className="sidebar-section"><span>YOUR LEARNING TREES</span><span>{state.branches.filter(b=>!b.parentId).length}</span></div>
      <nav className="tree-list" aria-label="Learning trees">{state.branches.filter(b=>!b.parentId).map(b=>treeNode(b))}{query&&!state.branches.some(b=>(b.title+' '+b.messages.map(m=>m.content).join(' ')).toLowerCase().includes(query.toLowerCase()))&&<p className="search-empty">No matching branches.</p>}</nav>
      <div className="sidebar-bottom"><div className="curiosity-note"><span className="little-branch"><GitBranch size={18}/></span><p>A question is a good<br/>place to grow.</p></div>
        <button className="sidebar-action" onClick={()=>setTheme(value=>value==='dark'?'light':'dark')}><span className="sidebar-action-icon">{theme==='dark'?<Sun size={17}/>:<Moon size={17}/>}</span>{theme==='dark'?'Light mode':'Dark mode'}</button><button className="sidebar-action" onClick={()=>exportState(state)}><Download size={17}/>Export backup</button><button className="sidebar-action" onClick={()=>setSettings(true)}><Settings size={17}/>Settings<span className={`connection-badge ${connection.connected?'live':''}`}>{connection.connected?'Connected':'Demo'}</span></button>
        <div className="user-row"><span className="avatar"><BookOpen size={15}/></span><div><strong>My learning space</strong><span>Private to you</span></div><Leaf size={17}/></div>
      </div>
    </aside>
    <section className="workspace">
      <header className={`workspace-header compact-header ${topBarCollapsed?'topbar-collapsed':''}`}><button className="icon-button mobile-menu" aria-label="Open learning trees" onClick={()=>setMobileTree(true)}><Menu size={20}/></button><button className="icon-button desktop-sidebar-toggle" aria-label={sidebarCollapsed?'Open learning trees':'Close learning trees'} title={sidebarCollapsed?'Open sidebar':'Close sidebar'} onClick={()=>setSidebarCollapsed(value=>!value)}>{sidebarCollapsed?<PanelLeftOpen size={19}/>:<PanelLeftClose size={19}/>}</button>{!topBarCollapsed&&<div className="workspace-name"><BookOpen size={17}/><span>{root.title}</span></div>}<nav className="header-path" aria-label="Branch path"><button onClick={()=>navigate(root.id)}><span className="path-root">Main conversation</span></button>{path.slice(1).map(b=><span className="breadcrumb" key={b.id}><ChevronRight size={13}/><button onClick={()=>navigate(b.id)} title={b.title}>{b.title}</button></span>)}</nav>{!topBarCollapsed&&<span className="branch-count"><GitBranch size={14}/>{state.branches.filter(b=>ancestry(state.branches,b.id)[0]?.id===root.id).length-1} branches</span>}<div className="header-actions">{!topBarCollapsed&&<span className="save-status" title={saveStatus}>{saveStatus==='All changes saved'?<CheckCheck size={15}/>:<span className="save-dot"/>}{saveStatus}</span>}<button className="icon-button topbar-toggle" aria-label={topBarCollapsed?'Expand conversation bar':'Collapse conversation bar'} title={topBarCollapsed?'Expand conversation bar':'Collapse conversation bar'} onClick={()=>setTopBarCollapsed(value=>!value)}>{topBarCollapsed?<ChevronDown size={18}/>:<ChevronUp size={18}/>}</button></div></header>
      {loadError&&<div className="error-banner" role="alert">{loadError}<button onClick={()=>void load()}>Retry loading</button></div>}
      {loaded&&!authenticated&&<div className="notice-banner">Explore the demo. Sign in to save trees and connect your API.<a href="/signin-with-chatgpt?return_to=/" target="_top">Sign in</a></div>}
      {saveError&&<div className="error-banner" role="alert">{saveError}<button onClick={()=>{saveBlocked.current=false;void save();}}>Retry save</button><button onClick={()=>exportState(state)}>Export backup</button></div>}
      <div className={`reading-area ${active.parentId&&!branchPanelCollapsed?'has-detail':''} ${active.parentId&&branchFocus&&!branchPanelCollapsed?'branch-focus':''} ${branchPanelCollapsed?'branch-panel-collapsed':''}`}>
        <section className="main-column"><div className="pane-heading"><div><span className="eyebrow">THE BIG PICTURE</span><h1>{root.title}</h1></div><button className="icon-button" aria-label="Rename main conversation" onClick={()=>{setEditing(root);setEditTitle(root.title);}}><Pencil size={16}/></button></div>{pane(root,false)}</section>
        {active.parentId&&!branchPanelCollapsed&&<section className="detail-column"><div className="detail-topline"><span><GitBranch size={15}/>EXPLORING A BRANCH</span><div><button className="icon-button" aria-label="Collapse branch panel" title="Collapse branch panel" onClick={()=>{setBranchFocus(false);setBranchPanelCollapsed(true);}}><PanelRightClose size={17}/></button><button className="icon-button branch-focus-toggle" aria-label={branchFocus?'Show main and branch together':'Expand branch to full screen'} title={branchFocus?'Show split view':'Make this branch full screen'} onClick={()=>setBranchFocus(value=>!value)}>{branchFocus?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</button><button className="icon-button" aria-label="Rename branch" onClick={()=>{setEditing(active);setEditTitle(active.title);}}><Pencil size={15}/></button><button className="icon-button" aria-label="Delete branch" disabled={!!busy} onClick={()=>setDeleteDialog(active)}><Trash2 size={15}/></button><button className="icon-button" aria-label="Go to main conversation" onClick={()=>navigate(root.id)}><X size={18}/></button></div></div><div className="detail-heading"><button className="back-parent" onClick={()=>navigate(active.parentId!)}><ArrowLeft size={14}/>Back to {active.parentId===root.id?'main conversation':'parent explanation'}</button><h2>{active.title}</h2><button className={`understood-button ${active.understood?'checked':''}`} aria-pressed={active.understood} onClick={()=>updateBranch(active.id,b=>({...b,understood:!b.understood}))}><Check size={14}/>{active.understood?'Understood':'Mark understood'}</button><nav className="branch-route-actions" aria-label="Conversation navigation"><button onClick={()=>navigate(root.id)}><BookOpen size={14}/>Main conversation</button>{active.parentId!==root.id&&<button onClick={()=>navigate(active.parentId!)}><ArrowLeft size={14}/>Parent</button>}{childBranches.map(child=><button key={child.id} onClick={()=>navigate(child.id)} title={child.title}><CornerDownRight size={14}/><span>{child.title}</span></button>)}</nav></div>{pane(active,true)}</section>}
        {active.parentId&&branchPanelCollapsed&&<aside className="branch-collapsed-rail" aria-label="Collapsed branch panel"><button aria-label={`Open branch ${active.title}`} title={`Open “${active.title}”`} onClick={()=>setBranchPanelCollapsed(false)}><PanelRightOpen size={19}/><span>Open branch</span></button></aside>}
      </div>
    </section>
    {selection&&<div className="selection-toolbar" style={{left:selection.x,top:selection.y}} onMouseDown={e=>e.preventDefault()}><button onClick={()=>createBranch(selection)}><GitBranch size={15}/>Explain this<CornerDownRight size={14}/></button><button aria-label="Ask a specific question about selection" onClick={()=>{setBranchDialog(selection);setSelection(null);}}><MoreHorizontal size={17}/></button></div>}
    {toast&&<div className="toast" role="status">{toast}</div>}
    <ConnectionDialog open={settings} onOpenChange={setSettings} connection={connection} onConnect={c=>{setConnection(c);try{localStorage.setItem('branchroom-model-'+c.region,c.model);}catch{}setSettings(false);notify(c.connected?'Kimi is connected. Your next answer will be live.':'Switched to the guided demo.');}} authenticated={authenticated}/>
    <Dialog open={!!branchDialog} onOpenChange={open=>{if(!open)setBranchDialog(null);}}><DialogContent className="app-dialog"><DialogTitle>Follow this question</DialogTitle><DialogDescription>Start a separate explanation from this passage.</DialogDescription><label className="field-label">Term or passage<textarea value={branchDialog?.text||''} maxLength={10000} placeholder="Type or paste a term from the explanation" onChange={e=>setBranchDialog(s=>s?{...s,text:e.target.value}:s)}/></label><label className="field-label">Your question <span>(optional)</span><input value={branchQuestion} onChange={e=>setBranchQuestion(e.target.value)} placeholder="For example: show me a simple example"/></label><Button disabled={!branchDialog?.text.trim()||!!busy} onClick={()=>branchDialog&&createBranch(branchDialog,branchQuestion)}><GitBranch size={16}/>Open explanation branch</Button></DialogContent></Dialog>
    <Dialog open={!!editing} onOpenChange={open=>{if(!open)setEditing(null);}}><DialogContent className="app-dialog"><DialogTitle>Rename this {editing?.parentId?'branch':'tree'}</DialogTitle><DialogDescription>Choose a name that makes it easy to find again.</DialogDescription><form onSubmit={e=>{e.preventDefault();if(editing&&editTitle.trim()){updateBranch(editing.id,b=>({...b,title:editTitle.trim()}));setEditing(null);}}}><label className="field-label">Name<input autoFocus maxLength={200} value={editTitle} onChange={e=>setEditTitle(e.target.value)}/></label><Button type="submit" disabled={!editTitle.trim()}>Save name</Button></form>{!editing?.parentId&&<button className="danger-link" disabled={!!busy} onClick={()=>{setDeleteDialog(editing);setEditing(null);}}>Delete this learning tree</button>}</DialogContent></Dialog>
    <Dialog open={!!deleteDialog} onOpenChange={open=>{if(!open)setDeleteDialog(null);}}><DialogContent className="app-dialog"><DialogTitle>Delete “{deleteDialog?.title}”?</DialogTitle><DialogDescription>This removes this conversation and all its nested branches. Export a backup first if you want to keep them.</DialogDescription><div className="dialog-buttons"><Button variant="outline" onClick={()=>setDeleteDialog(null)}>Keep it</Button><Button variant="destructive" onClick={deleteBranch} disabled={!!busy}>Delete branch</Button></div></DialogContent></Dialog>
  </main>;
}

type PaneProps={branch:Branch;detail:boolean;childrenBranches:Branch[];busy:boolean;anyBusy:boolean;enabled:boolean;draft:string;setDraft:(s:string)=>void;onSend:(s:string)=>void;onStop:()=>void;onNavigate:(s:string)=>void;onSelect:(m:Message)=>void;onExplore:(m:Message)=>void;onRetry:(m:Message)=>void;onCopy:(m:Message)=>void;connected:boolean;onConnect:()=>void;scrollPositions:Record<string,number>;onSource:()=>void};
function ConversationPane(p:PaneProps){
  const scroller=useRef<HTMLDivElement>(null);const follow=useRef(false);const previousBusy=useRef(p.busy);
  useEffect(()=>{const el=scroller.current;if(el)el.scrollTop=p.scrollPositions[p.branch.id]||0;},[p.branch.id,p.scrollPositions]);
  useEffect(()=>{const el=scroller.current;if(p.busy&&!previousBusy.current)follow.current=true;previousBusy.current=p.busy;if(el&&p.busy&&follow.current)el.scrollTop=el.scrollHeight;},[p.branch.messages,p.busy]);
  return <><div className="conversation-scroll" ref={scroller} onScroll={e=>{const el=e.currentTarget;p.scrollPositions[p.branch.id]=el.scrollTop;follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<100;}}>
    {p.detail&&<button className="source-quote" onClick={p.onSource}><span><CornerDownRight size={14}/>FROM THE PARENT EXPLANATION</span><q>{p.branch.quote}</q></button>}
    {!p.branch.messages.length&&<div className="empty-conversation"><span className="empty-symbol"><GitBranch size={28}/></span><h2>What are you curious about?</h2><p>Start with a question. Follow any unfamiliar word into its own explanation.</p><div className="starter-prompts">{['How do transformers work?','Explain compound interest','Why is the sky blue?'].map(s=><button key={s} disabled={!p.enabled||p.anyBusy} onClick={()=>p.onSend(s)}>{s}<ArrowUp size={14}/></button>)}</div>{!p.connected&&<button className="text-link" onClick={p.onConnect}>Connect Kimi for live answers</button>}</div>}
    {p.branch.messages.map((m,index)=>m.role==='user'?<div className="user-message" key={m.id}><span className="message-author">YOU</span><p>{m.content}</p></div>:<article className="assistant-message" key={m.id}><div className="assistant-label"><span className="assistant-symbol"><GitBranch size={15}/></span><span>Branchroom</span><span className="answer-kind">{m.demo?'Demo explanation':'Kimi'}</span></div><div id={`message-${m.id}`} className="markdown" onMouseUp={()=>p.onSelect(m)} onTouchEnd={()=>setTimeout(()=>p.onSelect(m),100)} onKeyUp={()=>p.onSelect(m)}>{m.content?<ReactMarkdown remarkPlugins={[remarkGfm,remarkMath]} rehypePlugins={[rehypeKatex]}>{m.content}</ReactMarkdown>:<div className="thinking" role="status"><span/><span/><span/><span>{p.connected?'Thinking through your question…':'Opening your explanation…'}</span></div>}</div>
      {!(p.busy&&index===p.branch.messages.length-1)&&<div className="message-actions"><button onClick={()=>p.onExplore(m)} disabled={p.anyBusy}><GitBranch size={14}/>Explore a term</button><button aria-label="Copy explanation" onClick={()=>p.onCopy(m)}><Copy size={14}/></button>{(m.status==='error'||m.status==='interrupted')&&<button className="retry-answer" disabled={p.anyBusy} onClick={()=>p.onRetry(m)}>Retry answer</button>}</div>}
      {p.childrenBranches.filter(b=>b.sourceMessageId===m.id).length>0&&<div className="related-branches">{p.childrenBranches.filter(b=>b.sourceMessageId===m.id).map(b=><button key={b.id} onClick={()=>p.onNavigate(b.id)}><GitBranch size={13}/>{b.title}{b.understood?<Check size={13}/>:<ChevronRight size={13}/>}</button>)}</div>}
      {m.status==='interrupted'&&!p.busy&&<p className="interrupted-note">This answer was stopped before it finished.</p>}
    </article>)}
    <div className="scroll-spacer"/>
  </div><div className="composer-wrap"><form className="composer" onSubmit={e=>{e.preventDefault();p.onSend(p.draft);}}><textarea aria-label={p.detail?'Ask in this branch':'Ask in the main conversation'} placeholder={p.detail?'Go a little deeper…':'Keep the conversation growing…'} value={p.draft} onChange={e=>p.setDraft(e.target.value)} rows={2} maxLength={12000} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(!p.anyBusy&&p.enabled)p.onSend(p.draft);}}}/><div className="composer-bottom"><span>{p.detail?<><GitBranch size={13}/>Only in this branch</>:<><BookOpen size={13}/>Main conversation</>}</span>{p.busy?<button type="button" className="send-button" aria-label="Stop answer" onClick={p.onStop}><Square size={15}/></button>:<button type="submit" className="send-button" aria-label={p.detail?'Send branch question':'Send main question'} disabled={!p.draft.trim()||p.anyBusy||!p.enabled}><ArrowUp size={19}/></button>}</div></form><p className="composer-hint">{!p.connected?'Guided demo · connect Kimi for live answers':p.anyBusy&&!p.busy?'An answer is being written in another branch':'Select any text in an answer to explore it'}<span>↵ to send</span></p></div></>;
}

function ConnectionDialog({open,onOpenChange,connection,onConnect,authenticated}:{open:boolean;onOpenChange:(v:boolean)=>void;connection:Connection;onConnect:(v:Connection)=>void;authenticated:boolean}){
  const [key,setKey]=useState('');const [model,setModel]=useState('');const [region,setRegion]=useState<ProviderRegion>('modal');const [models,setModels]=useState<string[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(false);
  useEffect(()=>{if(open){setKey(connection.key);setModel(connection.model);setRegion(connection.region);setModels([]);setError('');}},[open,connection]);
  async function fetchModels(){setLoading(true);setError('');try{const res=await fetch('/api/provider',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'models',key,region})});const data=await res.json() as ApiData;if(!res.ok)throw new Error(data.error);if(!data.models?.length)throw new Error('No models were returned for this key.');setModels(data.models);if(!data.models.includes(model))setModel(data.models[0]);}catch(e){setError(e instanceof Error?e.message:'Could not connect.');}finally{setLoading(false);}}
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="app-dialog settings-dialog"><div className="settings-mark">K</div><DialogTitle>Connect your curiosity</DialogTitle><DialogDescription>Use your Kimi API for live explanations in every branch.</DialogDescription>
    {!authenticated&&<div className="notice-banner">Sign in to connect your API.<a href="/signin-with-chatgpt?return_to=/" target="_top">Sign in</a></div>}
    <label className="field-label">Connection<select value={region} onChange={e=>{setRegion(e.target.value as ProviderRegion);setKey('');setModel('');setModels([]);setError('');}}><option value="modal">Modal · your Kimi deployment</option><option value="global">Moonshot · Global</option><option value="china">Moonshot · China</option></select></label>
    {region==='modal'&&<label className="field-label">Your endpoint<input readOnly value={MODAL_CHAT_URL}/></label>}
    <label className="field-label">{region==='modal'?'Modal proxy token':'Kimi API key'}<input type="password" autoComplete="off" spellCheck={false} value={key} onChange={e=>{setKey(e.target.value);setModels([]);}} placeholder={region==='modal'?'TOKEN_ID.TOKEN_SECRET':connection.connected&&!connection.key&&region===connection.region?'Using the server’s saved key':'Paste your API key'}/></label>
    <p className="field-help">{region==='modal'?'Join your Modal Proxy Token ID and Token Secret with a period: TOKEN_ID.TOKEN_SECRET. ':''}Keys go only to the selected model server through this app. They stay in tab memory, clear on reload, and are never saved in your learning tree.</p>
    <Button variant="outline" onClick={()=>void fetchModels()} disabled={loading||!authenticated}>{loading?<LoaderCircle className="spin" size={15}/>:<Sparkles size={15}/>}Check connection & load models</Button>
    <label className="field-label">Model ID<input list="kimi-models" value={model} onChange={e=>setModel(e.target.value)} placeholder="Select a returned model, or enter its exact ID"/><datalist id="kimi-models">{models.map(m=><option value={m} key={m}/>)}</datalist></label>
    {models.length>0&&<p className="connection-success"><Check size={14}/>{models.length} models available for this key.</p>}
    {error&&<p className="connection-error" role="alert">{error}</p>}
    <Button disabled={!authenticated||!model.trim()||(!key.trim()&&!(connection.connected&&connection.region===region))} onClick={()=>onConnect({key:key.trim(),model:model.trim(),region,connected:true})}>Use Kimi<ArrowUp size={16}/></Button>
    <button className="text-link" onClick={()=>onConnect(initialConnection)}>Use the guided demo</button>
  </DialogContent></Dialog>;
}



