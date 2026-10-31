"""Assemble a complete local release candidate; never uploads or deploys."""
from pathlib import Path
import json,hashlib,shutil,re,sys
sys.stdout.reconfigure(encoding='utf8')
w=Path.cwd();audit=Path('D:/projects/it-class-tcwu/automation/output/effort-prerelease-audit-20261031')
m=json.loads((audit/'production-manifest.json').read_text(encoding='utf8'));base=audit/('release-base-'+m['deployment']['id']);out=audit/('release-candidate-'+m['deployment']['id'])
out.mkdir(parents=True,exist_ok=True)
for f in m['files']:
 p=base/f['path'];assert hashlib.sha1(p.read_bytes()).hexdigest()==f['uid'];d=out/f['path'];d.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,d)
changed=set()
def copy(p):
 d=out/p;d.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(w/p,d);changed.add(p)
def patch(p,fn):
 f=out/p;before=f.read_text(encoding='utf8');after=fn(before)
 if before!=after:f.write_text(after,encoding='utf8',newline='\n');changed.add(p)
def replace(s,a,b):
 assert a in s,a[:120]
 return s.replace(a,b)
for p in ['shared/effort-garden-v2.mjs','shared/effort-garden-v2.css','shared/garden-companions.mjs','shared/garden-companion-policy.mjs','shared/garden-pet-names.mjs','shared/garden-stage.mjs','shared/garden-unlock-notice.mjs','shared/reward-tree-model.js','shared/reward-tree-renderer.js','shared/quiz-leaf-credit.mjs','shared/past-flower-celebration.mjs','shared/quiz-leaf-celebration.mjs']:
 copy(p)
# Preserve the production transport/cache key instead of restoring an old one.
p='shared/quiz-rewards.mjs';production=(base/p).read_text(encoding='utf8');s=(w/p).read_text(encoding='utf8');s=re.sub(r"import \{createQuizRequest\}[^\n]+",production.splitlines()[0],s,count=1);(out/p).write_text(s,encoding='utf8',newline='\n');changed.add(p)
# Keep question-report forms, cloud order resync and all unrelated logic.
patch('shared/quiz-server.mjs',lambda s:replace(s,'if(next.leaf?.earned_now)celebrateQuizLeaf();','if(next.leaf?.credit_added_now || next.leaf?.earned_now){celebrateQuizLeaf({leaves:next.leaf.awarded_leaf_count??1});afterGardenReward();}'))
def past_ui(s):
 # Apply only the reward-summary function from the tested candidate.
 a=s.index(' const message=p.earnedByThisAttempt?');b=s.index(" $('#restart').textContent",a)
 ws=(w/'shared/quiz-past-ui.mjs').read_text(encoding='utf8');wa=ws.index(' const message=p.earnedByThisAttempt?');wb=ws.index(" $('#restart').textContent",wa)
 return s[:a]+ws[wa:wb]+s[b:]
patch('shared/quiz-past-ui.mjs',past_ui)
def past(s):
 s="import {celebratePastFlower,stopPastFlowerCelebration} from './past-flower-celebration.mjs';\nimport {afterGardenReward} from './garden-unlock-notice.mjs';\n"+s
 s=replace(s,'const clear=()=>{generation++;','const clear=()=>{stopPastFlowerCelebration();generation++;')
 old="if(token!==generation)throw Error('登入身分已變更。');const changed=state.attemptId!==next.attemptId;state=next;if(changed){viewed.clear();updateScope();}const url=new URL(location.href);url.searchParams.set('attempt',state.attemptId);history.replaceState(null,'',url);return next;"
 ws=(w/'shared/quiz-past-exams.mjs').read_text(encoding='utf8');line=next(x.strip() for x in ws.splitlines() if 'const earned=!state.practice' in x);s=replace(s,old,line)
 return replace(s,'首次達標取得1片葉。','首次達標開出1朵考古花。')
patch('shared/quiz-past-exams.mjs',past)
for g in ['3','6']:
 patch('grade'+g+'/115-1/past-exam.html',lambda s:s.replace('歷次成績與葉片','歷次成績與考古花').replace('計分與葉片規則','計分與開花規則'))
def tree(s):
 s=re.sub(r'^.*<button class="flower-option forest"[^\n]+\n','',s,flags=re.M)
 s=replace(s,'["sunrise", "ocean", "candy", "forest"].includes(style)','["sunrise", "ocean", "candy"].includes(style)')
 # Only refresh changed module URLs; do not add old garden prototypes or auth.
 for name in ['effort-garden-v2.mjs','effort-garden-v2.css','reward-tree-model.js','quiz-rewards.mjs']:
  s=re.sub(r'('+re.escape(name)+r')\?v=[^"\x27]+',r'\1?v=20261031-level2',s)
 return s
