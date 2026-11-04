import {foundationMilestones} from './typing-foundation-milestones.mjs';
export function createFoundationMilestoneSummary(track){
  const root=document.createElement('section');root.className='foundation-milestones';root.dataset.track=track;
  const title=document.createElement('h2');title.textContent='下一朵里程碑花';const note=document.createElement('p');note.textContent='每個大關仍有一片葉；完成一段完整技能，再開一朵花。';
  const list=document.createElement('ol'),status=document.createElement('p');status.role='status';status.setAttribute('aria-live','polite');status.textContent='登入並讀取成果後，顯示你的里程碑進度。';root.append(title,note,list,status);
  let initialized=false,previous=new Set(),lastSignature="";
  return{element:root,update(records){const items=foundationMilestones(records).filter(m=>m.track===track),earned=new Set(items.filter(m=>m.earned).map(m=>m.key));const signature=items.map(m=>m.completed).join(',');if(signature===lastSignature)return;lastSignature=signature;list.replaceChildren();
    for(const m of items){const li=document.createElement('li');li.dataset.earned=String(m.earned);const text=document.createElement('span');text.textContent=`${m.earned?'✿ 已開花':'○ 繼續練習'}・${m.title}`;const progress=document.createElement('progress');progress.max=m.end;progress.value=m.completed;progress.setAttribute('aria-label',`${m.label}${m.title}：${m.completed}／${m.end} 大關`);const count=document.createElement('small');count.textContent=`${m.completed}／${m.end} 大關`;li.append(text,progress,count);list.append(li);}
    const newly=initialized?items.filter(m=>m.earned&&!previous.has(m.key)):[];
    status.textContent=newly.length?`你完成了${newly.map(m=>m.title).join('、')}，里程碑花記下這段努力。`:items.every(m=>m.earned)?'三朵里程碑花都開了！重練可以繼續精進，不重複領取。':`已開 ${earned.size}／3 朵花；下一朵需要完成這個階段所有大關。`;
    previous=earned;initialized=true;
  }};
}
