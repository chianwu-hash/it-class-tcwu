"""本機只讀盤點：驗證原檔、建立同版本配對並抽取PDF文字與頁面資訊。"""
import argparse,hashlib,json,re,zipfile
from pathlib import Path
import pymupdf

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--year',choices=['114-1'],default='114-1',help='本次授權僅含114學年度上學期')
parser.add_argument('--source',type=Path,default=Path('D:/projects/it-class-tcwu/automation/output/past-exams-113-114-1'))
parser.add_argument('--output',type=Path,default=Path('automation/output/past-exams-batch'))
args=parser.parse_args()
root=args.source
out=args.output;out.mkdir(parents=True,exist_ok=True)
manifest=json.loads((root/'manifest.json').read_text(encoding='utf-8'))
files=[];pairs={}
for item in manifest['items']:
    if item['year']!=args.year:continue
    file=root/Path(item['path'].replace('\\','/'));raw=file.read_bytes()
    digest=hashlib.sha256(raw).hexdigest()
    if digest!=item['sha256'] or len(raw)!=item['bytes']:raise ValueError('source changed: '+item['path'])
    grade={'三':3,'六':6}[item['grade']];exam=1 if item['exam']=='第一次定期評量' else 2
    subject={'國語':'chinese','英語':'english','數學':'math','社會':'social','自然':'science','自然科學':'science'}[item['subject']]
    pid=f"dingxi-{item['year']}-g{grade}-exam{exam}-{subject}"
    row={**item,'absolutePath':str(file),'paperId':pid,'gradeNumber':grade,'examNumber':exam}
    folder=out/pid;folder.mkdir(exist_ok=True)
    role='paper' if item['kind']=='試卷' else 'key'
    suffix=file.suffix.lower();row['format']=suffix[1:]
    if suffix=='.pdf':
        if not raw.startswith(b'%PDF-'):raise ValueError('invalid PDF signature')
        doc=pymupdf.open(file);pages=[];texts=[]
        for index,page in enumerate(doc):
            text=page.get_text(sort=True);texts.append(f'\n\n=== PAGE {index+1} ===\n'+text)
            pages.append({'page':index+1,'width':page.rect.width,'height':page.rect.height,'textChars':len(text.strip()),'images':len(page.get_images())})
        (folder/(role+'.text.txt')).write_text(''.join(texts),encoding='utf-8')
        row['pages']=pages;row['pageCount']=len(pages);row['scanPages']=[p['page'] for p in pages if p['textChars']<30]
        doc.close()
    elif suffix=='.docx':
        if not zipfile.is_zipfile(file):raise ValueError('invalid DOCX signature')
        with zipfile.ZipFile(file) as z:
            xml=z.read('word/document.xml').decode('utf-8');row['textChars']=len(''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>',xml)))
            row['images']=len([n for n in z.namelist() if n.startswith('word/media/')]);row['needsOfficeRendering']=True
    elif suffix=='.doc':
        if not raw.startswith(bytes.fromhex('D0CF11E0A1B11AE1')):raise ValueError('invalid DOC signature')
        row['needsOfficeRendering']=True
    else:raise ValueError('unsupported format')
    files.append(row)
    pair=pairs.setdefault(pid,{'paperId':pid,'year':item['year'],'grade':grade,'exam':exam,'subject':item['subject'],'edition':item['edition'],'range':item['range']})
    if pair['edition']!=item['edition'] or pair['range']!=item['range'] or role in pair:raise ValueError('ambiguous pairing '+pid)
    pair[role]=row
for pair in pairs.values():
    if 'paper' not in pair or 'key' not in pair:raise ValueError('missing pair '+pair['paperId'])
    a=re.sub(r'^row\d+_(itmfile|ansfile)_','',pair['paper']['id']);b=re.sub(r'^row\d+_(itmfile|ansfile)_','',pair['key']['id'])
    if a!=b:raise ValueError('record id mismatch '+pair['paperId'])
    pair['sourceRecord']=a;pair['status']='published-pilot' if pair['paperId']=='dingxi-114-1-g3-exam1-science' else 'not-transcribed'
if len(pairs)!=20 or len(files)!=40:raise ValueError('expected 20 paper/key pairs for 114-1')
summary={'sourceYear':args.year,'excludedYears':sorted({i['year'] for i in manifest['items'] if i['year']!=args.year}),'files':len(files),'pairs':len(pairs),'pdfPages':sum(f.get('pageCount',0) for f in files),'scanPages':sum(len(f.get('scanPages',[])) for f in files),'officeFiles':sum(bool(f.get('needsOfficeRendering')) for f in files),'pairsByGrade':{str(g):sum(p['grade']==g for p in pairs.values()) for g in (3,6)}}
(out/'inventory.private.json').write_text(json.dumps({'summary':summary,'files':files,'pairs':list(pairs.values())},ensure_ascii=False,indent=2),encoding='utf-8')
(out/'inventory-summary.md').write_text('# 批次考古題盤點\n\n'+json.dumps(summary,ensure_ascii=False,indent=2)+'\n\n'+'\n'.join(f"- {p['paperId']}｜{p['subject']}｜{p['edition']}｜{p['range']}｜{p['paper']['format']}／{p['key']['format']}｜{p['status']}" for p in pairs.values()),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False))
