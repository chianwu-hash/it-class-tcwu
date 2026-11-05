// Ephemeral UI attention only; never stores learning progress or sends read RPCs.
export function createMessageAttention({now=Date.now}={}) {
 let scope='',messages=new Map();
 const eligible=n=>['ask','reply','chat'].includes(n.kind);
 function update(room,user,notes){
  const nextScope=JSON.stringify([room,user]);if(scope!==nextScope){scope=nextScope;messages.clear();}
  const present=new Set();
  const visibleChat=new Set(notes.filter(n=>n.kind==='chat').slice(-30).map(n=>String(n.id)));
  for(const n of notes.filter(n=>eligible(n)&&(n.kind!=='chat'||visibleChat.has(String(n.id))))){
   const id=String(n.id),signature=JSON.stringify([n.user,n.kind,n.text,n.at]);present.add(id);
   if(messages.get(id)?.signature!==signature)messages.set(id,{signature,read:n.user===user,at:now()});
  }
  for(const id of messages.keys())if(!present.has(id))messages.delete(id);
 }
 const state=id=>{const m=messages.get(String(id)),elapsed=m?Math.max(0,now()-m.at):5000;return {unread:!!m&&!m.read,pulse:!!m&&!m.read&&elapsed<5000,elapsed};};
 return {update,state,count:()=>[...messages.values()].filter(m=>!m.read).length,
  read(id){const m=messages.get(String(id));if(m)m.read=true;},
  clear(){scope='';messages.clear();}};
}
