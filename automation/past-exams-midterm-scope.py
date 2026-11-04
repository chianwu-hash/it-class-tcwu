"""建立 113／114 上學期期中範圍；不改寫先前 114 批次的驗收證據。"""
import hashlib,json,shutil,re
import pymupdf
from pathlib import Path

source=Path('D:/projects/it-class-tcwu/automation/output/past-exams-113-114-1')
old=Path('automation/output/past-exams-batch')
root=Path('automation/output/past-exams-midterms');root.mkdir(exist_ok=True)
manifest=json.loads((source/'manifest.json').read_text(encoding='utf-8-sig'))
pairs={}
subjects={'國語':'chinese','英語':'english','數學':'math','社會':'social','自然':'science','自然科學':'science'}
for item in manifest['items']:
    if item['year'] not in ['113-1','114-1'] or item['exam']!='第一次定期評量':continue
    file=source/item['path'].replace('\\','/');raw=file.read_bytes()
    assert hashlib.sha256(raw).hexdigest()==item['sha256'] and len(raw)==item['bytes']
    grade={'三':3,'六':6}[item['grade']]
    pid=f"dingxi-{item['year']}-g{grade}-exam1-{subjects[item['subject']]}"
    pair=pairs.setdefault(pid,dict(paperId=pid,year=item['year'],grade=grade,exam=1,subject=item['subject'],edition=item['edition'],range=item['range']))
    assert pair['edition']==item['edition'] and pair['range']==item['range']
    role='paper' if item['kind']=='試卷' else 'key';assert role not in pair
    pair[role]={**item,'absolutePath':str(file),'format':file.suffix[1:].lower()}
assert len(pairs)==20 and all('paper' in p and 'key' in p for p in pairs.values())
for p in pairs.values():
    records=[re.sub(r'^row\d+_(itmfile|ansfile)_','',p[r]['id']) for r in ['paper','key']]
    assert records[0]==records[1],'原卷／解答來源編號不符'
    p['sourceRecord']=records[0]
new=[p for p in pairs.values() if p['year']=='113-1']
for p in new:
    src=old/p['paperId'];dst=root/p['paperId'];dst.mkdir(exist_ok=True)
    sources={};(dst/'pages').mkdir(exist_ok=True)
    for role in ['paper','key']:
        item=p[role];original=Path(item['absolutePath']);pdf=original if item['format']=='pdf' else src/(role+'.office.pdf')
        assert pdf.is_file(),f'需先轉檔 {pdf}'
        pages=[];texts=[];sortedtexts=[]
        with pymupdf.open(pdf) as doc:
            for i,page in enumerate(doc):
                image=dst/'pages'/f'{role}-{i+1:03}.jpg'
                if not image.exists():page.get_pixmap(dpi=160,alpha=False).save(image,jpg_quality=90)
                text=page.get_text(sort=False);sortedtext=page.get_text(sort=True)
                pages.append(dict(page=i+1,width=page.rect.width,height=page.rect.height,rotation=page.rotation,text=text,sortedText=sortedtext,blocks=[{'bbox':list(b[:4]),'text':b[4]} for b in page.get_text('blocks') if len(b)>4 and isinstance(b[4],str)],image=str(image.resolve())))
                texts.append(f'\n=== PAGE {i+1} ===\n'+text);sortedtexts.append(f'\n=== PAGE {i+1} ===\n'+sortedtext)
        (dst/(role+'.native.txt')).write_text(''.join(texts),encoding='utf-8');(dst/(role+'.text.txt')).write_text(''.join(sortedtexts),encoding='utf-8')
        sources[role]=dict(original=str(original),originalSha256=item['sha256'],pdf=str(pdf.resolve()),pdfSha256=hashlib.sha256(pdf.read_bytes()).hexdigest(),pages=pages)
    (dst/'source-pages.private.json').write_text(json.dumps(dict(paperId=p['paperId'],sources=sources),ensure_ascii=False,indent=2),encoding='utf-8')
scope={'sourceYears':['113-1','114-1'],'exam':1,'grades':[3,6],'paperIds':sorted(pairs),'publishedPaperIds':sorted(p['paperId'] for p in pairs.values() if p['year']=='114-1'),'unopenedPaperIds':[f'dingxi-114-1-g{g}-exam2-{s}' for g in [3,6] for s in ['chinese','english','math','science','social']]}
for name,data in [('publication-scope.json',scope),('inventory.private.json',{'pairs':list(pairs.values()),'sourceFilesVerified':40})]:
    (root/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'open':len(pairs),'new113':len(new),'unopened':len(scope['unopenedPaperIds']),'sourceFilesVerified':40}))
