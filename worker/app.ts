import * as workspace from '../app/api/workspace/route';
import * as provider from '../app/api/provider/route';
import html from '../app/index.html';
export default {
  async fetch(request:Request, env:{ASSETS?:{fetch:(r:Request)=>Promise<Response>}}){
    const path=new URL(request.url).pathname;
    if(path==='/api/workspace'){
      if(request.method==='GET')return workspace.GET(request);
      if(request.method==='PUT')return workspace.PUT(request);
      return new Response('Method not allowed',{status:405});
    }
    if(path==='/api/provider'){
      if(request.method==='GET')return provider.GET(request);
      if(request.method==='POST')return provider.POST(request);
      return new Response('Method not allowed',{status:405});
    }
    if(path==='/')return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
    return env.ASSETS?env.ASSETS.fetch(request):new Response('Not found',{status:404});
  }
};
