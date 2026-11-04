// The server supplies read-only, separate rehearsal credits for one teacher test
// account. Other students do not make this request or receive synthetic progress.
export async function withGardenTestRewards(model,{supabase,session,courseId}){
 if(session?.user?.email?.trim().toLowerCase()!=='chianwu@apps.ntpc.edu.tw'||courseId!=='grade3-115-1')return model;
 let request=supabase.rpc('garden_test_rewards',{p_course_id:courseId});
 if(request.abortSignal)request=request.abortSignal(AbortSignal.timeout(10000));
 const {data,error}=await request;if(error)throw new Error('升級體驗準備資料暫時無法讀取，請重新整理。');
 if(!Array.isArray(data)||!data.length)return model;
 if(data.some(r=>r.courseId!==courseId||r.earned!==true||!['flower','typing-leaf'].includes(r.kind)||!r.id?.startsWith(courseId+':test-setup:')))throw new Error('升級體驗資料格式不符。');
 const rewards=[...model.rewards,...data],leaves=rewards.filter(r=>r.kind!=='flower'),flowers=rewards.filter(r=>r.kind==='flower');
 return{...model,rewards,leaves,flowers,stats:{...model.stats,leafCount:leaves.length,flowerCount:flowers.length,colorUnlocked:flowers.length>=3,nextFlowerUnlock:Math.max(0,3-flowers.length)}};
}
