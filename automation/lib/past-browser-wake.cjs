const {guardSession}=require('D:/ai-browser/background-policy.cjs');
// Run only inside the registered ai-browser worker. This connection sees browser/tab
// targets only, so no renderer domains start before the exact leased page is awake.
module.exports=async function wakePastTarget(puppeteer,cdpUrl,targetId){
 const browser=await puppeteer.connect({browserURL:cdpUrl,defaultViewport:null,networkEnabled:false,protocolTimeout:15000,targetFilter:t=>['browser','tab'].includes(t.type())});
 try{
  const control=await browser.target().createCDPSession(),attached=await control.send('Target.attachToTarget',{targetId,flatten:false});let serial=0;const replies=new Map();
  control.on('Target.receivedMessageFromTarget',event=>{if(event.sessionId!==attached.sessionId)return;const message=JSON.parse(event.message),pending=replies.get(message.id);if(!pending)return;replies.delete(message.id);message.error?pending.reject(Error(message.error.message)):pending.resolve(message.result);});
  const scoped=guardSession({send:(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{replies.delete(id);reject(Error('Target wake timeout'));},15000);replies.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});control.send('Target.sendMessageToTarget',{sessionId:attached.sessionId,message:JSON.stringify({id,method,params})}).catch(reject);})});
  scoped.grantForegroundOnce('Page.bringToFront','先喚醒精確的隔離驗收分頁，避免背景分頁初始化逾時');await scoped.send('Page.bringToFront');
  await control.send('Target.detachFromTarget',{sessionId:attached.sessionId});await control.detach();
 }finally{await browser.disconnect();}
};
