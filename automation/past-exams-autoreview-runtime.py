"""最新正式完整來源 SHA-1 核對封存，只調整答案標籤及必要快取鏈。"""
from pathlib import Path
import json,hashlib,subprocess,urllib.request,concurrent.futures,base64,re
ROOT=Path('automation/output/past-exams-autoreview-20261101');release=ROOT/'release'
assert not (ROOT/'release-manifest.private.json').exists(),'Immutable release already prepared'
tree=json.loads((ROOT/'vercel-tree.private.json').read_text(encoding='utf-8-sig'))
def flatten(nodes,prefix=''):
 for n in nodes:
  p=prefix+n['name']
  if n['type']=='directory':yield from flatten(n.get('children',[]),p+'/')
  elif n['type']=='file':yield p,n['uid']
src=next(x for x in tree if x['name']=='src');files=list(flatten(src['children']));assert len(files)>500
caches=[Path('automation/output/past-exams-audio/release'),Path('C:/Users/user/projects/it-class-tcwu'),Path('D:/projects/it-class-tcwu'),Path('.')]
def cli(args):
 quoted='& vercel '+' '.join("'"+str(a).replace("'","''")+"'" for a in args)
 r=subprocess.run(['pwsh','-NoProfile','-NonInteractive','-Command',quoted],capture_output=True,encoding='utf-8',creationflags=subprocess.CREATE_NO_WINDOW);assert r.returncode==0,r.stderr[:300];return json.loads(r.stdout)
def sha(data):return hashlib.sha256(data).hexdigest()
def one(row):
 p,uid=row;assert not Path(p).is_absolute() and '..' not in Path(p).parts
 out=release/p;out.parent.mkdir(parents=True,exist_ok=True);data=None
 if out.exists() and hashlib.sha1(out.read_bytes()).hexdigest()==uid:data=out.read_bytes()
 for cache in caches:
  if data is not None:break
  f=cache/p
  if f.is_file():
   raw=f.read_bytes()
   if hashlib.sha1(raw).hexdigest()==uid:data=raw
 if data is None and not p.startswith('api/') and not p.startswith('.'):
  try:
   with urllib.request.urlopen('https://it-class-tcwu.vercel.app/'+urllib.request.quote(p),timeout=30) as r:raw=r.read()
   if hashlib.sha1(raw).hexdigest()==uid:data=raw
  except Exception:pass
 if data is None:
  r=cli(['api',f'/v8/deployments/dpl_7DQqnJPJDzyLCaF49T8qQR3sWsiH/files/{uid}','--method','GET'])
  assert r.get('encoding')=='base64',p;data=base64.b64decode(r['data'])
 assert hashlib.sha1(data).hexdigest()==uid,p
 out.write_bytes(data);return p,sha(data)
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:baseline=dict(ex.map(one,files))
patches={}
def patch(p,fn):
 f=release/p;old=f.read_text(encoding='utf-8');new=fn(old);assert old!=new,p;f.write_text(new,encoding='utf-8',newline='');patches[p]=sha(f.read_bytes())
patch('shared/quiz-past-ui.mjs',lambda s:s.replace('這一格和官方記號不同','這一格和核對答案不同').replace('官方記號：','核對答案：'))
# Bump the real formal import graph, retaining all later auth/report changes.
changed={'shared/quiz-past-ui.mjs'}
allowed=set(['shared/quiz-past-ui.mjs','shared/quiz-past-exams.mjs','shared/quiz-module.js','shared/quiz-past-entry.mjs']+[f'grade{g}/115-1/past-exam.html' for g in [3,6]])
while True:
 found=[]
 for p in baseline:
  if p in changed or p not in allowed:continue
  text=(release/p).read_text(encoding='utf-8')
  for target in changed:
   name=Path(target).name
   if re.search(re.escape(name)+r'(?:\?v=[^\s\'"<>]+)?[\'\"]',text):
    new=re.sub(re.escape(name)+r'(?:\?v=[^\s\'"<>]+)?(?=[\'\"])',name+'?v=20261101-ai-review',text)
    if new!=text:text=new
  if text!=(release/p).read_text(encoding='utf-8'):
   (release/p).write_text(text,encoding='utf-8',newline='');patches[p]=sha((release/p).read_bytes());found.append(p)
 if not found:break
 changed.update(found)
assert set(patches)<=set(['shared/quiz-past-ui.mjs','shared/quiz-past-exams.mjs','shared/quiz-module.js','shared/quiz-past-entry.mjs']+[f'grade{g}/115-1/past-exam.html' for g in [3,6]]),sorted(patches)
manifest={'baselineDeployment':'dpl_7DQqnJPJDzyLCaF49T8qQR3sWsiH','projectId':'prj_eJ1qle57xyilS5MKy6ZS6OuYtyFb','baseline':baseline,'patches':patches,'files':{**baseline,**patches}}
(ROOT/'release-manifest.private.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
for p in patches:
 # Copy only changed lines onto project files, never overwrite newer formal modules wholesale.
 if p=='shared/quiz-past-ui.mjs':
  f=Path(p);f.write_text(f.read_text(encoding='utf-8').replace('這一格和官方記號不同','這一格和核對答案不同').replace('官方記號：','核對答案：'),encoding='utf-8',newline='')
print(json.dumps({'frozenSourceFiles':len(baseline),'patches':list(patches)}))