patch('my-tree.html',tree)
# Published runtime only. Keep existing production files even when unused by v2.
for p in ['garden/stage.html','garden/scene-cat.html','garden/scene-pets.html','garden/growth/index.html','garden/growth/growth.mjs']:copy(p)
for p in (w/'garden/src').glob('*.js'):copy(p.relative_to(w).as_posix())
manifests=['pet-homes-v2','pets-v2','pets-v3','pet-diagonal-v5','shelter-v21','interactions-v23']
assets=set();runtime_manifests={}
def add_asset(p):
 p=p.resolve();assert p.is_relative_to(w.resolve()),str(p)
 if not p.is_file():raise RuntimeError('missing asset '+str(p))
 assets.add(p.relative_to(w).as_posix())
def clean_manifest(v):
 if isinstance(v,dict):return {k:clean_manifest(x) for k,x in v.items() if k not in ['provenance','operation'] and not k.lower().startswith('source')}
 if isinstance(v,list):return [clean_manifest(x) for x in v]
 return v
def walk_json(v,folder,key=None):
 if isinstance(v,dict):
  for k,x in v.items():walk_json(x,folder,k)
 elif isinstance(v,list):
  for x in v:walk_json(x,folder,key)
 elif key in ['frames','back','front'] and isinstance(v,str) and re.search(r'\.(webp|png)$',v):add_asset(folder/v)
for folder in manifests:
 p=w/'garden/assets/processed'/folder/'manifest.json';clean=clean_manifest(json.loads(p.read_text(encoding='utf8')));runtime_manifests[p.relative_to(w).as_posix()]=clean;walk_json(clean,p.parent)
for folder in ['social-v10','peek-v11','tree-candidates']:
 for p in (w/'garden/assets/processed'/folder).glob('*.webp'):add_asset(p)
for p in (w/'garden/assets/processed/gait-v9/web').glob('*.webp'):add_asset(p)
for p in (w/'garden/assets/homes').glob('*-preview.webp'):add_asset(p)
add_asset(w/'garden/assets/processed/full-tree-v12/layout.json');add_asset(w/'garden/assets/processed/motion-web/flower.webp')
for p in sorted(assets):copy(p)
for p,value in runtime_manifests.items():
 text=json.dumps(value,ensure_ascii=False,separators=(',',':'));assert not re.search(r'[A-Za-z]:[\\/]',text),'private path in manifest';d=out/p;d.parent.mkdir(parents=True,exist_ok=True);d.write_text(text,encoding='utf8');changed.add(p)
# Verify preservation independently of the chosen input roots.
allfiles={p.relative_to(out).as_posix():hashlib.sha1(p.read_bytes()).hexdigest() for p in out.rglob('*') if p.is_file()}
actual_changed=[f['path'] for f in m['files'] if allfiles.get(f['path'])!=f['uid']]
assert set(actual_changed)<=changed
for p in ['api/garden-weather.js','shared/quiz-question-reports.mjs','grade6/115-1/week09.html','shared/quiz-workspace.mjs','shared/quiz-transport.mjs','shared/auth.js']:
 assert allfiles[p]==next(f['uid'] for f in m['files'] if f['path']==p),p
assert 'resyncOrder' in (out/'shared/quiz-server.mjs').read_text(encoding='utf8')
assert 'report(q)' in (out/'shared/quiz-server.mjs').read_text(encoding='utf8')
assert 'reportRequest' in (out/'shared/quiz-past-exams.mjs').read_text(encoding='utf8')
assert 'reports.get(key)' in (out/'shared/quiz-past-ui.mjs').read_text(encoding='utf8')
report={'baseline':m['deployment']['id'],'candidate':str(out),'baselineFiles':len(m['files']),'files':len(allfiles),'changedExisting':actual_changed,'unchangedExisting':len(m['files'])-len(actual_changed),'added':sorted(set(allfiles)-{f['path'] for f in m['files']}),'publishedRuntimeAssets':len(assets),'bytes':sum(p.stat().st_size for p in out.rglob('*') if p.is_file()),'preservesQuestionReportsAndOrderSync':True,'deployed':False}
(audit/'release-candidate-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k not in ['added']},ensure_ascii=False))
