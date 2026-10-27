"""Regression checks using private local source bytes, after build_pool.py."""
import pathlib,json,hashlib
from docx_content import visible_fraction
base=pathlib.Path(__file__).resolve().parents[1]/'output/quiz/hanlin-g3-math-pool'
for prefix,expected in [('380bad8',r'\frac{9}{12}'),('7197d23',r'\frac{4}{12}'),('bc0f43',r'\frac{9}{12}')]:
    file=next((base/'original-images').glob(prefix+'*.wmf'))
    assert visible_fraction(file.read_bytes())==expected,(file.name,expected)
assert visible_fraction(b'not an image') is None
pool=json.loads((base/'pool.json').read_text(encoding='utf-8'))
groups={}
for row in pool:
    assert row['checks']['source_answer_documents_match']
    key=json.dumps([row['question']['prompt'],[o['content'] for o in row['question']['options']]],ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8')
    group='content_'+hashlib.sha256(key).hexdigest()
    assert row['group_key']==group
    # Duplicate content must not carry contradictory correct answers.
    answer=row['question']['answer']['option_id']
    assert group not in groups or groups[group]==answer
    groups[group]=answer
report={'passed':True,'visible_fraction_regressions':3,'questions':len(pool),'distinct_content_groups':len(groups),'duplicate_source_records':len(pool)-len(groups)}
(base/'qa/source-regressions.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
