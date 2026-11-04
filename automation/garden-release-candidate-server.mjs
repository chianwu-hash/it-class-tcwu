// Static release-package QA; all auth/RPCs use the existing isolated fixture.
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';
const report=JSON.parse(await fs.readFile('D:/projects/it-class-tcwu/automation/output/effort-prerelease-audit-20261031/release-candidate-report.json','utf8')),root=path.resolve(report.candidate),fixture=path.resolve('automation/fixtures/garden-level2.html');
const port=4450,server=http.createServer(async(req,res)=>{try{if(req.headers.host!==`127.0.0.1:${port}`){res.writeHead(403);return res.end()}
 const u=new URL(req.url,`http://127.0.0.1:${port}`);
 if(u.pathname==='/shared/auth.js'||u.pathname.startsWith('/__garden/')||u.pathname==='/api/garden-weather'){
  const body=[];for await(const c of req){body.push(c);if(body.reduce((n,x)=>n+x.length,0)>100000)throw Error('body_limit')}
  const r=await fetch('http://127.0.0.1:4438'+u.pathname+u.search,{method:req.method,headers:{'Content-Type':req.headers['content-type']||'application/json','X-Fixture-Nonce':req.headers['x-fixture-nonce']||''},body:req.method==='POST'?Buffer.concat(body):undefined});res.writeHead(r.status,{'Content-Type':r.headers.get('Content-Type'),'Cache-Control':'no-store'});return res.end(Buffer.from(await r.arrayBuffer()));
 }
 if(req.method!=='GET'){res.writeHead(405);return res.end()}
 const p=u.pathname==='/'?fixture:path.resolve(root,'.'+decodeURIComponent(u.pathname));if(p!==fixture&&!p.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
 const body=await fs.readFile(p);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'})[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
}catch(e){res.writeHead(e.code==='ENOENT'?404:400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.code==='ENOENT'?'missing_asset':'local_request_failed'}))}});
server.listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${port}/ (isolated release package)`));
