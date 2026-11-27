import json,hashlib,re,unicodedata
from collections import Counter
from pathlib import Path
import argparse
import pymupdf
parser = argparse.ArgumentParser(description="Verify Word sentence tiles and textbook evidence.")
for name in ("originals", "images", "textbook-dir", "output"):
    parser.add_argument("--" + name, type=Path, required=True)
args = parser.parse_args()
book = args.textbook_dir
read = lambda p: json.loads(p.read_text(encoding="utf-8"))
paths = read(args.images)
rows = [r for r in read(args.originals) if r["labels"][0].startswith("Unscramble")]
GUIDE_SHA = "b803bf7cce412d52607af067d30d6c43b8ee91a1d375c237da180d237b575f94"
anchors={
 '0111c70d':[(61,['it is red'])],
 '01d5b195':[(44,["it's an eraser"])],
 '02451b6c':[(55,['black']),(45,['marker'])],
 '0350aac4':[(55,['good morning'])],
 '03e7594f':[(42,["what's that"])],
 '042c4e64':[(64,["yellow","what color is it"])],
 '0448a9f6':[(46,['good job'])],
 '053aed14':[(42,["what's this"])],
 '058b65db':[(58,['what color is it'])],
 '05e22d1b':[(47,["it's a pencil"])],
}
def norm(t):
 return " ".join(unicodedata.normalize('NFKC',t).replace('’',"'").replace('��',"'").split())
def words(t):
 return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|[.!?]",norm(t))
def require(ok,reason):
 if not ok:raise ValueError(reason)
out=[]
for r in rows:
 sid=r['id'];o=r['original'];word=o['preamble-question'];teacher=o['answer']
 try:
  require(all(hashlib.sha256(Path(d['path']).read_bytes()).hexdigest()==d['sha'] for d in o.values()),'original_sha')
  parsed=word['text'].strip().split('\x0b')
  require(len(parsed)==4 and [x.strip() for x in parsed[1:]]==['/','','/'],'word_answer_lines')
  tiles=[norm(t) for t in parsed[0].split('/')]
  require(3<=len(tiles)<=8 and len(tiles)==len(set(tiles)) and all(words(t)==[t] for t in tiles),'tile_order_shape')
  require(word['inline_images']==2 and not word['tables'] and not word['fields'],'original_word_layout')
  media=paths[sid]['images']
  require(len(media) == 2 and all(a['sha256'] == GUIDE_SHA and hashlib.sha256(Path(a['path']).read_bytes()).hexdigest() == GUIDE_SHA for a in media), 'answer_guide')
  native=r['content']['content']['questions'][0]
  native_stem=re.sub(r'【\s*】','',native['stem'])
  narrow=norm(native_stem)
  require([norm(t) for t in narrow.split('/')]==tiles,'native_tile_order')
  answer=norm(teacher['text']).removeprefix('答案:').strip()
  require(norm(native['answers'][0][0])==answer and Counter(words(answer))==Counter(tiles),'source_answer')
  require(words(answer)[-1] in '.?!','punctuation_required')
  refs=[]
  for n,terms in anchors[sid]:
   src,start=('05_HWG1_U3.pdf',39) if n<53 else ('06_HWG1_U4.pdf',53)
   with pymupdf.open(book/src) as pdf: t=pdf[n-start].get_text()
   require(str(n) in [x.strip() for x in t.splitlines()] and all(term.lower() in norm(t).lower() for term in terms),'textbook_concept')
   refs.append(n)
  out.append({'id':sid,'passed':True,'unit':3 if r['sections']==['398850'] else 4,'tiles':tiles,'answer':answer,'order':[tiles.index(t)+1 for t in words(answer)],'references':refs})
 except ValueError as e:out.append({'id':sid,'passed':False,'reason':str(e)})
args.output.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
print(Counter(r.get('reason','passed') for r in out))
