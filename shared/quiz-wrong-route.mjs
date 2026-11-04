const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
const fields={source_type:'wrong_source',attempt_id:'wrong_attempt',question_id:'wrong_question',paper_id:'wrong_paper',version_id:'wrong_version',group_id:'wrong_group'};
export function wrongQuestionRef(item){
 const type=item?.source_type||'quiz';
 if(!['quiz','past_exam'].includes(type)||!uuid(item?.attempt_id)||!id(item?.question_id))return null;
 if(type==='past_exam'&&(!id(item.paper_id)||!uuid(item.version_id)||!id(item.group_id)))return null;
 return {source_type:type,attempt_id:item.attempt_id,question_id:item.question_id,...(type==='past_exam'?{paper_id:item.paper_id,version_id:item.version_id,group_id:item.group_id}:{})};
}
export function readWrongQuestionRef(search){
 const params=new URLSearchParams(search),item={};for(const [field,key] of Object.entries(fields))if(params.has(key))item[field]=params.get(key);
 return item.source_type?wrongQuestionRef(item):null;
}
export function wrongQuestionSearch(item,search=''){
 const params=new URLSearchParams(search);for(const key of Object.values(fields))params.delete(key);
 const ref=wrongQuestionRef(item);if(ref)for(const [field,value] of Object.entries(ref))params.set(fields[field],value);
 return params.toString();
}
