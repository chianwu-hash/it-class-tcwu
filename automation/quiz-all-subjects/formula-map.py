"""Reuse the verified visible WMF fraction reader, never cached OLE values."""
import sys,json,pathlib,hashlib
sys.path.insert(0,str(pathlib.Path('automation/quiz-g3-math-pool').resolve()))
from docx_content import visible_fraction
root=pathlib.Path('automation/output/quiz/all-midterm-local/hanlin-g6-math/original-images');result={}
for file in root.glob('*.wmf'):
 data=file.read_bytes();formula=visible_fraction(data)
 if formula:result[file.stem]={'latex':formula,'source_sha256':hashlib.sha256(data).hexdigest()}
out=pathlib.Path('automation/output/quiz/all-subjects-pool');out.mkdir(parents=True,exist_ok=True)
(out/'formula-map.json').write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
print(json.dumps({'verified_simple_fraction_images':len(result)}))
