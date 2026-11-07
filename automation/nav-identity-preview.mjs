// Local test only. Real partner app/navbar with synthetic auth and transport, no remote API proxy.
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),port=Number(process.env.PORT||8854);
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.webp':'image/webp','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname;let body;
 if(req.method!=='GET'||p.includes('..'))throw Error('not_found');
 if(p==='/shared/auth.js')body=await fs.readFile(path.join(root,'automation/fixtures/nav-identity-auth.mjs'));
 else if(p==='/shared/garden-unlock-notice.mjs')body='export function checkGardenUnlock(){};export function afterGardenReward(){}';
 else if(p==='/shared/quiz-transport.mjs')body=`export function createAuthenticatedTransport(){return async(route,body)=>{if(route.includes('quiz_partner_match_action'))return {enabled:false,available:false};if(body.p?.action==='me'){const u=window.fixtureSession.user,r=window.fixtureRows[u.id];return {id:u.id,name:r?r.class_code+'班'+r.seat_no+'號 '+r.display_name:u.email,rooms:[]};}if(body.p?.action==='catalog')return {papers:[]};throw Error('unexpected_action');};}`;
 else if(/^\/grade[3469]\/115-1\/partner-practice\.html$/.test(p)){body=(await fs.readFile(path.join(root,p),'utf8')).replace(/<link[^>]+https:[^>]+>/g,'');}
 else if(/^\/grade[3469]\/115-1\/(quiz-library|quiz|past-exam)\.html$/.test(p)){body=`<!doctype html><html><head><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/shared/quiz-theme.css"></head><body class="quiz-skin"><script src="navbar.js" data-quiz="true" data-homework="true"></script><script type="module">import {initNavbarAuth} from '/shared/navbar-auth.js';import {provideNavIdentity} from '/shared/grade6-nav-identity.js?v=20261107-roster-nav';initNavbarAuth({onSessionResolved(s){if(s)provideNavIdentity({userId:s.user.id,email:s.user.email,row:window.fixtureRows[s.user.id]});}});</script></body></html>`;}
 else if(p.startsWith('/shared/')||/^\/grade[3469]\/115-1\/navbar\.js$/.test(p))body=await fs.readFile(path.join(root,p));
 else throw Error('not_found');
 res.writeHead(200,{'Content-Type':(mime[path.extname(p)]||'text/html')+'; charset=utf-8','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end('not_found');}}).listen(port,'127.0.0.1',()=>console.log('Synthetic navbar identity preview: http://localhost:'+port+'/grade3/115-1/partner-practice.html'));
