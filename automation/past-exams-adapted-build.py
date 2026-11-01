"""兩份既有試卷的改編聽力候選；官方原記錄、舊作答及版本保留。"""
from pathlib import Path
import json,hashlib,copy,shutil,html
R=Path('automation/output/past-exams-adapted-listening-20261101');P=Path('.chat-mode/adapted-listening-20261101');read=lambda p:json.loads(Path(p).read_text(encoding='utf-8-sig'));save=lambda p,v:Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8');sha=lambda b:hashlib.sha256(b).hexdigest()
assert not (R/'candidates.private.json').exists(),'Do not overwrite frozen candidates'
reviews=[]
for worker in ['claude','agy']:
 sid=f'adapted-listening-{worker}-20261101';d=P/f'.chat-mode/sessions/{sid}';run=read(d/'turn-0001.run.json');assert run['status']=='completed' and run['conversationViewerStarted'];assert worker!='agy' or run['toolBoundaryVerified'];shutil.copyfile(d/'turn-0001.run.json',R/f'{worker}-run.private.json');shutil.copyfile(d/'turn-0001.response.md',R/f'{worker}-response.private.md');reviews.append({'worker':worker,'session':sid,'responseSha256':sha((d/'turn-0001.response.md').read_bytes()),'coverage':'four-original-pages' if worker=='claude' else 'supplied-text-only'})
