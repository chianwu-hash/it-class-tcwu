"""Independent original answer cross-check; no source writes or network."""
from pathlib import Path
import json,gzip,zipfile,io,re,unicodedata,hashlib,xml.etree.ElementTree as ET,collections,sys
sys.stdout.reconfigure(encoding='utf-8')
base=Path('automation/output/quiz/all-midterm-local');out=Path('automation/output/quiz/all-subjects-pool')
pool=json.loads((out/'pool.json').read_text(encoding='utf-8'));pending=json.loads((out/'pending.json').read_text(encoding='utf-8'));cache={};kept=[];audit=[]
def text(file):
 data=file.read_bytes()
 if file.suffix=='.gz':data=gzip.decompress(data)
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  root=ET.fromstring(z.read('word/document.xml'));return ''.join(t.text or '' for t in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'))
def choice(s):
 s=unicodedata.normalize('NFKC',str(s));digits=re.findall(r'[1-8]',s)
 if not digits and re.fullmatch(r'[A-Ha-h]',s.strip()):return ord(s.strip().lower())-ord('a')
 if len(digits)!=1:raise ValueError('原答案非單一選項，不能自動確認')
 return int(digits[0])-1
for r in pool:
 folder=r['checks']['source_catalog'];sid=r['source_item_id'];root=base/folder
 try:
  if folder.startswith('kang-'):
   if folder not in cache:
    m=json.loads((root/'metadata.json').read_text(encoding='utf-8'));d=collections.defaultdict(list)
    for a in m['QuesAnswer']:d[str(a['QUES_NO'])].append(a['QUES_ANSW'])
    cache[folder]=d
   answers=cache[folder][sid]
   if len(answers)!=1:raise ValueError('原題包含多個子題答案')
   expected=choice(answers[0])
  elif folder.startswith('nani-'):expected=choice(text(root/'native'/sid/'answer.docx'))
  else:
   original=json.loads((root/'source'/sid/'item.json').read_text(encoding='utf-8'));questions=original['content']['questions']
   if len(questions)!=1:raise ValueError('原JSON非單一子題')
   expected=choice(questions[0]['answers'][0][0])
   if len(questions[0]['options'])!=len(r['question']['options']):raise ValueError('原選項數不符')
   answer_file=root/'source'/sid/'answer.docx.gz'
   if answer_file.exists():
    original_text=text(answer_file)
    if re.search(r'[1-8①②③④]',unicodedata.normalize('NFKC',original_text)):
     if choice(original_text)!=expected:raise ValueError('原JSON與原答案文件不一致')
  q=r['question']
  if expected>=len(q['options']) or q['answer']['option_id']!=q['options'][expected]['id']:raise ValueError('原始答案與題池不符')
  r['checks']['original_answer_independently_verified']=True;kept.append(r);audit.append({'id':r['question_id'],'source':folder,'expected_option':q['options'][expected]['id'],'passed':True})
 except Exception as e:pending.append({'course':r['course_id'],'id':sid,'reason':'來源答案交叉核對：'+str(e)})
report=json.loads((out/'qa/build-report.json').read_text(encoding='utf-8'));report['prepared']=len(kept);report['pending']=len(pending);report['source_answer_checks']=len(audit)
for c in report['courses']:
 rows=[r for r in kept if r['course_id']==c['id']];c['total']=len(rows)
 for u in c['units']:u['count']=sum(int(u['id']) in r['unit_ids'] for r in rows)
 if not c['total'] or any(not u['count'] for u in c['units']):raise ValueError('排除後仍有單元未覆蓋')
(out/'pool.json').write_text(json.dumps(kept,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
(out/'pending.json').write_text(json.dumps(pending,ensure_ascii=False),encoding='utf-8')
(out/'qa/source-answer-audit.json').write_text(json.dumps(audit,ensure_ascii=False),encoding='utf-8')
report['pool_sha256']=hashlib.sha256((out/'pool.json').read_bytes()).hexdigest()
(out/'qa/build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'verified':len(kept),'rejected':len(pool)-len(kept),'per_course':{c['id']:c['total'] for c in report['courses']}},ensure_ascii=False))
