"""Read-only source conversion. Original text, option IDs and publisher answers stay traceable."""
import pathlib,json,sqlite3,sys,gzip,io,zipfile,hashlib,shutil,re,collections,copy
from lxml import etree as E
from PIL import Image
import docx_content as native
sys.stdout.reconfigure(encoding='utf-8')
ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE=ROOT/'automation/output/quiz/hanlin-g3-math-pool'
SOURCE=next(pathlib.Path('F:/').glob('115*3*/resources'))
CATALOG=ROOT/'automation/output/quiz/hanlin-g3-math-catalog/full/catalog.jsonl'
COURSE='H-E-MA_06_Course_108_11501-3'
def save(name,value):(BASE/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
for d in ['catalog','source','original-images','web-images','qa']: (BASE/d).mkdir(parents=True,exist_ok=True)
catalog=[json.loads(x) for x in CATALOG.read_text(encoding='utf-8').splitlines()]
db=sqlite3.connect(next(SOURCE.glob('*-resource.sqlite')).as_uri()+'?mode=ro',uri=True)
cache={}
for folder in ['hanlin-midterm-local','hanlin-fractions-local']:
    for p in (ROOT/'automation/output/quiz'/folder/'web-images').glob('*'):cache.setdefault(p.name,p)
candidates=[];excluded=[];images={}
for entry in catalog:
    sid=entry['source_item_id']
    if not any('選擇' in t['name'] for t in entry['item_types']):excluded.append({'id':sid,'reason':'此版互動先支援獨立選擇題，保留其他題型來源'});continue
    files={name:bytes(raw) for name,raw in db.execute('select name,file from ItemResources where itemId=?',(sid,))}
    payload=json.loads(files['item.json']);qs=payload['content']['questions']
    if len(qs)!=1 or len(qs[0].get('options',[]))!=4 or not entry['teaching_unit_numbers']:
        excluded.append({'id':sid,'reason':'多子題、跨單元專屬題或圖中選項需另外核對'});continue
    dest=BASE/'source'/sid;dest.mkdir(exist_ok=True)
    for name,raw in files.items():
        if name not in ['item.json','preamble-question.docx.gz','answer.docx.gz','solution.docx.gz']:continue
        (dest/name).write_bytes(raw)
        if not name.endswith('.docx.gz'):continue
        with zipfile.ZipFile(io.BytesIO(gzip.decompress(raw))) as archive:
            for n in archive.namelist():
                if not n.startswith('word/media/') or n.endswith('/'):continue
                b=archive.read(n);sha=hashlib.sha256(b).hexdigest();ext=pathlib.PurePosixPath(n).suffix.lower();original=sha+ext
                (BASE/'original-images'/original).write_bytes(b);web=sha+'.png' if ext in ('.wmf','.emf') else original
                if ext not in ('.wmf','.emf'):(BASE/'web-images'/web).write_bytes(b)
                elif web in cache and not (BASE/'web-images'/web).exists():shutil.copyfile(cache[web],BASE/'web-images'/web)
                images[original]={'original_file':original,'web_file':web,'conversion':ext in ('.wmf','.emf')}
    candidates.append((entry,payload))
save('catalog/image-manifest.json',list(images.values()))
if '--prepare' in sys.argv:
    print(json.dumps({'source':len(catalog),'singleChoiceCandidates':len(candidates),'images':len(images),'needVectorRasterization':sum(v['conversion'] and not (BASE/'web-images'/v['web_file']).exists() for v in images.values())}));sys.exit(0)
native.base=BASE
pool=[];audits=[];media_assets={}
def groups(c):
    for p in c.get('layout',[]):
        if p['type']=='paragraph':yield p['runs']
        else:
            if p.get('source_spans'):raise ValueError('合併表格需另外核對')
            for row in p['rows']:
                for cell in row:yield cell
def rebuild(c):c['text']='\n'.join(''.join(r['text'] for r in g if r['type']=='text') for g in groups(c)).strip()
def clean_option(c):
    runs=[r for g in groups(c) for r in g]
    for r in reversed(runs):
        if r['type']=='image':break
        if r['type']=='text' and r['text'].strip():r['text']=re.sub(r'。\s*$','',r['text']);break
    rebuild(c)
def final_content(c):
    c=copy.deepcopy(c)
    # Discard no media silently; every used original must decode and match its recorded hash.
    list(groups(c))
    for m in c['media']:
        p=BASE/'web-images'/m['url'].rsplit('/',1)[-1];b=p.read_bytes()
        with Image.open(io.BytesIO(b)) as image:image.load();fmt=image.format
        mime={'PNG':'image/png','JPEG':'image/jpeg','GIF':'image/gif','WEBP':'image/webp'}[fmt]
        sha=hashlib.sha256(b).hexdigest();media_assets[sha]={'path':str(p.relative_to(ROOT)).replace('\\','/'),'mime':mime,'bytes':len(b),'sha256':sha}
        m['url']='https://quiz-media.invalid/00000000-0000-4000-8000-000000000001/'+sha;m['alt']='圖片'
    return c
for entry,payload in candidates:
    sid=entry['source_item_id'];dest=BASE/'source'/sid
    try:
        q=payload['content']['questions'][0];answer=int(q['answers'][0][0])-1
        if answer not in range(4):raise ValueError('來源答案不是單一選項')
        start=len(native.formula_audit)
        raw=native.parse(dest/'preamble-question.docx.gz');parts=native.split_mc(raw,q)
        if not parts[0]['text'].strip():raise ValueError('題幹只有圖片，需人工確認提示')
        answer_raw=native.parse(dest/'answer.docx.gz');answer_doc=native.content(answer_raw['layout'],answer_raw['media'])
        circled=re.findall('[①②③④]',answer_doc['text'])
        if circled!=[chr(0x2460+answer)]:raise ValueError('JSON答案與原答案文件未能逐項對應')
        if (dest/'solution.docx.gz').exists():
            solution=native.parse(dest/'solution.docx.gz');explanation=native.content(solution['layout'],solution['media'])
        else:explanation={'text':'這一題目前沒有詳細解析，可以先核對正確答案。','media':[]}
        if re.search(r'[①②③④]|選項\s*[1-4A-D]',explanation['text']):raise ValueError('解析引用原選項位置，需另做亂序對應')
        for c in parts[1:]:clean_option(c)
        parts=[final_content(c) for c in parts];explanation=final_content(explanation)
        question={'id':'hanlin3m_'+sid,'type':'single','prompt':parts[0],'options':[{'id':'abcd'[i],'content':c} for i,c in enumerate(parts[1:])],'answer':{'option_id':'abcd'[answer]},'explanation':explanation}
        # Exact equation conversion is recorded against visible vector glyphs, not OLE data.
        formulae=native.formula_audit[start:]
        row={'source_item_id':sid,'question_id':question['id'],'legacy_ids':['midterm_'+sid],'group_key':sid,'unit_ids':entry['teaching_unit_numbers'],'knowledge_code':entry['knowledge'][0]['code'],'knowledge_name':entry['knowledge'][0]['name'],'difficulty':entry['difficulty_raw'],'publisher_explanation':bool((dest/'solution.docx.gz').exists()),'question':question,'source_version':hashlib.sha256((dest/'preamble-question.docx.gz').read_bytes()).hexdigest(),'checks':{'source_options_match':True,'source_answer_documents_match':True,'image_bytes_decode':True,'formula_vector_glyphs':formulae,'semantic_math_solution':'publisher_original_not_independently_proved'}}
        # Identical native content under different source IDs belongs to one family.
        fingerprint=json.dumps([question['prompt'],[o['content'] for o in question['options']]],ensure_ascii=False,sort_keys=True,separators=(',',':')).encode('utf-8')
        row['group_key']='content_'+hashlib.sha256(fingerprint).hexdigest()
        row['source_version']=hashlib.sha256(b''.join((dest/name).read_bytes() for name in ['item.json','preamble-question.docx.gz','answer.docx.gz','solution.docx.gz'] if (dest/name).exists())).hexdigest()
        pool.append(row);audits.append({'id':sid,'answer':question['answer'],'original_answer_document':answer_doc['text'],'formulae':formulae})
    except Exception as e:excluded.append({'id':sid,'reason':str(e)})
save('pool.json',pool);save('media-assets.json',media_assets);save('qa/source-crosscheck.json',audits);save('catalog/pending.json',excluded)
report={'source_records':len(catalog),'candidates':len(candidates),'prepared':len(pool),'pending':len(excluded),'units':{str(n):sum(n in r['unit_ids'] for r in pool) for n in range(1,10)},'knowledge_groups':len({r['knowledge_code'] for r in pool}),'publisher_explanations':sum(r['publisher_explanation'] for r in pool),'formulas':sum(len(a['formulae']) for a in audits),'media':len(media_assets),'pending_reasons':dict(collections.Counter(r['reason'].split(':')[0] for r in excluded))}
save('REPORT.json',report);print(json.dumps(report,ensure_ascii=False))