plan=read(R/'plan.private.json');proposals=read(R/'script-proposals.private.json');audio={m['id']:m for m in read(R/'audio-manifest.private.json')};summary=[]
for year in [113,114]:
 pid=f'dingxi-{year}-1-g3-exam1-english';folder=R/pid;old=read(folder/'before-bundle.private.json');b=copy.deepcopy(old);owner=b['owner'];images=read(folder/'images-manifest.private.json');img={m['id']:m for m in images};restored=[];added=[];originals=[]
 def asset(h,file,mime):
  f=Path(file);assert sha(f.read_bytes())==h
  a={'hash':h,'url':f'https://quiz-media.invalid/{owner}/{h}','owner_id':owner,'object_path':f'{owner}/{h}','mime':mime,'bytes':f.stat().st_size,'file':str(f.resolve())}
  if not any(x['hash']==h for x in b['assets']):b['assets'].append(a)
  return a
 for m in images:asset(m['hash'],m['file'],'image/png')
 order={e['id']:i for i,e in enumerate(old['provenance']['entries'])};groups=[];newentries={}
 for p in [r for r in proposals if r['paperId']==pid]:
  qid=p['id'];blocked=next(f for f in old['document']['blocked'] if f['id']==qid);e=copy.deepcopy(next(e for e in old['provenance']['entries'] if e['id']==qid));originals.append(copy.deepcopy(e));restored.append(qid)
  tid=pid+'__adapted-'+p['section']+str(p['number']);m=audio[tid];a=asset(m['sha256'],m['file'],'audio/mpeg');stem='仔細聽，選出聽到的字母。' if p['section']=='A' else '仔細聽，選出聽到的單字字首音。'
  g={'id':qid,'kind':'single','title':f'{p["section"]} 聽力・'+('字母' if p['section']=='A' else '字首音' if p['section']=='C' else '選圖與拼字')+f' {p["number"]}','sourceLabel':f'{p["section"]}、{p["number"]}','material':stem,'codes':[],'assets':[],'materialContent':{'text':stem,'media':[{'kind':'audio','url':a['url'],'alt':f'{p["section"]}第{p["number"]}題｜改編聽力練習版'}]},'promptContent':{'text':stem,'media':[]},'notice':'改編聽力練習版｜依原題及解答重新編製，非官方聽力稿或原音；每段播讀兩次，可重播。','choices':[],'fields':[]}
  if p['section'] in ['A','C']:
   import re
   parts=re.split('[①②③④]',p['original']['text']);opts=[x.strip() for x in parts[1:]];assert len(opts)==(4 if p['section']=='A' else 3)
   answer=re.match(r'\d',p['original']['raw']).group();g['choices']=[{'id':str(i+1),'text':v,'content':{'text':v,'media':[]}} for i,v in enumerate(opts)]
   prompt=stem if p['section']=='A' else re.search(r'_+[a-z]+',parts[0]).group();g['promptContent']['text']=prompt;g['fields']=[{'id':qid,'label':str(p['number']),'text':prompt,'points':blocked['points'],'answer':answer}]
   target=opts[int(answer)-1];assert target.lower()==p['target'].lower() if p['section']=='A' else p['target'].startswith(target.lower())
   if year==114 and p['section']=='A' and p['number'] in [1,2]:g['notice']+=' 原試卷與解答卷的選項不一致，本改編版採原試卷選項，請依本段音檔作答。'
  else:
   g['kind']='short';g['material']='仔細聽，依音檔選出圖片並拼寫數字單字。';g['materialContent']['text']=g['material'];g['promptContent']['text']='先填圖片代號，再拼寫英文數字。';g['notice']+=' 改編配分：選圖2分、填字2分；原卷每題4分未分列。'
   correct='1' if year==113 or p['number']==3 else '2';picture=qid+'-picture';added.append(picture)
   for oi,pos in [(1,'左圖'),(2,'右圖')]:
    im=img[f'E{p["number"]}-{oi}'];g['choices'].append({'id':str(oi),'text':pos,'content':{'text':pos,'media':[{'kind':'image','url':f'https://quiz-media.invalid/{owner}/{im["hash"]}','alt':im['alt']}]}})
   accepted=['1','①','左','左圖'] if correct=='1' else ['2','②','右','右圖'];word=p['target'];g['fields']=[{'id':picture,'label':'選圖','text':'圖片代號：左圖填1，右圖填2','points':2,'answer':accepted},{'id':qid,'label':'拼字','text':'聽到的英文數字單字（請用小寫）','points':2,'answer':[word,word.capitalize(),word.upper()]}]
   assert blocked['points']==4;e['points']=2;e['adaptedRubric']={'originalId':qid,'originalPoints':4,'originalSplitProvided':False,'onlinePictureId':picture,'picturePoints':2,'wordPoints':2,'policy':'改編配分2+2，非官方細則；原條目保留於adaptedListeningRevision.originalEntries'}
   pic=copy.deepcopy(e);pic['id']=picture;pic['type']='short';newentries[picture]=pic
  e['type']=g['kind'];e['audioSource']={'trackId':tid,'sha256':m['sha256'],'scriptSha256':m['scriptSha256'],'origin':'adapted','officialScriptAvailable':False,'synthetic':True,'source':m['source']};newentries[qid]=e
  if p['section']=='E':newentries[picture]['audioSource']=copy.deepcopy(e['audioSource'])
  groups.append(g)
 for g in groups:
  pos=order[g['id']];i=next((i for i,x in enumerate(b['document']['groups']) if order.get(x['fields'][0]['id'],order.get(x['id'],9999))>pos),len(b['document']['groups']));b['document']['groups'].insert(i,g)
 b['document']['blocked']=[f for f in old['document']['blocked'] if f['id'] not in restored];b['document']['title']=old['document']['title']+'（含改編聽力練習）'
 entries=[]
 for e in old['provenance']['entries']:
  if e['id']+'-picture' in newentries:entries.append(newentries[e['id']+'-picture'])
  entries.append(newentries.get(e['id'],e))
 b['provenance']['entries']=entries;b['provenance']['adaptedListeningRevision']={'policy':plan['policy'],'previousSha256':old['sha256'],'originalDocumentTitle':old['document']['title'],'reviews':reviews,'originalEntries':originals,'restoredOriginalIds':restored,'addedPictureIds':added,'scoring':'A/C每題2分；E每題選圖2分+拼字2分，明示改編，總分保留；拼字收小寫、首大寫、全大寫，不改全域大小寫。','tracks':[t for t in plan['tracks'] if t['paperId']==pid]}
 b['provenance']['qc']={'status':'awaiting-adapted-audio-qc','previous':old['provenance']['qc']}
 for g in old['document']['groups']:assert next(x for x in b['document']['groups'] if x['id']==g['id'])==g
 assert len(restored)==13 and len(added)==3 and not b['document']['blocked'];assert sum(f['points'] for g in groups for f in g['fields'])==32
 b['sha256']=sha(json.dumps(b['document'],ensure_ascii=False,separators=(',',':')).encode());save(folder/'bundle.private.json',b);summary.append({'paperId':pid,'oldSha256':old['sha256'],'newSha256':b['sha256'],'restoredIds':restored,'addedFieldIds':added,'groupsAdded':13,'remainingBlocked':0})
 preview=['<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>改編聽力製播校對</title><style>body{font:18px/1.7 system-ui;max-width:1000px;margin:auto;padding:24px}article{border:1px solid #acc;padding:20px;margin:18px 0}img{max-width:260px;max-height:200px}audio{width:100%}</style>',f'<h1>{html.escape(b["document"]["title"])}</h1><p>本機校對資料：含自行編製稿與答案，不是官方聽力稿；本頁不公開。</p>']
 for g in groups:
  t=next(t for t in plan['tracks'] if t['questionId']==g['id'] and t['paperId']==pid);m=audio[t['id']];preview.append('<article><h2>'+html.escape(g['title'])+'</h2><audio controls src="audio/'+Path(m['file']).name+'"></audio><p>'+html.escape(t['segments'][0]['text'])+'</p>')
  for c in g['choices']:
   preview.append('<p>'+html.escape(c['id']+' '+c['text'])+'</p>')
   for im in c['content']['media']:preview.append('<img src="assets/'+im['url'].split('/')[-1]+'.png" alt="'+html.escape(im['alt'])+'">')
  preview.append('<p>線上核對：'+html.escape(json.dumps(g['fields'],ensure_ascii=False))+'</p></article>')
 (folder/'preview.private.html').write_text('\n'.join(preview)+'</html>',encoding='utf-8')
save(R/'candidates.private.json',summary);print(json.dumps({'papers':2,'restoredOriginalFields':26,'newOnlineFields':32,'points':64}))
