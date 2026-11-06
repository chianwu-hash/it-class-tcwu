// Local synthetic Auth + real PGlite RPCs + in-memory Storage. No outbound network/real credentials.
import http from 'node:http';import {readFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {setupMediaDB} from './fixtures/partner-message-db.mjs';import {createHandler} from '../supabase/functions/quiz-partner-message-media/handler.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),port=Number(process.env.PORT||8818),base='http://localhost:'+port,envBase='https://synthetic.invalid',objects=new Map();let db=await setupMediaDB(),queue=Promise.resolve();
const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
const action=(n,p,media=false)=>serial(()=>db.call(n,p,media));
const handler=createHandler({env:k=>({SUPABASE_URL:envBase,SUPABASE_ANON_KEY:'prototype-public',SUPABASE_SERVICE_ROLE_KEY:'prototype-private'})[k],fetcher:async(url,options={})=>{
 if(!url.startsWith(envBase+'/'))throw Error('OUTBOUND_DISABLED');const p=new URL(url).pathname,actor=Number(String(options.headers?.Authorization||'').replace('Bearer prototype-',''));
 if(p==='/auth/v1/user')return actor>=1&&actor<=4?Response.json({id:db.uid(actor)}):Response.json({},{status:401});
 if(p.endsWith('/quiz_partner_message_action')){try{return Response.json(await action(actor,JSON.parse(options.body).p,true));}catch(e){return Response.json({message:e.message},{status:400});}}
 if(p.endsWith('/quiz_partner_message_finalize')){if(options.headers.apikey!=='prototype-private')return Response.json({},{status:403});const args=JSON.parse(options.body);try{return Response.json(await serial(async()=>{await db.db.exec('set role service_role');try{return(await db.db.query('select public.quiz_partner_message_finalize($1,$2,$3) data',[args.p_id,args.p_sha,args.p_payload])).rows[0].data;}finally{await db.db.exec('reset role');}}));}catch(e){return Response.json({message:e.message},{status:400});}}
 if(p.startsWith('/storage/v1/object/')){if(options.headers.apikey!=='prototype-private')return Response.json({},{status:403});const k=p.replace('/storage/v1/object/authenticated/','').replace('/storage/v1/object/','');if(options.method==='POST'){if(objects.has(k))return Response.json({statusCode:'409'},{status:409});objects.set(k,new Uint8Array(options.body));return Response.json({stored:true});}return objects.has(k)?new Response(objects.get(k)):new Response('',{status:404});}
 throw Error('UNEXPECTED_PROTOTYPE_FETCH');
}});
const mime={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.woff2':'font/woff2','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};try{const u=new URL(req.url,base);if(req.headers.origin&&req.headers.origin!==base)return json(403,{error:'ORIGIN_DENIED'});
 if(u.pathname.startsWith('/__prototype/')){if(req.headers['x-prototype-session']!=='synthetic-media-only')return json(403,{error:'LOCAL_SESSION_REQUIRED'});const actor=Number(req.headers['x-prototype-actor']);if(![1,2,3,4].includes(actor))return json(403,{error:'LOCAL_SESSION_REQUIRED'});
  if(req.method==='GET'&&u.pathname==='/__prototype/snapshot'){const roomId=actor<=2?db.room.id:db.other.id;return json(200,{viewer:{id:db.uid(actor),name:'合成夥伴'+actor},room:await action(actor,{action:'snapshot',roomId})});}
  if(req.method!=='POST')return json(405,{});let size=0;const parts=[];for await(const chunk of req){size+=chunk.length;if(size>1500000)return json(413,{error:'TOO_LARGE'});parts.push(chunk);}const text=Buffer.concat(parts).toString('utf8');
  if(u.pathname==='/__prototype/reset'){await serial(async()=>{await db.db.close();db=await setupMediaDB();objects.clear();});return json(200,{reset:true});}
  if(u.pathname==='/__prototype/action'){const p=JSON.parse(text),media=!!p.attachmentIds?.length||p.action==='save_draft'&&!!p.state?.media;return json(200,await action(actor,p,media));}
  if(u.pathname==='/__prototype/media'){const response=await handler(new Request('https://edge.invalid',{method:'POST',headers:{Origin:'https://it-class-tcwu.vercel.app',Authorization:'Bearer prototype-'+actor,'Content-Type':'application/json'},body:text}));return json(response.status,await response.json());}
  return json(404,{});
 }
 let p=u.pathname;if(p==='/')p='/automation/fixtures/partner-message-integration.html';if(req.method!=='GET'||p.includes('..')||!(/^\/shared\/[A-Za-z0-9_./-]+$/.test(p)||/^\/automation\/fixtures\/partner-message-integration\.(html|mjs)$/.test(p)))return json(404,{});const target=path.resolve(root,'.'+p);if(!target.startsWith(root))return json(403,{});const body=await readFile(target);res.writeHead(200,{'Content-Type':(mime[path.extname(p)]||'application/octet-stream')+'; charset=utf-8','Cache-Control':'no-store'});res.end(body);
 }catch(e){json(400,{error:e.message});}}).listen(port,'127.0.0.1',()=>console.log('Synthetic SQL/media integration: '+base+'/?actor=1 and /?actor=2'));
process.on('SIGINT',()=>{server.close();db.db.close().finally(()=>process.exit());});
