"""只部署已由原正式檔案雜湊核對的完整來源，先stage再明確promote。"""
from pathlib import Path
import json,hashlib,subprocess,sys,re,urllib.request,concurrent.futures
R=Path('automation/output/past-exams-autoreview-20261101');release=(R/'release').resolve()
read=lambda p:json.loads(Path(p).read_text(encoding='utf-8-sig'))
save=lambda p,v:Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
m=read(R/'release-manifest.private.json');phase=sys.argv[1]
def cli(args,cwd=None):
 cmd='& vercel '+' '.join("'"+str(a).replace("'","''")+"'" for a in args)
 r=subprocess.run(['pwsh','-NoProfile','-NonInteractive','-Command',cmd],cwd=cwd,capture_output=True,encoding='utf-8',creationflags=subprocess.CREATE_NO_WINDOW);(R/(phase+'-cli.private.log')).write_text(r.stdout+'\n'+r.stderr,encoding='utf-8');assert r.returncode==0,'See private CLI log';return r.stdout
def alias():return json.loads(cli(['api','/v4/aliases/it-class-tcwu.vercel.app','--method','GET']))
def check_files():
 for p,h in m['files'].items():assert hashlib.sha256((release/p).read_bytes()).hexdigest()==h,p
if phase=='stage':
 assert not (R/'staged.private.json').exists();a=alias();assert a['projectId']==m['projectId'] and a['deploymentId']==m['baselineDeployment'];save(R/'alias-before.private.json',a)
 check_files();assert read(R/'local-qc.private.json')['passed']
 for c in read(R/'candidates.private.json'):assert read(R/c['paperId']/'browser/results.json')['sha256']==c['newSha256']
 (release/'.vercel').mkdir(exist_ok=True);save(release/'.vercel/project.json',{'projectId':m['projectId'],'orgId':'team_SOhQ0oysg6ZGV9vs3RryW2CB','projectName':'it-class-tcwu'})
 cli(['project','inspect','--non-interactive','--scope','chianwu-4755s-projects'],release)
 raw=cli(['deploy','--prod','--skip-domain','--yes','--scope','chianwu-4755s-projects'],release);urls=re.findall(r'https://[^\s]+\.vercel\.app',raw);assert urls,raw[-300:]
 v=json.loads(cli(['api','/v13/deployments/'+urls[-1].split('//')[1],'--method','GET']));assert v['projectId']==m['projectId'] and v['readyState']=='READY' and v['target']=='production';save(R/'staged.private.json',{'id':v['id'],'url':v['url'],'projectId':v['projectId'],'ready':True});print(json.dumps({'staged':v['id'],'url':v['url']}))
elif phase=='candidate':
 v=read(R/'staged.private.json');checks=[]
 for p,h in m['patches'].items():
  # Vercel curl uses existing CLI auth for deployment protection, no exported token.
  out=(R/('candidate-'+Path(p).name)).resolve();cli(['curl','/'+p,'--deployment','https://'+v['url'],'--','--output',out]);assert hashlib.sha256(out.read_bytes()).hexdigest()==h,p;checks.append(p)
 save(R/'candidate-verified.private.json',{'passed':True,'deploymentId':v['id'],'paths':checks});print(json.dumps({'candidateFilesVerified':len(checks)}))
elif phase=='promote':
 assert read(R/'candidate-verified.private.json')['passed'];assert read(R/'cloud/smoke.private.json')['passed'];check_files();a=alias();assert a['deploymentId']==m['baselineDeployment'],'Concurrent release: rebase required'
 v=read(R/'staged.private.json');cli(['promote','https://'+v['url'],'--yes','--scope','chianwu-4755s-projects']);a=alias();assert a['deploymentId']==v['id'];save(R/'alias-promoted.private.json',a);print(json.dumps({'promoted':v['id']}))
elif phase=='verify':
 a=alias();assert a['deploymentId']==read(R/'staged.private.json')['id'];public={p:h for p,h in m['files'].items() if not p.startswith(('api/','.')) and Path(p).suffix in ['.html','.js','.mjs','.css','.woff2']}
 def one(row):
  p,h=row
  with urllib.request.urlopen('https://it-class-tcwu.vercel.app/'+urllib.request.quote(p),timeout=30) as r:data=r.read()
  assert hashlib.sha256(data).hexdigest()==h,p
 with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:list(ex.map(one,public.items()))
 save(R/'runtime-live.private.json',{'passed':True,'deploymentId':a['deploymentId'],'publicFiles':len(public),'patches':list(m['patches'])});print(json.dumps({'livePublicFilesVerified':len(public)}))
else:raise SystemExit('phase required')
