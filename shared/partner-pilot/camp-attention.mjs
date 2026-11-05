// Session-only attention. A baseline never emits a toast; no learning/read state is written remotely.
export function createCampAttention(){
 let scope='',messages=new Map();
 function update(room,user,notes){
  const next=JSON.stringify([room,user]),baseline=next!==scope;
  if(baseline){scope=next;messages.clear();}
  const asks=new Map(notes.filter(n=>n.kind==='ask').map(n=>[String(n.id),n]));
  const chat=new Set(notes.filter(n=>n.kind==='chat').slice(-30).map(n=>String(n.id))),present=new Set(),fresh=[];
  for(const n of notes){
   if(!['ask','reply','chat'].includes(n.kind)||n.kind==='chat'&&!chat.has(String(n.id)))continue;
   const id=String(n.id),related=n.user!==user&&(n.kind==='ask'||n.kind==='reply'&&asks.get(String(n.thread))?.user===user);
   const relevant=related||n.user!==user&&n.kind==='chat'&&!baseline;
   const signature=JSON.stringify([n.user,n.kind,n.text,n.at]);present.add(id);
   if(messages.get(id)?.signature!==signature){messages.set(id,{signature,read:!relevant});if(!baseline&&related)fresh.push(n);}
  }
  for(const id of messages.keys())if(!present.has(id))messages.delete(id);
  return fresh;
 }
 return {update,unread:id=>!!messages.get(String(id))&&!messages.get(String(id)).read,
  count:()=>[...messages.values()].filter(m=>!m.read).length,
  read(ids){for(const id of ids){const m=messages.get(String(id));if(m)m.read=true;}},
  clear(){scope='';messages.clear();}};
}
