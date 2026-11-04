"""產出聽力更新後的新審閱快照；不覆寫教師正在填寫的舊頁面或匯出紀錄。"""
from pathlib import Path
import copy,json
from datetime import datetime
from zoneinfo import ZoneInfo
base=Path('automation/output');out=base/'past-exams-review-20261030';audio=base/'past-exams-audio'
read=lambda p:json.loads(Path(p).read_text(encoding='utf-8-sig'))
assert read(audio/'cloud/live-data.private.json')['passed']
data=copy.deepcopy(read(out/'review-data.private.json'));plan=read(audio/'plan.private.json');bundles={p['paperId']:read(audio/p['paperId']/'bundle.private.json') for p in plan['papers']};cards=[]
for c in data['cards']:
 if c['paperId'] in bundles:
  b=bundles[c['paperId']];c['bundleSha256']=b['sha256']
  if c['category']=='缺少原音':
   remaining={f['id'] for f in b['document']['blocked']};c['questionIds']=[q for q in c['questionIds'] if q in remaining]
   if not c['questionIds']:continue
   c['questions']=[{**q,'fields':[f for f in q['fields'] if f['id'] in remaining]} for q in c['questions'] if any(f['id'] in remaining for f in q['fields'])]
   points=sum(f['points'] for q in c['questions'] for f in q['fields']);c['category']='聽力待確認';c['title']=f'聽力仍暫停{len(c["questionIds"])}欄／{points}分'
   c['reason']='有官方完整文字稿且答案無矛盾的部分已製播並上線。以下僅列仍缺完整發話內容，或官方文字與配圖答案矛盾的欄位；不從答案反推錄音稿。'
   c['ask']='請補完整發話內容，或確認原題與官方答案矛盾該如何修正；既有無疑義部分已開放，不需重複核准。'
  elif c['category']=='校對歷程':
   c['related'].append({'id':'audio-policy-20261030','questions':next(p['restoreIds'] for p in plan['papers'] if p['paperId']==c['paperId']),'detail':'使用者已核准有稿自行製播；本次無疑義部分已上線。早期無原音不得TTS的處理限制已被新決定取代。'})
  elif c['category']=='其他待覆核':c['reason']='【聽力政策已更新：有稿可製播，無疑義部分已上線。以下保留原卷內容／配分疑義供確認，舊文中的缺原音限制已取代。】\n'+c['reason']
 cards.append(c)
data.update(createdAt=datetime.now(ZoneInfo('Asia/Taipei')).isoformat(),blockedFields=41,audioFields=27,cards=cards)
for p in data['papers']:
 if p['id'] in bundles:p['sha256']=bundles[p['id']]['sha256']
assert sum(len(c['questionIds']) for c in cards if c['category']=='聽力待確認')==27
template=Path('automation/past-exams-review-template.html').read_text(encoding='utf-8').replace('<b>84</b>缺原音聽力欄位','<b>27</b>聽力待確認欄位').replace('缺少原音','聽力待確認').replace('缺音檔區每卷合併一組','聽力待確認區每卷合併一組')
template=template.replace('<p id="scope"></p>','<p id="scope"></p><p><strong>聽力更新版：57個欄位已恢復，剩41欄待確認。</strong>有稿且無矛盾即製播；缺稿或答案衝突仍暫停。原審閱頁及已匯出確認紀錄保留，不覆寫。</p>')
(out/'review-data-audio-update.private.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
target=out/'考古題疑義審閱-聽力更新版.html';target.write_text(template.replace('__REVIEW_DATA__',json.dumps(data,ensure_ascii=False).replace('<',chr(92)+'u003c')),encoding='utf-8')
print(json.dumps({'remainingBlocked':41,'listening':27,'other':14,'cards':len(cards),'output':str(target.resolve())},ensure_ascii=False))
