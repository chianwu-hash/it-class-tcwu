"""只從最新正式身分同步快照封存，禁止以 dirty 主專案整包部署。"""
from pathlib import Path
import json,hashlib,shutil,subprocess
root=Path('automation/output/past-exams-audio');identity=Path('C:/Users/user/.codex/worktrees/quiz-identity-sync/it-class-tcwu/automation/output/quiz/identity-sync');release=root/'release'
read=lambda p:json.loads(Path(p).read_text(encoding='utf-8-sig'))
files={**read('D:/projects/it-class-tcwu-batch4/automation/output/quiz/batch4/release-manifest.json')['files'],**read('automation/output/past-exams-midterms/release-manifest.json')['files'],**read(identity/'release-manifest.json')['changes']}
public={f:s for f,s in files.items() if not f.startswith('api/') and Path(f).suffix in ['.html','.js','.mjs','.css','.woff2']}
assert len(public)==255
for f,s in public.items():assert hashlib.sha256((identity/'release'/f).read_bytes()).hexdigest()==s,f
assert not release.exists(),'不可覆蓋既有凍結包'
shutil.copytree(identity/'release',release)
overlays=['shared/quiz-module.js','shared/quiz-past-content.mjs','shared/quiz-past-ui.mjs','shared/quiz-past-exams.mjs','shared/quiz-past-entry.mjs','shared/quiz-past-teacher.mjs','shared/quiz-past-review.mjs','shared/quiz-past-style.css']+[f'grade{g}/115-1/{n}.html' for g in [3,6] for n in ['past-exam','past-exam-review']]
for f in overlays:shutil.copyfile(f,release/f);files[f]=hashlib.sha256(Path(f).read_bytes()).hexdigest()
(root/'release-manifest.json').write_text(json.dumps({'baselineDeployment':'dpl_BbRiddNNbQD1YrrPaPewqWSdxSnh','files':files,'baselinePublic':public,'overlays':overlays,'gitHead':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'baselineVerifiedLocally':255,'overlays':len(overlays),'fullFrozenSnapshot':True}))
