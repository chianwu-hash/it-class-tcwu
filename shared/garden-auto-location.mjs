// Use existing browser permission; never open a permission prompt automatically.
export function startAutomaticLocation(controller,{permissions=globalThis.navigator?.permissions}={}) {
 let disposed=false,status=null;
 function apply(){
  if(disposed)return;
  if(status?.state==='granted')controller.locate();
  else {const s=controller.snapshot();if(s.locating||s.point.id!=='school')controller.school();}
 }
 const ready=(async()=>{
  try{if(!permissions?.query)return;status=await permissions.query({name:'geolocation'});
   if(disposed)return;status.addEventListener?.('change',apply);apply();
  }catch{/* Unsupported permission query: keep the school fallback. */}
 })();
 return {ready,destroy(){disposed=true;status?.removeEventListener?.('change',apply)}};
}
