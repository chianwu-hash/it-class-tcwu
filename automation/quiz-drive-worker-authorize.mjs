// Dedicated test grant; existing homework connection is never decrypted or copied.
import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash,randomBytes} from 'node:crypto';
import vault from './lib/quiz-drive-worker-private.cjs';
const dir='automation/output/quiz/drive-worker-poc',cfg=vault.load();
if(!cfg.clientId||!cfg.clientSecret||cfg.refreshToken)throw Error('new_dedicated_client_required');
const state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
const redirect='http://127.0.0.1:4351/callback';
const params=new URLSearchParams({client_id:cfg.clientId,redirect_uri:redirect,response_type:'code',scope:'openid email https://www.googleapis.com/auth/drive.file',access_type:'offline',prompt:'consent',login_hint:'th990821@mail.thps.ntpc.edu.tw',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'});
await writeFile(`${dir}/authorize-url.txt`,'https://accounts.google.com/o/oauth2/v2/auth?'+params,'utf8');
let consumed=false;
const server=http.createServer(async(req,res)=>{
 const finish=(status,text)=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'"});res.end(`<html lang="zh-Hant"><meta charset="utf-8"><title>題庫圖片測試授權</title><h1>${text}</h1><p>可以返回測試工作。</p></html>`);};
 if(req.headers.host!=='127.0.0.1:4351'||req.method!=='GET')return finish(403,'無法使用此請求');
 const u=new URL(req.url,redirect);if(u.pathname!=='/callback')return finish(404,'找不到頁面');
 if(consumed||u.searchParams.get('state')!==state||!u.searchParams.get('code'))return finish(400,'授權未完成，請重新開始');
 consumed=true;
 try{
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:cfg.clientId,client_secret:cfg.clientSecret,redirect_uri:redirect,code:u.searchParams.get('code'),grant_type:'authorization_code',code_verifier:verifier})});
  const tokens=await r.json();if(!r.ok||!tokens.refresh_token)throw Error('authorization_exchange_failed');
  const auth={Authorization:`Bearer ${tokens.access_token}`};
  const user=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:auth}).then(r=>r.json());
  if(user.email!=='th990821@mail.thps.ntpc.edu.tw'||!user.email_verified)throw Error('school_account_mismatch');
  const about=await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress),storageQuota',{headers:auth}).then(r=>r.json());
  if(about.user?.emailAddress!==user.email)throw Error('drive_account_mismatch');
  vault.save({...cfg,refreshToken:tokens.refresh_token,email:user.email,ticketKey:randomBytes(32).toString('base64url')});
  await writeFile(`${dir}/drive-account-check.json`,JSON.stringify({email:user.email,checkedAt:new Date().toISOString(),storageQuota:about.storageQuota},null,2),'utf8');
  finish(200,'學校 Drive 測試授權完成');console.log(JSON.stringify({authorized:true,email:user.email}));server.close();
 }catch(e){finish(400,'授權未完成');console.error(e.message);server.close();process.exitCode=1;}
});
server.listen(4351,'127.0.0.1',()=>console.log('Google Drive test callback ready on loopback port 4351'));
setTimeout(()=>{server.close();process.exitCode=1;},12*60*1000).unref();
