"""產生教師本機疑義審閱包；只讀已發布版本及原檔，不連線或改題。"""
import hashlib,html,json,re,shutil
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import pymupdf

BASE=Path('automation/output');OUT=BASE/'past-exams-review-20261030';OUT.mkdir(exist_ok=True)
def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def write(p,v):Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def digest(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
scope=read(BASE/'past-exams-midterms/publication-scope.json');papers={};cards=[];files={};pagecache={}
released={**read(BASE/'past-exams-midterms/cloud/registered.private.json')['papers'],**{v['paper_id']:v['sha256'] for v in read(BASE/'past-exams-midterms/cloud/before-versions.private.json')}}
pilot=read(BASE/'past-exam-production/source.private.json')
for pid in scope['paperIds']:
 folder=next((BASE/root/pid for root in ['past-exams-midterms','past-exams-batch'] if (BASE/root/pid/'bundle.private.json').exists()),BASE/'past-exam-production')
 b=read(folder/'bundle.private.json');assert b['paperId']==pid and b['sha256']==released[pid]
 if (folder/'source-pages.private.json').exists():sources=read(folder/'source-pages.private.json')['sources']
 else:sources={('paper' if f['kind']=='試卷' else 'key'):{'original':f['path'],'originalSha256':f['sha256'],'pdf':f['path'],'pdfSha256':f['sha256']} for f in pilot['exam']['sourceFiles']}
 for role,src in sources.items():
  assert digest(src['original'])==src['originalSha256']
  expected=next(f['sha256'] for f in b['provenance']['sourceFiles'] if f['fileId']==role);assert src['originalSha256']==expected
  assert digest(src['pdf'])==src['pdfSha256']
  target=OUT/'sources'/pid;target.mkdir(parents=True,exist_ok=True)
  pdf=target/(role+'.pdf');shutil.copyfile(src['pdf'],pdf)
  original=target/(role+'-original'+Path(src['original']).suffix.lower());shutil.copyfile(src['original'],original)
  src['href']=pdf.relative_to(OUT).as_posix();src['originalHref']=original.relative_to(OUT).as_posix()
  files[str(original.relative_to(OUT))]=src['originalSha256'];files[str(pdf.relative_to(OUT))]=src['pdfSha256']
 inv=next(x for x in read(BASE/'past-exams-midterms/inventory.private.json')['pairs'] if x['paperId']==pid)
 entries={e['id']:e for e in b['provenance']['entries']}
 draft=read(folder/'reviewed.private.json') if (folder/'reviewed.private.json').exists() else None
 blocked={f['id']:f for f in b['document']['blocked']}
 title=f"{inv['year'].replace('-1','上')} {'三' if inv['grade']==3 else '六'}年級 {inv['subject']} 期中"
 papers[pid]={'id':pid,'title':title,'grade':inv['grade'],'year':inv['year'],'subject':inv['subject'],'edition':inv['edition'],'range':inv['range'],'bundle':b,'sources':sources,'entries':entries,'draft':draft,'blocked':blocked,'folder':folder}

def evidence(p,role,page):
 key=(p['id'],role,page)
 if key not in pagecache:
  doc=pymupdf.open(p['sources'][role]['pdf']);assert 1<=page<=len(doc)
  target=OUT/'pages'/p['id'];target.mkdir(parents=True,exist_ok=True);file=target/f'{role}-{page:03}.jpg'
  doc[page-1].get_pixmap(dpi=155,alpha=False).save(file);doc.close()
  pagecache[key]={'role':role,'page':page,'image':file.relative_to(OUT).as_posix(),'pdf':p['sources'][role]['href']+f'#page={page}'}
 return pagecache[key]

def groups_for(p,ids):
 groups=p['bundle']['document']['groups'];return [g for g in groups if any(q==g['id'] or any(q==f['id'] for f in g['fields']) for q in ids)]

def payload(p,ids):
 entries=p['entries'];questions=[];pages=set();seen=set()
 for g in groups_for(p,ids):
  qs=[f for f in g['fields'] if f['id'] in ids or g['id'] in ids]
  if not qs:continue
  images=[]
  for a in g.get('assets',[]):
   matches=[v for v in p['bundle']['assets'] if v['url']==a['url']]
   if matches:
    dest=OUT/'figures'/Path(matches[0]['file']).name;dest.parent.mkdir(exist_ok=True)
    if not dest.exists():shutil.copyfile(matches[0]['file'],dest)
    images.append({'image':dest.relative_to(OUT).as_posix(),'alt':a.get('alt','原題圖表')})
  choices=[]
  for c in g.get('choices',[]):
   media=[]
   for m in c.get('content',{}).get('media',[]):
    a=next((v for v in p['bundle']['assets'] if v['url']==m.get('url')),None)
    if a:
     dest=OUT/'figures'/Path(a['file']).name;dest.parent.mkdir(exist_ok=True)
     if not dest.exists():shutil.copyfile(a['file'],dest)
     media.append(dest.relative_to(OUT).as_posix())
   choices.append({'id':c['id'],'text':c.get('text',''),'images':media})
  for f in qs:
   e=entries[f['id']];seen.add(f['id']);pages|={('paper',e['source']['page']),('key',e['answerSource']['page'])}
  questions.append({'group':g['sourceLabel'] if g.get('sourceLabel') else g['title'],'material':g.get('material',''),'prompt':g.get('promptContent',{}).get('text',''),'choices':choices,'images':images,'fields':[{'id':f['id'],'text':f['text'],'points':f['points'],'raw':str(entries[f['id']]['answerSource']['raw']),'reference':f.get('reference',''),'referenceStatus':f.get('referenceStatus',''),'paperPage':entries[f['id']]['source']['page'],'keyPage':entries[f['id']]['answerSource']['page']} for f in qs]})
 for qid in ids:
  if qid in seen:continue
  if qid in p['blocked']:
   f=p['blocked'][qid];e=entries[qid];text=f['text']
   if p['id']==pilot['exam']['id']:text=next(x['rawTranscription'] for x in pilot['entries'] if x['id']==qid)
   pages|={('paper',e['source']['page']),('key',e['answerSource']['page'])}
   common=''
   if p['id']=='dingxi-113-1-g6-exam1-math' and qid.startswith('d6-'):common=next(g['material'] for g in p['bundle']['document']['groups'] if g['id']=='d6-r1')
   questions.append({'group':qid,'material':common,'prompt':'','choices':[],'images':[],'fields':[{'id':qid,'text':text,'points':f['points'],'raw':str(e['answerSource']['raw']),'reference':'','referenceStatus':'','paperPage':e['source']['page'],'keyPage':e['answerSource']['page']}]})
 return questions,pages

def add(p,category,ids,reason,ask,title=None,extra=None):
 questions,pages=payload(p,ids)
 if extra:pages|=set(extra)
 prefixes={'暫停・待確認':'P','缺少原音':'A','參考答案':'R','其他待覆核':'C','校對歷程':'H'}
 num=sum(c['category']==category for c in cards)+1;cid=f'{prefixes[category]}{num:02}'
 related=[i for i in p['bundle']['provenance'].get('issues',[]) if set(ids)&set(i.get('questions',[]))]
 heading=(questions[0]['group']+'｜'+questions[0]['fields'][0]['text'][:65]) if questions else '、'.join(ids)
 card={'id':cid,'paperId':p['id'],'paper':p['title'],'grade':p['grade'],'year':p['year'],'subject':p['subject'],'category':category,'title':title or heading,'questionIds':ids,'reason':reason,'ask':ask,'questions':questions,'related':related,'pages':[evidence(p,r,n) for r,n in sorted(pages)],'bundleSha256':p['bundle']['sha256']}
 cards.append(card);return card

# 現行暫停名單以實際文件blocked為準，不把舊草稿的「曾暫停」當現況。
audio_total=0;blocked_total=0
for p in papers.values():
 audio=[]
 for qid,f in p['blocked'].items():
  blocked_total+=1
  if re.search('音檔|原音|聽力',f['reason']):audio.append(qid)
  else:
   reasons=[f['reason']]+[x['detail'] for x in p['bundle']['provenance'].get('issues',[]) if qid in x.get('questions',[])]
   add(p,'暫停・待確認',[qid],'\n\n'.join(dict.fromkeys(reasons)),'請確認正確答案、題幹是否需更正，或維持暫停；若更正請寫出答案及適用範圍。')
 if audio:
  audio_total+=len(audio)
  add(p,'缺少原音',audio,f'本卷{len(audio)}個欄位缺少原始聽力音檔；有官方答案／書面稿也不能還原原音。表格逐題保留官方記號，原卷與解答原頁附後。','請確認是否能補原始音檔；尚未補齊時維持暫停。選項與錄音稿另外有矛盾者也列在「其他待覆核」。',title=f'聽力共{len(audio)}欄／{sum(p["blocked"][q]["points"] for q in audio):g}分',extra=[('key',n) for n in range(1,len(pymupdf.open(p['sources']['key']['pdf']))+1)])

# 官方空白與不完整參考：目前為manual，不可誤標暫停。
for p in papers.values():
 blank=[]
 for g in p['bundle']['document']['groups']:
  for f in g['fields']:
   if f.get('referenceStatus')=='not_provided':blank.append(f['id'])
   elif f.get('referenceStatus')=='partial':add(p,'參考答案',[f['id']],'官方參考僅有部分內容，或過程與原題不一致。目前仍可作答，採自我核對，不自動判分。','可補教師參考答案或訂正過程；也可保留官方可辨內容與原限制。',title=f"{g.get('sourceLabel',g['title'])}｜官方參考不完整")
 if blank:add(p,'參考答案',blank,'官方未提供參考答案。以下開放題目前仍可作答、自我核對，不列自動對錯；不是暫停題。','如要新增教師參考答案，請逐題提供；若維持開放自我核對，請註記即可。',title=f'官方參考留白，共{len(blank)}個作答欄')

# 仍值得教師確認的內容／配分／接受答案範圍。原始歷程完整附錄，避免重提已解決裁圖或格式問題。
selection={
 'dingxi-113-1-g3-exam1-chinese':['issue-2'],
 'dingxi-113-1-g3-exam1-math':['issue-1','issue-3','issue-5'],
 'dingxi-113-1-g3-exam1-science':['issue-2'],
 'dingxi-113-1-g6-exam1-chinese':['issue-7'],
 'dingxi-113-1-g6-exam1-english':['issue-2','issue-4','issue-6'],
 'dingxi-113-1-g6-exam1-math':['issue-1','issue-2','issue-4'],
 'dingxi-113-1-g6-exam1-science':['issue-3'],
 'dingxi-113-1-g6-exam1-social':['issue-3','issue-4'],
 'dingxi-114-1-g3-exam1-english':['issue-2','issue-3','issue-4'],
 'dingxi-114-1-g3-exam1-math':['issue-7'],
 'dingxi-114-1-g3-exam1-social':['issue-5'],
 'dingxi-114-1-g6-exam1-science':['issue-2','issue-6'],
}
for pid,issueids in selection.items():
 p=papers[pid]
 for iid in issueids:
  issue=next(i for i in p['bundle']['provenance']['issues'] if i['id']==iid)
  ids=[]
  for q in issue.get('questions',[]):
   if q in p['entries'] or groups_for(p,[q]):ids.append(q)
   else:ids.extend(g['id'] for g in p['bundle']['document']['groups'] if g['id'].startswith(q+'-'))
  extra=[]
  if pid.endswith('g6-exam1-english') and iid=='issue-2':extra=[('paper',5),('key',5)]
  if pid.endswith('g6-exam1-math') and iid=='issue-1':extra=[('paper',1),('key',1)]
  if ids:add(p,'其他待覆核',list(dict.fromkeys(ids)),issue['detail'],'請確認原卷的解讀、配分或可接受答案；可回覆維持現況，或逐題提供修正。',title=iid+'｜'+issue['detail'][:55],extra=extra)

for p in papers.values():
 issues=p['bundle']['provenance'].get('issues',[])
 if not issues:continue
 card=add(p,'校對歷程',[],'完整保留本卷歷程。部分內容是早期草稿提出的問題，已在後續QC解決；現行暫停狀態以P／A類及逐題blocked為準，不能由這些舊文字推斷。','此區供追溯，不需重複核准已完成的格式與裁圖工作。',title=f'全卷{len(issues)}則來源／轉接註記')
 card['related']=issues
 for role,src in p['sources'].items():card['pages'] += [evidence(p,role,n) for n in range(1,len(pymupdf.open(src['pdf']))+1)]

categories=['暫停・待確認','其他待覆核','缺少原音','參考答案','校對歷程']
cards.sort(key=lambda c:(categories.index(c['category']),c['id']))
assert blocked_total==98 and audio_total==84
assert sum(len(c['questionIds']) for c in cards if c['category']=='暫停・待確認')==14
data={'createdAt':datetime.now(ZoneInfo('Asia/Taipei')).isoformat(),'scope':'113／114上學期期中；三、六年級，共20卷。期末未開放卷不在這次題目審閱範圍。','blockedFields':blocked_total,'audioFields':audio_total,'nonAudioBlockedFields':14,'cards':cards,'papers':[{k:p[k] for k in ['id','title','grade','year','subject','edition','range']}|{'sha256':p['bundle']['sha256'],'sources':{r:{k:v[k] for k in ['href','originalHref','originalSha256','pdfSha256']} for r,v in p['sources'].items()}} for p in papers.values()]}
write(OUT/'review-data.private.json',data);write(OUT/'source-manifest.private.json',files)
template=Path('automation/past-exams-review-template.html').read_text(encoding='utf-8')
(OUT/'考古題疑義審閱.html').write_text(template.replace('__REVIEW_DATA__',json.dumps(data,ensure_ascii=False).replace('<',chr(92)+'u003c')),encoding='utf-8')
counts={c:sum(x['category']==c for x in cards) for c in categories}
(OUT/'README.md').write_text('# 考古題疑義審閱包\n\n請開啟「考古題疑義審閱.html」。以頁面篩選及原頁對照為主；確認結果匯出成Markdown後，該匯出檔為你的確認紀錄。頁面不自動修改線上題庫，也不在瀏覽器保存學生資料。\n\n98個暫停欄位＝84缺原音＋14其他待確認。官方空白／部分參考屬manual開放題，另列。原始PDF、轉檔PDF與來源SHA保留；原頁僅渲染，未修改內容。\n\n範圍：'+data['scope']+'\n\n快速回覆範例：P01 正解為…；P02 維持暫停；C01…。\n\n'+json.dumps(counts,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'papers':len(papers),'blocked':blocked_total,'audio':audio_total,'cards':counts,'pages':len(pagecache),'output':str(OUT.resolve())},ensure_ascii=False))
