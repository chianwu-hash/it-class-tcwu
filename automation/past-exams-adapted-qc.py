"""無提示回辨＋兩遍波形相似度，不能把錯詞任意替換當通過。"""
from pathlib import Path
import json,re,hashlib,subprocess,array,math
from datetime import datetime,timezone
import imageio_ffmpeg
R=Path('automation/output/past-exams-adapted-listening-20261101');read=lambda p:json.loads(Path(p).read_text(encoding='utf-8-sig'));save=lambda p,v:Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8');sha=lambda b:hashlib.sha256(b).hexdigest()
plan=read(R/'plan.private.json');audio=read(R/'audio-manifest.private.json');asr=read(R/'asr.private.json');assert asr['complete'] and len(asr['results'])==26 and len(audio)==26
digits={'3':'three','6':'six','7':'seven','8':'eight','9':'nine','10':'ten'}
def canon(text):
 words=re.findall('[a-z]+|[0-9]+',text.lower());return ' '.join(digits.get(w,w) for w in words)
checks=[];ff=imageio_ffmpeg.get_ffmpeg_exe()
for t in plan['tracks']:
 m=next(x for x in audio if x['id']==t['id']);r=next(x for x in asr['results'] if x['id']==t['id']);assert sha(Path(m['file']).read_bytes())==m['sha256']==r['sha256'];assert m['scriptSha256']==sha(json.dumps(t,ensure_ascii=False,separators=(',',':')).encode())
 expected=canon(' '.join(s['text'] for s in t['segments']));actual=canon(r['transcription']);assert actual in [expected,expected+' '+expected],(t['id'],expected,actual)
 run=subprocess.run([ff,'-hide_banner','-loglevel','error','-i',m['file'],'-f','s16le','-ac','1','-ar','24000','-'],capture_output=True);assert run.returncode==0;v=array.array('h',run.stdout);assert (len(v)-24000)%2==0;half=(len(v)-24000)//2;a=v[12000:12000+half];b=v[12000+half:12000+2*half]
 dot=sum(x*y for x,y in zip(a,b));norm=math.sqrt(sum(x*x for x in a)*sum(y*y for y in b));correlation=dot/norm;assert correlation>.99,(t['id'],correlation)
 assert m['rms']>50 and m['peak']<32767 and m['repeat']==2;checks.append({'id':t['id'],'sha256':m['sha256'],'transcription':r['transcription'],'exactContent':True,'twoRepeatCorrelation':round(correlation,6),'normalization':'僅標點/大小寫與數字字形；Whisper合併重複時用兩遍波形一致性核對；不將sex改成six。'})
papers={}
numberReview=read(R/'claude-number-review.private.json');assert numberReview['status']=='completed';numberReviewSha=sha((R/'claude-number-review.private.md').read_bytes())
for c in read(R/'candidates.private.json'):
 folder=R/c['paperId'];b=read(folder/'bundle.private.json');old=read(folder/'before-bundle.private.json');assert not b['document']['blocked']
 for g in old['document']['groups']:assert next(x for x in b['document']['groups'] if x['id']==g['id'])==g
 for a in b['assets']:assert sha(Path(a['file']).read_bytes())==a['hash']
 if not any(x.get('turn')==2 for x in b['provenance']['adaptedListeningRevision']['reviews']):b['provenance']['adaptedListeningRevision']['reviews'].append({'worker':'claude','session':'adapted-listening-claude-20261101','turn':2,'responseSha256':numberReviewSha,'decision':'E六段統一The number is...，重製重驗，不把sex正規化為six。'})
 b['provenance']['qc']={'status':'verified','previous':old['provenance']['qc'],'edition':'改編聽力練習版，非官方稿或原音','audio':'26段small無提示逐字內容核對；數字字形正規化、兩遍波形相關>.99；未宣稱真人聽審。','images':'原卷12張必要選圖已檢視接觸表；原嵌入圖、smask、仿射方向及白底，未裁入官方答案或鄰題框線。','rubric':'E圖/字各2分，改編細分並明示；原卷4分未分列，原ledger另存。','reviews':['Claude四原頁與26稿','AGY供給文字','Claude第二輪同意E自然數字短句']};save(folder/'bundle.private.json',b);papers[b['paperId']]=b['sha256']
save(R/'audio-qc.private.json',{'passed':True,'papers':papers,'audioTracks':26,'images':12,'checks':checks,'at':datetime.now(timezone.utc).isoformat()});print(json.dumps({'passed':True,'tracks':26,'images':12}))
