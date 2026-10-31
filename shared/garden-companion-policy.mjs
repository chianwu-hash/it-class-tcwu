// Presentation policy only; never awards learning progress or unlocks items.
export function createCompanionPolicy(){
 let owned=false,preferredVisible=false,mode='walk',wet=false,feedback={inside:false,travelling:false,busy:false,visible:false};
 return {
  configure({petUnlocked,homeVisible}){owned=petUnlocked===true;const next=homeVisible===true;if(preferredVisible&&!next&&!wet)mode='walk';preferredVisible=next;return this.snapshot()},
  weather(scene){wet=scene==='downpour'||scene==='thunder';if(wet)mode='rest';return this.snapshot()},
  command(action){
   if(!owned)return {ok:false,reason:'locked'};
   if(!['walk','rest','hide','show'].includes(action))return {ok:false,reason:'invalid_command'};
   if(wet&&(action==='walk'||action==='hide'))return {ok:false,reason:'rain'};
   if(action==='rest'){preferredVisible=true;mode='rest'}
   if(action==='walk')mode='walk';
   if(action==='hide'){preferredVisible=false;mode='walk'}
   if(action==='show')preferredVisible=true;
   return {ok:true,...this.snapshot()};
  },
  observe(state){feedback={inside:state.inside===true,travelling:state.travelling===true,busy:state.busy===true,visible:state.visible===true};return this.snapshot()},
  snapshot(){return {owned,preferredVisible,mode,wet,...feedback,canLeave:owned&&!wet,forceRest:owned&&(wet||mode==='rest')}},
  reset(){owned=false;preferredVisible=false;mode='walk';wet=false;feedback={inside:false,travelling:false,busy:false,visible:false}}
 };
}
