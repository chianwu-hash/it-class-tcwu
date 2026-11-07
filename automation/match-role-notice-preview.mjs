// Synthetic controller preview only; no auth, student data, RPC or remote proxy.
import http from 'node:http';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),port=Number(process.env.PORT||8855);
http.createServer(async(req,res)=>{try{
 const p=new URL(req.url,'http://localhost').pathname;
 if(req.method!=='GET'||!['/automation/fixtures/match-role-notice.html','/shared/partner-pilot/matchmaking.mjs','/shared/partner-pilot/paper-picker.mjs','/shared/partner-pilot/team-flow.css'].includes(p))throw Error('not_found');
 const body=await fs.readFile(fileURLToPath(new URL(p.slice(1),root)));
 res.writeHead(200,{'Content-Type':(p.endsWith('.mjs')?'text/javascript':p.endsWith('.css')?'text/css':'text/html')+'; charset=utf-8','Cache-Control':'no-store'});res.end(body);
}catch{res.writeHead(404);res.end('not_found');}}).listen(port,'127.0.0.1',()=>console.log('Synthetic role notice: http://localhost:'+port+'/automation/fixtures/match-role-notice.html'));
