import argparse,json,re,unicodedata,hashlib
from pathlib import Path
from collections import Counter
parser=argparse.ArgumentParser(description='Verify the Grade 3 English alphabet-writing layouts.')
for name in ('originals','images','publisher-render-dir','output'): parser.add_argument('--'+name,type=Path,required=True)
args=parser.parse_args()
read=lambda p:json.loads(p.read_text(encoding='utf8'))
rows=read(args.originals)
media=read(args.images)
letters={'0020a3f1':['r','',''],'00704044':['V','',''],'00880c3c':['X','',''],'009e2da6':['','','W'],'0122c1e2':['','r',''],
 '01b79eb3':['O','',''],'023337d8':['','q',''],'03c3f8ae':['t','',''],'041ad176':['','x',''],'05a661d5':['P','','']}
blank_hashes=set()
for sid,slots in letters.items():
 for i,ch in enumerate(slots):
  if not ch:blank_hashes.add(media[sid]['images'][i]['sha256'])
assert blank_hashes and all(media[sid]['images'][i]['sha256'] not in blank_hashes for sid,slots in letters.items() for i,ch in enumerate(slots) if ch)
out=[]
for r in rows:
 label=r['labels'][0]
 if not label.startswith('Read and Write'):continue
 id=r['id'];orig=r['original'];key=orig['answer'];stem=orig['preamble-question']
 norm=lambda s:' '.join(unicodedata.normalize('NFKC',s).split())
 teacher=norm(key['text']).removeprefix('答案:').strip()
 answers=[n.strip() for n in teacher.split(';')]
 assert r['content']['content']['questions'][0]['answers']==[[n] for n in answers]
 assert all(hashlib.sha256(Path(d['path']).read_bytes()).hexdigest()==d['sha'] for d in orig.values())
 ims=media[id]['images']
 if id in letters:
  assert norm(stem['text'])=='/ / /' and len(ims)==3
  tiles=letters[id]
  assert all((x['sha256'] in blank_hashes)==(not tile) for tile,x in zip(tiles,ims))
  assert sum(bool(tile) for tile in tiles)==1 and len(answers)==2 and all(len(a)==1 for a in answers)
  i=next(i for i,t in enumerate(tiles) if t);start=ord(tiles[i])-i
  expected=[chr(start+j) for j in range(3)]
  assert [v for j,v in enumerate(expected) if j!=i]==answers
  n=iter(range(1,3))
  prompt='按英文字母順序填空，保持題目的大小寫。\n'+'　'.join(v or f'〔{next(n)}〕' for v in tiles)
  kind='slots'
  page=48 if r['sections']==['398850'] else 62
 else:
  assert len(ims)==1
  assert (args.publisher_render_dir/(id+'-publisher-render.private.webp')).exists()
  match=re.fullmatch(r'([A-Za-z]{4})\s*→\s*\x01',norm(stem['text']))
  assert match and len(answers)==1 and ''.join(sorted(match[1]))==answers[0] and len(set(match[1]))==4
  native=r['content']['content']['questions'][0]
  assert norm(native['stem']).startswith(match[1]+' →')
  prompt='請把下列四個字母按順序寫在答案欄，保持原來的大小寫。\n'+match[1]
  kind='order'
  page=48 if match[1][0].lower() in 'pqrs' else 62
 out.append({'passed':True,'id':id,'unit':{'398850':3,'398851':4,'398852':5}[r['sections'][0]],'kind':kind,
  'prompt':prompt,'answers':answers,'primary':page,'source_images':[a['sha256'] for a in ims]})
assert len(out)==14
args.output.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
print(Counter(r['kind'] for r in out))
