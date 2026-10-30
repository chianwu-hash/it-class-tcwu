"""產出含私有音檔參照的新不可變版本候選，不覆寫舊來源／既有版本。"""
import json,hashlib,copy,html
from pathlib import Path
import pymupdf
ROOT=Path('automation/output/past-exams-audio')
def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def write(p,v):Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def sha(data):return hashlib.sha256(data).hexdigest()
plan=read(ROOT/'plan.private.json');audio={m['id']:m for m in read(ROOT/'audio-manifest.private.json')}
summary=[]
for p in plan['papers']:
 folder=ROOT/p['paperId'];old=read(folder/'before-bundle.private.json');bundle=copy.deepcopy(old);owner=old['owner'];sources=read(folder/'source-pages.private.json')['sources'];assets=[];images=[];lookup={}
 for role,src in sources.items():assert sha(Path(src['original']).read_bytes())==src['originalSha256'] and sha(Path(src['pdf']).read_bytes())==src['pdfSha256']
 target=folder/'assets';target.mkdir(exist_ok=True)
 for c in p['crops']:
  source=sources[c['source']];doc=pymupdf.open(source['pdf']);page=doc[c['page']-1]
  if c.get('imageXref'):
   xref=c['imageXref'];assert xref in [i[0] for i in page.get_images()];box=page.get_image_rects(xref)[0];pix=page.get_pixmap(clip=box,dpi=300,alpha=False)
  else:box=pymupdf.Rect(c['bbox']);assert page.rect.contains(box);pix=page.get_pixmap(clip=box,dpi=300,alpha=False)
  raw=pix.tobytes('png');hash=sha(raw);file=target/(hash+'.png');file.write_bytes(raw);url=f'https://quiz-media.invalid/{owner}/{hash}'
  lookup[c['id']]={'url':url,'sha256':hash,'alt':c['alt']};assets.append({'hash':hash,'url':url,'owner_id':owner,'object_path':f'{owner}/{hash}','mime':'image/png','bytes':len(raw),'file':str(file.resolve())})
  images.append({**c,'bbox':list(box),'sha256':hash,'sourceSha256':source['originalSha256'],'width':pix.width,'height':pix.height,'file':str(file.resolve()),'renderMode':'embedded-bounds-page-render' if c.get('imageXref') else 'page-clip'});doc.close()
 newgroups=[];newentries=[];oldentries={e['id']:e for e in old['provenance']['entries']}
 for g in p['groups']:
  m=audio[g['audioTrack']];file=Path(m['file']);assert sha(file.read_bytes())==m['sha256'];audio_url=f'https://quiz-media.invalid/{owner}/{m["sha256"]}'
  assets.append({'hash':m['sha256'],'url':audio_url,'owner_id':owner,'object_path':f'{owner}/{m["sha256"]}','mime':'audio/mpeg','bytes':m['bytes'],'file':str(file.resolve())})
  out={k:g[k] for k in ['id','kind','title','sourceLabel','material','codes','notice']};out['assets']=[lookup[c] for c in g['assets']]
  out['materialContent']={'text':g['material'],'media':[{'kind':'audio','url':audio_url,'alt':g['title']+'｜合成語音練習版'}]};out['promptContent']={'text':g['fields'][0]['text'] if len(g['fields'])==1 else '', 'media':[]}
  out['choices']=[{'id':c['id'],'text':c['text'],'content':{'text':c['text'],'media':[{'kind':'image','url':lookup[a]['url'],'alt':lookup[a]['alt']} for a in c['assets']]}} for c in g['choices']]
  out['fields']=[{k:f[k] for k in ['id','label','text','points','answer']} for f in g['fields']]
  for f in g['fields']:
   e=copy.deepcopy(oldentries[f['id']]);assert e['points']==f['points'] and e['answerSource']['raw']==f['officialRaw'];e['type']=g['kind'];e['audioSource']={'trackId':m['id'],'sha256':m['sha256'],'scriptSha256':m['scriptSha256'],'source':m['source'],'synthetic':True};newentries.append(e)
  newgroups.append(out)
 restored=set(p['restoreIds']);bundle['document']['groups']=newgroups+old['document']['groups'];bundle['document']['blocked']=[f for f in old['document']['blocked'] if f['id'] not in restored]
 entries={e['id']:e for e in newentries};bundle['provenance']['entries']=[entries.get(e['id'],e) for e in old['provenance']['entries']]
 bundle['provenance']['audioRevision']={'policy':plan['policy'],'previousSha256':old['sha256'],'restoredFields':p['restoreIds'],'tracks':[m for m in audio.values() if m['paperId']==p['paperId']],'normalization':'製播移除答案圈號；語速-12%，每段兩次，段間2秒；未新增原稿未寫的內容。三年級B、D依官方紅字的明載內容製播；其餘無完整稿的題仍暫停。'}
 bundle['provenance']['issues'].append({'id':'audio-policy-20261030','questions':p['restoreIds'],'detail':plan['policy']+' 本次依官方文字稿自行製播，取代舊註記中「無原音一律暫停／不得TTS」的限制。未恢復的疑義與稿件缺漏仍保留。'})
 bundle['provenance']['qc']={'status':'awaiting-audio-qc','originalNonAudioQcPreserved':old['provenance'].get('qc',{}),'restoredFields':len(restored)}
 bundle['assets']=list({a['hash']:a for a in old['assets']+assets}.values());bundle['sha256']=sha(json.dumps(bundle['document'],ensure_ascii=False,separators=(',',':')).encode())
 assert len({f['id'] for g in bundle['document']['groups'] for f in g['fields']})==sum(len(g['fields']) for g in bundle['document']['groups'])
 assert {f['id'] for g in newgroups for f in g['fields']}==restored
 write(folder/'bundle.private.json',bundle);write(folder/'images-manifest.private.json',images)
 # 只供本機校對，官方稿不放學生文件。
 out=['<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>聽力製播校對</title><style>body{font:18px/1.7 system-ui;max-width:1100px;margin:30px auto;padding:20px}article{border:1px solid #abc;padding:20px;margin:20px 0}img{max-width:350px;max-height:300px}pre{white-space:pre-wrap}audio{width:100%}</style>',f'<h1>{html.escape(bundle["document"]["title"])}</h1><p>本機教師校對：含官方稿與答案，不公開。</p>']
 for g in p['groups']:
  m=audio[g['audioTrack']];t=next(t for t in plan['tracks'] if t['id']==m['id']);out.append(f'<article><h2>{html.escape(g["title"])}</h2><audio controls src="audio/{Path(m["file"]).name}"></audio><pre>'+html.escape('\n'.join(s['text'] for s in t['segments']))+'</pre>')
  for cid in g['assets']+[a for c in g['choices'] for a in c['assets']]:out.append('<img src="assets/'+lookup[cid]['sha256']+'.png" alt="'+html.escape(lookup[cid]['alt'],quote=True)+'">')
  out.append('<pre>'+html.escape(json.dumps(g['fields'],ensure_ascii=False,indent=2))+'</pre></article>')
 (folder/'preview.private.html').write_text('\n'.join(out)+'</html>',encoding='utf-8')
 summary.append({'paperId':p['paperId'],'oldSha256':old['sha256'],'newSha256':bundle['sha256'],'restoredFields':len(restored),'groupsAdded':len(newgroups),'remainingBlocked':len(bundle['document']['blocked'])})
write(ROOT/'candidates.private.json',summary);print(json.dumps(summary))
