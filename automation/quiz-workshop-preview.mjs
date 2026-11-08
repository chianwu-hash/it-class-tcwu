// Loopback-only synthetic review server. Does not proxy remote services.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fixtureRPC} from './fixtures/workshop-rpc.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),port=Number(process.env.PORT||8868);
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf'};
http.createServer(async(req,res)=>{
 const send=(type,body,status=200)=>{res.writeHead(status,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store'});res.end(body);};
 try{
  const url=new URL(req.url,`http://localhost:${port}`),p=url.pathname;
  if(req.method==='POST'&&p==='/__workshop-rpc'){
   if(req.headers.origin!==`http://localhost:${port}`)return send('text/plain','forbidden',403);
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>500000)throw Error('too_large');}
   return send('application/json',JSON.stringify(fixtureRPC(JSON.parse(raw))));
  }
  if(req.method!=='GET')throw Error('not_found');
  if(p==='/__workshop-image.svg')return send('image/svg+xml','<svg xmlns="http://www.w3.org/2000/svg" width="220" height="100"><rect width="220" height="100" fill="#e0f2fe"/><path d="M20 60h180l-30 30H50z" fill="#0f766e"/></svg>');
  if(p==='/__workshop-audio.wav'){
   const bytes=Buffer.alloc(44+1600);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(8000,24);bytes.writeUInt32LE(16000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(1600,40);res.writeHead(200,{'Content-Type':'audio/wav'});return res.end(bytes);
  }
  if(p==='/shared/auth.js')return send('text/javascript',(await fs.readFile(path.join(root,'automation/fixtures/nav-identity-auth.mjs'),'utf8'))+'\nsupabase.auth.getSession=async()=>({data:{session:window.fixtureSession},error:null});');
  if(p==='/shared/garden-unlock-notice.mjs')return send('text/javascript','export function afterGardenReward(){};export function checkGardenUnlock(){}');
  if(p==='/shared/quiz-transport.mjs')return send('text/javascript',`export function createAuthenticatedTransport({getSession}){return async(route,body)=>{window.workshopCalls??=[];window.workshopCalls.push({route,body});const r=await fetch('/__workshop-rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({route,body,grade:Number(document.body.dataset.grade),user:getSession()?.user?.id})});const result=await r.json();if(!r.ok)throw Error(result.error);if(window.workshopDropNext){window.workshopDropNext=false;throw TypeError('synthetic_lost_response');}return result;};}`);
  if(!p.startsWith('/shared/')&&!p.startsWith('/automation/fixtures/')&&!/^\/grade[3469]\/115-1\/(quiz|past-exam|partner-practice|quiz-library)\.html$/.test(p)&&!/^\/grade[3469]\/115-1\/navbar.js$/.test(p))throw Error('not_found');
  const file=path.resolve(root,'.'+p);if(!file.startsWith(path.resolve(root)+path.sep))throw Error('not_found');
  send(mime[path.extname(file)]||'application/octet-stream',await fs.readFile(file));
 }catch(error){send('application/json',JSON.stringify({error:error.message}),404);}
}).listen(port,'127.0.0.1',()=>console.log(`合成驗收預覽：http://localhost:${port}/grade4/115-1/past-exam.html?paper=synthetic`));
