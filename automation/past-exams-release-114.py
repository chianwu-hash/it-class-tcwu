"""Overlay explicit runtime files on the previously verified full deployment snapshot."""
from pathlib import Path
import json,hashlib,shutil
root=Path('automation/output/past-exam-production');release=root/'release'
files=['shared/quiz-module.js','shared/quiz-library.mjs','shared/quiz-past-entry.mjs','shared/quiz-past-exams.mjs','shared/quiz-past-review.mjs','shared/quiz-past-style.css','shared/quiz-past-ui.mjs','shared/quiz-past-catalog.mjs','shared/quiz-past-input.mjs','shared/quiz-past-manual.mjs','shared/quiz-past-teacher.mjs']
files += [f'grade{g}/115-1/{name}.html' for g in [3,6] for name in ['past-exam','past-exam-review','quiz-library']]
manifest=json.loads((root/'release-manifest.json').read_text(encoding='utf-8-sig'))
link=json.loads((release/'.vercel/project.json').read_text(encoding='utf-8-sig'))
assert link['projectId']=='prj_eJ1qle57xyilS5MKy6ZS6OuYtyFb' and link['orgId']=='team_SOhQ0oysg6ZGV9vs3RryW2CB'
assert len(list(release.rglob('*')))>400,'Full frozen baseline required'
before=Path('automation/output/past-exams-batch/cloud/alias-before.private.json')
alias=json.loads(before.read_text(encoding='utf-8-sig'))
assert alias['deploymentId']=='dpl_4z2gMQ47cuazJ5bgVJeSpU9bR4B7','Production changed: reconcile full baseline before release'
for f in files:
 src=Path(f);assert src.is_file();dst=release/f;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst)
 manifest['files'][f]=hashlib.sha256(src.read_bytes()).hexdigest()
manifest['previousProduction']=alias['deploymentId'];manifest['batch']='114-1-grades3-6';manifest['gitHead']='f8ef7e8258ae37d9f1eb041c6f9fed2204139b51'
(root/'release-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'overlayFiles':len(manifest['files']),'updatedFiles':len(files),'fullSnapshot':True}))
