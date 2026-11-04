import test from 'node:test';
import assert from 'node:assert/strict';

const KEY='test-identity-change-115-v1';
async function fixture(run,{blocked=false}={}) {
    const previous=Object.fromEntries(['window','localStorage','BroadcastChannel'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
    const values=new Map(),channels=[];
    globalThis.localStorage={getItem:k=>{if(blocked)throw Error('blocked');return values.get(k)||null;},setItem:(k,v)=>{if(blocked)throw Error('blocked');values.set(k,v);}};
    globalThis.BroadcastChannel=class {
        constructor(name){this.name=name;channels.push(this);}
        postMessage(data){for(const c of channels)if(c!==this&&c.name===this.name)c.onmessage?.({data});}
    };
    const tab=async()=>{
        const window=new EventTarget();globalThis.window=window;
        const module=await import(new URL(`../../shared/test-identity-state.mjs?test=${crypto.randomUUID()}`,import.meta.url));
        return {window,module};
    };
    try{await run({values,channels,tab});}
    finally{for(const [k,v] of Object.entries(previous))if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}
}

test('同帳號切換會同步其他分頁，重複廣播及 pageshow 不重複載入',async()=>fixture(async({tab})=>{
    const a=await tab(),b=await tab();let ac=0,bc=0;
    a.module.onTestIdentityChange(()=>ac++);b.module.onTestIdentityChange(()=>bc++);
    const old=a.module.testIdentityRevision('student');
    const revision=a.module.publishTestIdentityChange('student');
    assert.notEqual(old,revision);assert.equal(b.module.testIdentityRevision('student'),revision);
    b.window.dispatchEvent(new Event('pageshow'));b.window.dispatchEvent(new Event('pageshow'));
    assert.equal(ac,1);assert.equal(bc,1);
}));

test('BFCache 回復只在儲存的切換版本有變時重新確認',async()=>fixture(async({tab,values})=>{
    const a=await tab();let count=0;a.module.onTestIdentityChange(()=>count++);
    a.window.dispatchEvent(new Event('pageshow'));assert.equal(count,0);
    values.set(KEY,JSON.stringify({version:1,userId:'student',revision:'switched'}));
    a.window.dispatchEvent(new Event('pageshow'));assert.equal(count,1);
    a.window.dispatchEvent(new Event('pageshow'));assert.equal(count,1);
}));

test('較晚送達的舊切換通知不能覆蓋儲存的最新版本',async()=>fixture(async({tab,values,channels})=>{
    const a=await tab();let count=0;a.module.onTestIdentityChange(()=>count++);
    values.set(KEY,JSON.stringify({version:1,userId:'student',revision:'new'}));
    channels[0].onmessage({data:{version:1,userId:'student',revision:'old'}});
    assert.equal(count,0);assert.equal(a.module.testIdentityRevision('student'),'new');
    a.window.dispatchEvent(new Event('pageshow'));assert.equal(count,1);
}));

test('通知不含名冊或進度，其他帳號與畸形訊息不覆蓋本人版本',async()=>fixture(async({tab,channels,values})=>{
    const a=await tab();const revision=a.module.publishTestIdentityChange('student');
    assert.deepEqual(Object.keys(JSON.parse(values.get(KEY))).sort(),['revision','userId','version']);
    channels[0].onmessage({data:{version:99,userId:'student',revision:'bad'}});
    channels[0].onmessage({data:{version:1,userId:'other',revision:'different'}});
    assert.equal(a.module.testIdentityRevision('student'),revision);
}));

test('儲存受限時仍能透過廣播同步；取消訂閱後不再收到通知',async()=>fixture(async({tab})=>{
    const a=await tab(),b=await tab();let count=0;const stop=b.module.onTestIdentityChange(()=>count++);
    const revision=a.module.publishTestIdentityChange('student');assert.equal(count,1);
    assert.equal(b.module.testIdentityRevision('student'),revision);stop();
    a.module.publishTestIdentityChange('student');assert.equal(count,1);
},{blocked:true}));
