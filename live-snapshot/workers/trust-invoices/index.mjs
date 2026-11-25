import {fetch as apiFetch} from './backend.js';
import assets from './assets.js';
const CSP="default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' SUPA https://cdnjs.cloudflare.com; img-src 'self' data: blob: SUPA; frame-src 'self' blob: SUPA; worker-src 'self' blob: https://cdnjs.cloudflare.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/'))return apiFetch(request,env,ctx);
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  const path=url.pathname==='/'?'/index.html':url.pathname;
  const asset=assets[path];
  const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':CSP.replaceAll('SUPA',env.SUPABASE_URL),'Cache-Control':'no-cache','Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
  if(!asset)return new Response('Not found',{status:404,headers});
  headers['Content-Type']=asset.type;
  if(asset.type.startsWith('text/html'))headers['Cache-Control']='no-store';
  return new Response(request.method==='HEAD'?null:asset.content,{headers});
 }
};
