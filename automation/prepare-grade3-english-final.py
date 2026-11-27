import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
import pymupdf

parser = argparse.ArgumentParser(description="Match English questions and teacher keys to exact textbook sentences.")
parser.add_argument("--originals", required=True, type=Path)
parser.add_argument("--textbook-dir", required=True, type=Path)
parser.add_argument("--output", required=True, type=Path)
args = parser.parse_args()
B = args.textbook_dir
rows = json.loads(args.originals.read_text(encoding="utf8"))
spec=[('05_HWG1_U3',39),('06_HWG1_U4',53),('07_HWG1_R2',67)]
section={'398850':[3],'398851':[4,3],'398852':[5,4,3]}
pages={}
def canon(t):
 return ''.join(re.findall(r"[a-z0-9’']+",unicodedata.normalize('NFKC',t).lower())).replace("’","'").replace("'","")
def norm(t):
 return re.sub(r"[\s_]+","",unicodedata.normalize('NFKC',t).replace("’","'"))
for unit,(name,start) in enumerate(spec,3):
 f=B/(name+'.pdf')
 digest=hashlib.sha256(f.read_bytes()).hexdigest()
 with pymupdf.open(f) as pdf:
  for index,p in enumerate(pdf,1):
   number=start+index-1
   if not any(block[1]>p.rect.height*0.88 and re.fullmatch(r"\s*"+str(number)+r"\s*",block[4]) for block in p.get_text('blocks')):
    # Some pages have a footer number and spelled-out number in the same block.
    if str(number) not in (line.strip() for line in p.get_text().splitlines()):continue
   pages[number]=(unit,name,index,digest,canon(p.get_text()))
print('numbered pages',len(pages))
out=[]
def require(condition,reason):
 if not condition:raise ValueError(reason)
for row in rows:
 result={'id':row['id'],'section':row['section']}
 try:
  d=row['original']
  require(set(d)=={'preamble-question','answer'},'missing_original')
  require(all(not any(x[key] for key in ('inline_images','shapes','tables')) for x in d.values()),'original_visual')
  native=row['native']['content'];k=native['questions']
  require(not native.get('preamble') and len(k)==1,'multi_or_shared')
  q=k[0]
  parts=d['preamble-question']['text'].strip().split('\x15')
  require(len(parts)==len(q['options'])+1 and all(norm(a)==norm(b) for a,b in zip(parts[1:],q['options'])),'word_options')
  require(norm(parts[0])==norm(q['stem']),'word_stem')
  answer=d['answer']['fields']
  require(len(answer)==1,'word_key')
  m=re.fullmatch(r'\s*eq\s+\\o\(○,([ABC])\)\s*',unicodedata.normalize('NFKC',answer[0]['code']),re.I)
  require(m is not None,'word_key')
  correct=ord(m[1].upper())-ord('A')
  require(q['answers']==[[str(correct+1)]],'word_key_conflict')
  prompt=re.sub(r'^\s*[（(]\s*[）)]\s*','',parts[0].strip()).replace('\r','\n')
  c=q['options'][correct]
  full=re.sub(r'＿{2,}',lambda m:c,prompt,count=1)
  lines=[canon(x) for x in re.split(r'(?:^|\n)[AB]:\s*',full) if x.strip()]
  require(lines and all(len(x)>=5 for x in lines),'unclear_text')
  hits=[num for num,(u,f,i,sha,t) in pages.items() if u in section[row['section']] and all(x in t for x in lines)]
  require(hits,'no_exact_textbook_dialogue')
  first=min(hits,key=lambda n:(section[row['section']].index(pages[n][0]),n))
  unit,name,pdfpage,sha,_=pages[first]
  result.update(passed=True,prompt=prompt,options=q['options'],answer=correct+1,primary=first,pdf_page=pdfpage,book_file=name+'.pdf',book_sha=sha)
 except ValueError as e:
  result.update(passed=False,reason=str(e))
 out.append(result)
args.output.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
print(Counter(r.get('reason','pass') for r in out))
