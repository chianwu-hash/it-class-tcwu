// Let the browser ask on first use and retain its own saved permission choice.
export function startAutomaticLocation(controller,{permissions=globalThis.navigator?.permissions}={}) {
 let disposed=false,status=null;
 function apply(){
  if(disposed)return;
  if(status?.state!=='denied')controller.locate();
  else {const s=controller.snapshot();if(s.locating||s.point.id!=='school')controller.school();}
 }
 const ready=(async()=>{
  try{if(!permissions?.query){apply();return;}status=await permissions.query({name:'geolocation'});
   if(disposed)return;status.addEventListener?.('change',apply);apply();
  }catch{apply();/* Geolocation itself handles permission when querying is unsupported. */}
 })();
 return {ready,destroy(){disposed=true;status?.removeEventListener?.('change',apply)}};
}
