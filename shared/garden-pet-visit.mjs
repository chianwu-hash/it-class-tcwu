// One authenticated visit request per page/student, including data refreshes.
export function createPetVisitClient(supabase,{timeoutMs=8000}={}){
 const visits=new Map();
 return {get(uid,course){
  if(!uid)return Promise.resolve({surprise:false,refreshMessage:false});
  if(!visits.has(uid))visits.set(uid,(async()=>{
   const controller=new AbortController();let timer;
   try{
    let request=supabase.rpc('garden_pet_visit',{p_course_id:course});
    if(typeof request.abortSignal==='function')request=request.abortSignal(controller.signal);
    const {data,error}=await Promise.race([request,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('visit_timeout'))},timeoutMs)})]);
    if(error)throw error;
    return {surprise:data?.surprise===true,refreshMessage:data?.refreshMessage===true,cooldownUntil:data?.cooldownUntil};
   }catch{return {surprise:false,refreshMessage:false}}
   finally{clearTimeout(timer)}
  })());
  return visits.get(uid);
 }};
}
