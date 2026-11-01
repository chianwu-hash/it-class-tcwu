import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export function managementRead(query,parameters=[]){
  return new Promise((done,fail)=>{
    const child=spawn('python',['-X','utf8',fileURLToPath(new URL('./supabase-personal-readonly.py',import.meta.url))],{windowsHide:true,stdio:['pipe','pipe','ignore']});
    let body='';const timer=setTimeout(()=>child.kill(),40000);
    child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{body+=chunk;if(Buffer.byteLength(body)>2000000)child.kill();});
    child.once('error',()=>{clearTimeout(timer);fail(new Error('management_read_unavailable'));});
    child.once('exit',code=>{clearTimeout(timer);let result;try{result=JSON.parse(body);}catch{return fail(new Error('management_read_failed'));}
      if(code||result.error)return fail(Object.assign(new Error(result.error||'management_read_failed'),{status:result.status}));done(result.rows);});
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({query,parameters}));
  });
}
