// Complete partner keepsakes never enter the individual half-leaf pairing stream.
export function partnerTreeData(awards,courseId){
 const activities=[],rows=[];
 for(const a of awards||[]){
  if(a.course!==courseId||!/^\w{8}-[\w-]{27}$/.test(a.id))continue;
  const leaves=Number(a.leaves),flowers=Number(a.flowers);
  if(!Number.isInteger(leaves)||leaves<0||leaves>2||!Number.isInteger(flowers)||flowers<0||flowers>1)throw Error('合作紀念資料格式不符。');
  for(let n=1;n<=leaves+flowers;n++){
   const activityKey=`partner_${a.id}_${n}`,flower=n>leaves,href=`/grade${courseId.match(/^grade([3469])/)[1]}/115-1/partner-practice.html?award=${encodeURIComponent(a.id)}`;
   activities.push({courseId,weekCode:'00',activityKey,type:flower?'partner-flower':'partner-leaf',sourceType:'partner',label:'夥伴練功・'+a.record.title,pageHref:href,partnerRecord:a.record,sourceLinks:[{title:'看看我們的共同紀錄冊',href}]});
   rows.push({course_id:courseId,week_code:'00',activity_key:activityKey,completed:true,score:null,updated_at:a.at});
  }
 }
 return{activities,rows};
}
export function partnerKeepsakeSvg(flower=false){
 return flower?'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g stroke="#b88632" stroke-width="2"><ellipse cx="32" cy="19" rx="11" ry="17" fill="#f9b7c7"/><ellipse cx="32" cy="19" rx="11" ry="17" fill="#c1c6f5" transform="rotate(72 32 32)"/><ellipse cx="32" cy="19" rx="11" ry="17" fill="#f9b7c7" transform="rotate(144 32 32)"/><ellipse cx="32" cy="19" rx="11" ry="17" fill="#b1e4d3" transform="rotate(216 32 32)"/><ellipse cx="32" cy="19" rx="11" ry="17" fill="#ffe6a0" transform="rotate(288 32 32)"/><circle cx="32" cy="32" r="12" fill="#fff7dd"/><path d="M22 32q5-11 10 0q5-11 10 0q-3 7-10 11q-7-4-10-11" fill="#dfad45" stroke="none"/></g></svg>':'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 44"><path d="M3 37Q0 1 33 4Q39 29 3 37Z" fill="#8ed3b0" stroke="#b88632" stroke-width="2"/><path d="M29 39Q24 8 60 5Q64 36 29 39Z" fill="#4caeaa" stroke="#b88632" stroke-width="2"/><path d="M7 34L27 10M31 35L54 11" stroke="#fff4cc" stroke-width="2"/><circle cx="31" cy="29" r="6" fill="#fff4cc" stroke="#b88632" stroke-width="2"/></svg>';
}
