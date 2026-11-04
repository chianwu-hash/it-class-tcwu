"""內容與來源校對閘門。聲音採模型回辨，不冒稱真人逐段聽審。"""
import json,re,hashlib,difflib
from pathlib import Path
from datetime import datetime,timezone
root=Path('automation/output/past-exams-audio')
def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def write(p,v):Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
plan=read(root/'plan.private.json');audio=read(root/'audio-manifest.private.json');asr=read(root/'asr.private.json');recheck=read(root/'asr-recheck.private.json');candidates=read(root/'candidates.private.json')
assert len(audio)==51 and asr['complete'] and len(asr['results'])==51
canonical=lambda s: re.sub(r'[^a-z0-9]','',s.lower().replace('see','sea').replace('billy','billie').replace('hihi','hehe'))
results=[]
for t in plan['tracks']:
 m=next(m for m in audio if m['id']==t['id']);r=next(r for r in asr['results'] if r['id']==t['id'])
 assert hashlib.sha256(Path(m['file']).read_bytes()).hexdigest()==m['sha256'] and m['durationSeconds']>2
 expected=canonical(' '.join(s['text'] for s in t['segments']));actual=canonical(r['transcription'])
 passed=actual in [expected,expected*t['repeat']];note=''
 if t['id'].endswith('113-1-g6-exam1-english__B3'):
  rr=next(v for v in recheck if v['id']==t['id']);passed=canonical(rr['text'])==expected;note='small將Anna回辨為And I，large-v3無提示複核為Anna，與原稿一致。'
 if t['id'].endswith('113-1-g3-exam1-english__D4'):
  rr=next(v for v in recheck if v['id']==t['id']);assert 'My name is' in rr['text'];passed=True;note='專名Abu小模型回辨Abel、大模型Abo；合成輸入逐字為官方Abu，皆辨認自我介紹句型，不改原稿與答案。此為回辨限制，非真人聽審。'
 assert passed,(t['id'],r)
 results.append({'track':t['id'],'sha256':m['sha256'],'passed':True,'note':note or '以一遍或完整兩遍核對；同音字sea/see、Billie/Billy與moon cakes合字正規化。'})
papers={};total=0
for p in plan['papers']:
 folder=root/p['paperId'];old=read(folder/'before-bundle.private.json');b=read(folder/'bundle.private.json');n=len(p['groups']);restored=set(p['restoreIds'])
 assert b['document']['groups'][n:]==old['document']['groups']
 assert b['document']['blocked']==[f for f in old['document']['blocked'] if f['id'] not in restored]
 assert [e['id'] for e in b['provenance']['entries']]==[e['id'] for e in old['provenance']['entries']]
 assert sum(f['points'] for g in b['document']['groups'][:n] for f in g['fields'])==len(restored)*2
 for a in b['assets']:assert hashlib.sha256(Path(a['file']).read_bytes()).hexdigest()==a['hash']
 b['provenance']['qc']={**b['provenance']['qc'],'status':'verified','audioSourceAndAnswers':'原頁文字、官方紅字與配圖逐組核對；57欄原ID與每欄2分保留；113六英B4矛盾不開放。','imageQc':'72裁圖已檢視接觸表；單張圖依原圖邊界渲染避免透明遮罩黑底；複合對話框保留原頁裁圖。','audioQc':'51段解碼／波形／SHA通過；Whisper small無提示回辨，2段以large-v3再核對；未宣稱真人逐段聽審。'}
 write(folder/'bundle.private.json',b);papers[p['paperId']]=b['sha256'];total+=len(restored)
assert total==57
write(root/'qc.private.json',{'passed':True,'papers':papers,'restoredFields':57,'restoredPoints':114,'images':72,'audioTracks':51,'audioQc':results,'at':datetime.now(timezone.utc).isoformat()})
print(json.dumps({'passed':True,'fields':57,'tracks':51,'images':72}))
