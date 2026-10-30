"""Extract the actual WW7 Unit 3 (publisher chapter 04), without modifying old sources."""
from pathlib import Path, PureWindowsPath
import argparse, json, subprocess, hashlib, sys, unicodedata, collections
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'lib'))
from quiz_native_docx import Native, ns, split_options

p=argparse.ArgumentParser();p.add_argument('--baseline',required=True);p.add_argument('--out',required=True);args=p.parse_args()
base=Path(args.baseline);out=Path(args.out);folder=out/'kang-g6-en';source=folder/'source';source.mkdir(parents=True,exist_ok=True)
metadata=json.loads((base/'kang-english-metadata.json').read_text(encoding='utf-8'))
disc=next(x for x in json.loads((base/'download-manifest.json').read_text(encoding='utf-8'))['records'] if 'WW' in x['file'])
iso=Path(disc['path']);h=hashlib.sha256()
with iso.open('rb') as f:
 for chunk in iter(lambda:f.read(8*1024*1024),b''):h.update(chunk)
if h.hexdigest()!=disc['sha256']:raise ValueError('source_disc_changed')
items=[x for x in metadata['QuesMaster'] if x['CLASS_TERM']=='1507' and x['LESN_NUM']=='04']
chapter=next(x for x in metadata['CodeChapter'] if x['CLASS_TERM']=='1507' and x['LESN_NUM']=='04')
if chapter['LESN_NAME']!='Unit 3 From Farm to Table' or len(items)!=170:raise ValueError('unit3_source_scope_changed')
ids={x['QUES_NO'] for x in items};paths=json.loads((base/'kang-english-paths.json').read_text(encoding='utf-8'))
members=[x for x in paths if 'Single' in x and x.endswith(('.docx','.mp3')) and PureWindowsPath(x).stem in ids]
memberfile=folder/'source-members.txt';memberfile.write_text('\n'.join(members),encoding='utf-8')
run=subprocess.run(['C:/Program Files/7-Zip/7z.exe','e','-y','-scsUTF-8','-o'+str(source),str(iso),'@'+str(memberfile)],capture_output=True,check=True)
(folder/'extraction.log').write_bytes(run.stdout)
selected={t:[x for x in rs if (x.get('QUES_NO') in ids if 'QUES_NO' in x else x.get('CLASS_TERM') in [None,'1507'] if 'CLASS_TERM' in x else True)] for t,rs in metadata.items()}
(folder/'metadata.json').write_text(json.dumps(selected,ensure_ascii=False),encoding='utf-8')
answers=collections.defaultdict(list)
for x in metadata['QuesAnswer']:answers[x['QUES_NO']].append(x['QUES_ANSW'])
types={x['QUES_TYPE']:x['QUES_TYPE_DESC'] for x in metadata['CodeQuesType'] if ('選擇' in x['QUES_TYPE_DESC'] or 'Choose' in x['QUES_TYPE_DESC']) and not any(s in x['QUES_TYPE_DESC'] for s in ['聽力','非選擇','多選'])}
records=[];flags=[]
for item in items:
 if item['QUES_TYPE'] not in types or item['ANS_NUM']!=1:continue
 file=source/(item['QUES_NO']+'.docx')
 try:
  n=Native(file,folder);table=n.root.find('w:body/w:tbl',ns);rows=table.findall('w:tr',ns)
  if len(rows)!=2:raise ValueError('unsupported_question_table')
  headers=[''.join(c.xpath('.//w:t/text()',namespaces=ns)) for c in rows[0].findall('w:tc',ns)]
  if headers!=['題目','答案','解析']:raise ValueError('unexpected_question_headers')
  cells=rows[1].findall('w:tc',ns)
  if len(cells)!=3:raise ValueError('unexpected_cell_count')
  values=split_options(n.nodes(cells[0]));a=answers[item['QUES_NO']]
  if len(a)!=1:raise ValueError('ambiguous_metadata_answer')
  answer=unicodedata.normalize('NFKC',str(a[0])).strip()
  original_answer=unicodedata.normalize('NFKC',n.nodes(cells[1])['text']).replace('《答案》','').strip()
  if answer!=original_answer or answer not in ['1','2','3','4','A','B','C','D']:raise ValueError('independent_original_answer_mismatch')
  answer_index=int(answer)-1 if answer.isdigit() else ord(answer)-ord('A')
  solution=n.nodes(cells[2]);detailed=bool(solution['text'] or solution['media'])
  if not detailed:solution={'text':'這一題目前沒有詳細解析，可以先核對正確答案。','media':[]}
  q={'id':'kang_g6_en_'+item['QUES_NO'],'type':'single','prompt':values[0],'options':[{'id':'abcd'[i],'content':v} for i,v in enumerate(values[1:])],'answer':{'option_id':'abcd'[answer_index]},'explanation':solution}
  material={'text':'','media':[]};typename=types[item['QUES_TYPE']]
  if 'Listen' in typename:
   audio=file.with_suffix('.mp3')
   if not audio.exists():raise ValueError('missing_original_audio')
   raw=audio.read_bytes();digest=hashlib.sha256(raw).hexdigest();(folder/'web-audio').mkdir(exist_ok=True);(folder/'web-audio'/(digest+'.mp3')).write_bytes(raw)
   material={'text':typename,'media':[{'kind':'audio','url':'https://publisher-local.example.invalid/'+digest+'.mp3','alt':'聽力音檔'}]}
  records.append({'id':item['QUES_NO'],'unit':'03','publisher_chapter':'04','difficulty':{'A':-3,'B':0,'C':3}[item['DIFC_CODE']],'question':q,'material':material,'source_sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'publisher_explanation_present':detailed,'publisher_knowledge':item['KNOW_SPOT'],'checks':{'original_answer_independently_verified':True,'source_disc_sha256':disc['sha256']}})
 except Exception as e:flags.append({'id':item['QUES_NO'],'reason':str(e)})
(folder/'catalog.json').write_text(json.dumps(records,ensure_ascii=False),encoding='utf-8');(folder/'conversion-flags.json').write_text(json.dumps(flags,ensure_ascii=False,indent=2),encoding='utf-8')
manifest=[{'original_file':p.name,'web_file':p.stem+'.png' if p.suffix in ['.wmf','.emf'] else p.name,'conversion':p.suffix in ['.wmf','.emf']} for p in (folder/'original-images').iterdir()]
(folder/'catalog').mkdir(exist_ok=True);(folder/'catalog/image-manifest.json').write_text(json.dumps(manifest),encoding='utf-8')
report={'source_records':len(items),'prepared':len(records),'flags':len(flags),'difficulty':dict(collections.Counter(r['difficulty'] for r in records)),'images':len(manifest),'original_audio':len(list((folder/'web-audio').glob('*.mp3'))),'unit_title':chapter['LESN_NAME'],'publisher_chapter':'04','logical_unit':3}
(out/'source-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(report,ensure_ascii=True))
