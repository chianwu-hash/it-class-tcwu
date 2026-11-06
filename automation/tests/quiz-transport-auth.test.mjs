import test from 'node:test';import assert from 'node:assert/strict';import {createAuthenticatedTransport} from '../../shared/quiz-transport.mjs';
test('登入缺少、失效、切換及refresh失敗是認證錯誤，不偽裝成待重送寫入',async()=>{
 for(const kind of['missing','expired','switched','refresh']){
  let fetched=0;const initial={user:{id:'synthetic-a'},access_token:'synthetic-only'};
  const auth={SUPABASE_URL:'https://synthetic.invalid',SUPABASE_ANON_KEY:'synthetic',supabase:{auth:{async getSession(){if(kind==='refresh')throw new TypeError('network');return {data:{session:kind==='expired'?null:kind==='switched'?{...initial,user:{id:'synthetic-b'}}:initial}};}}}};
  const rpc=createAuthenticatedTransport({auth,getSession:()=>kind==='missing'?null:initial,fetcher:async()=>{fetched++;return new Response('{}');}});
  await assert.rejects(rpc('/rest/v1/rpc/test',{p:{}}),e=>e.code==='AUTH_REQUIRED'&&!(e instanceof TypeError));assert.equal(fetched,0);
 }
});
