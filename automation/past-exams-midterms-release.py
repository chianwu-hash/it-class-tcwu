"""以已驗證的完整正式快照為底，只覆蓋本次專區顯示檔案。"""
from pathlib import Path
import json,hashlib,shutil,subprocess
root=Path('automation/output/past-exams-midterms');previous=Path('automation/output/past-exam-production');release=root/'release'
alias=json.loads((root/'cloud/alias-before.private.json').read_text(encoding='utf-8-sig'))
assert alias['deploymentId']=='dpl_7MN16pxfnz6SwNHFBQ6GUquYAwtf','正式版本已異動，需先重新核對完整基底'
assert alias['projectId']=='prj_eJ1qle57xyilS5MKy6ZS6OuYtyFb'
manifest=json.loads((previous/'release-manifest.json').read_text(encoding='utf-8-sig'))
for file,sha in manifest['files'].items():assert hashlib.sha256((previous/'release'/file).read_bytes()).hexdigest()==sha,'上次完整快照已異動'
assert len(list((previous/'release').rglob('*')))>400
if release.exists():raise ValueError('既有凍結快照不可覆寫')
shutil.copytree(previous/'release',release)
files=['shared/quiz-module.js','shared/quiz-library.mjs','shared/quiz-library.css','shared/quiz-past-catalog.mjs','grade3/115-1/quiz-library.html','grade6/115-1/quiz-library.html']
for f in files:
 shutil.copyfile(f,release/f);manifest['files'][f]=hashlib.sha256(Path(f).read_bytes()).hexdigest()
manifest.update(previousProduction=alias['deploymentId'],batch='113-114-1-midterms-only',gitHead=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip())
(root/'release-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'files':len(manifest['files']),'overlays':len(files),'fullSnapshot':True}))
