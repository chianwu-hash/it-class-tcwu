// 僅教師本機審閱草稿；不處理學生進度，不呼叫正式API。
const draftKey='past-exam-teacher-review:'+DATA.draftId;
function saveDraft(){
 try{
  localStorage.setItem(draftKey,JSON.stringify(exportData()));
  $('draftStatus').textContent='草稿已暫存於此瀏覽器。填完仍請匯出紀錄，才能交由我讀取；換瀏覽器或清除資料可能失去草稿。';
 }catch(err){$('draftStatus').textContent='此瀏覽器無法暫存草稿，請立即匯出保存。';}
}
function restoreDraft(){
 try{
  const raw=localStorage.getItem(draftKey);if(!raw){$('draftStatus').textContent='尚未填寫。輸入後會嘗試暫存於此瀏覽器，填完請匯出。';return;}
  const v=JSON.parse(raw);if(v.schema!=='past-exam-review-decisions/1'||v.sourceSnapshot!==DATA.createdAt||!Array.isArray(v.decisions))throw Error('草稿版本不符');
  for(const d of v.decisions){const c=byId.get(d.id);if(!c||c.paperId!==d.paperId||c.bundleSha256!==d.bundleSha256||!statusOptions.includes(d.status)||typeof d.note!=='string')throw Error('草稿資料不符');}
  for(const d of v.decisions){decisions.set(d.id,{status:d.status,note:d.note});$('status-'+d.id).value=d.status;$('note-'+d.id).value=d.note;}
  $('draftStatus').textContent=`已讀回此瀏覽器暫存的${v.decisions.length}項紀錄。填完請匯出交回。`;
 }catch(err){$('draftStatus').textContent='無法讀回暫存草稿，請使用已匯出的JSON；原暫存未覆蓋。';}
}
$('cards').addEventListener('click',e=>{
 const b=e.target.closest('[data-accept]');if(!b)return;
 const c=byId.get(b.dataset.accept),status=c.category==='建議維持現況'?'維持現況':c.category==='缺稿先暫停'?'維持暫停':'依教師更正（詳註記）';
 const previous=decisions.get(c.id);
 if(previous&&(previous.note.trim()||previous.status!=='尚未確認')&&!confirm('這項已有確認內容，要以目前整合建議取代嗎？'))return;
 $('status-'+c.id).value=status;$('note-'+c.id).value='同意Codex與Claude整合建議：'+c.proposal;
 decisions.set(c.id,{status,note:$('note-'+c.id).value});dirty=true;saveDraft();filter();
});
restoreDraft();
