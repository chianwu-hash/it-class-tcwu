"""Faithful page-image practice; source answers are checked independently of UI order."""
from pathlib import Path
import json, hashlib, re, unicodedata
import pymupdf

root=Path(__file__).resolve().parents[2]
out=root/'automation/output/zhongzheng-grade9-20261102'
src=out/'past-exams'; dest=out/'interactive-past'; dest.mkdir(exist_ok=True)
read=lambda p:json.loads(p.read_text(encoding='utf-8'))
manifest=read(src/'manifest.private.json')
pool=read(out/'pool.private.json'); owner=pool[0]['question']['prompt']['media']
all_media=[m for r in pool for c in [r['question']['prompt'],r['question']['explanation']]+[o['content'] for o in r['question']['options']] for m in c['media']]
owner=all_media[0]['url'].split('/')[3]
assets={};bundles=[]
keys={
 (113,'國文'):'ACDBDDABAD ADBACCDBAB CDBCBCABDC',
 (114,'國文'):'ABDBB ABBDD DCDAC BCCDB ABBAB DBCCB CAABB BDACC CDDBA CD',
 (113,'英語'):'CBAACABCBA DABCADBBDC ADCBADBCAC BCDBAADABD',
 (114,'英語'):'CBBCAACACB BCBAABDCAC CBDBDABDBA CDDAABCBDA',
 (113,'社會'):'DACCBACCAD BADABBDDCB BCCBADBCDA CCCDAB CBBB CAADDCBDCD',
 (114,'社會'):'ACBADBDBCD BCCACADCAB CBDDCABABC AABADABCAC DDB C B CDDCA',
 (113,'自然'):'BAACA ABCCD ABABA CBACD DBCAC DCDCC BDD',
 (114,'自然'):'CBCAD DCDCB AADBC BCCCA CDADA DABBB ADABC BDCBD',
 (113,'數學'):'CDDBBA',
}
pages={
 (113,'國文'):[(1,1,9),(2,10,17),(3,18,26),(4,27,30)],
 (114,'國文'):[(1,1,14),(2,15,27),(3,28,34),(4,35,40),(5,41,43),(6,44,47)],
 (113,'英語'):[(1,11,21),(2,22,31),(3,32,37),(4,38,40)],
 (114,'英語'):[(1,11,20),(2,21,32),(3,33,38),(4,39,40)],
 (113,'社會'):[(1,1,7),(2,8,16),(3,17,26),(4,27,33),(5,34,43),(6,44,50)],
 (114,'社會'):[(1,1,10),(2,11,16),(3,17,25),(4,26,33),(5,34,42),(6,43,50)],
 (113,'自然'):[(1,1,9),(2,10,19),(3,20,27),(4,28,33)],
 (114,'自然'):[(1,1,12),(2,13,25),(3,26,40)],
 (113,'數學'):[(1,1,2),(2,3,6)],
 (114,'數學'):[],
}
slugs={'國文':'chinese','英語':'english','數學':'math','自然':'science','社會':'social'}
def find(year,sub,kind):
    word='英文' if sub=='英語' else sub
    return next(r for r in manifest if r['year']==year and word in r['title'] and r['title'].endswith(kind+'.pdf'))
def asset(record,page_no,clip=None,role='stem'):
    file=src/record['title']; raw=file.read_bytes();assert hashlib.sha256(raw).hexdigest()==record['sha256']
    doc=pymupdf.open(file);page=doc[page_no-1]
    rect=pymupdf.Rect(clip) if clip else page.rect
    assert page.rect.contains(rect)
    pix=page.get_pixmap(matrix=pymupdf.Matrix(160/72,160/72),clip=rect,alpha=False)
    data=pix.tobytes('png'); assert len(data)<5*1024*1024
    h=hashlib.sha256(data).hexdigest(); path=dest/(h+'.png');path.write_bytes(data)
    a={'hash':h,'url':f'https://quiz-media.invalid/{owner}/{h}','owner_id':owner,'object_path':f'{owner}/{h}','mime':'image/png','bytes':len(data),'file':str(path),'localFile':str(path),'md5':hashlib.md5(data).hexdigest()}
    assets[h]=a
    return {'url':a['url'],'sha256':h,'alt':record['title']+f' 第{page_no}頁'+('・官方解答局部' if role=='reference' else '・原卷圖像，可放大')}, {'file':record['title'],'sha256':record['sha256'],'page':page_no,'bbox':list(rect),'role':role,'imageSha256':h}
def y_of(record,phrase):
    pg=pymupdf.open(src/record['title'])[0]
    hits=pg.search_for(phrase);assert hits,phrase
    return hits[0].y0-5
for year in [113,114]:
 for sub in ['國文','英語','數學','自然','社會']:
    paper=find(year,sub,'試題');key=find(year,sub,'解答')
    rawtext=(src/key['title'].replace('.pdf','.txt')).read_text(encoding='utf-8')
    normalized=unicodedata.normalize('NFKC',rawtext)
    answers=''.join(keys.get((year,sub),'').split())
    if answers:
      if year==114 and sub=='國文':
        parsed=''.join(re.findall(r'(?m)^\s*\d+\s*~\s*\d+\s+([ABCD]+)\s*$',normalized))
      else:parsed=''.join(re.findall(r'(?m)^\s*([ABCD])\s*$',normalized))
      if sub=='社會':assert parsed==answers*2,(year,sub,parsed,answers)
      elif sub=='數學':
        # Inline table entries interleave question numbers and letters.
        section=normalized.split('二、選擇題')[1].split('三、填充題')[0]
        parsed=''.join(re.findall('[ABCD]',section));assert parsed==answers
      else:assert parsed[:len(answers)]==answers,(year,sub,parsed,answers)
    groups=[];entries=[];crops=[]
    for pn,first,last in pages[(year,sub)]:
      a,provenance=asset(paper,pn);crops.append(provenance)
      fields=[]
      for n in range(first,last+1):
        points=3 if sub=='自然' and year==113 and n<33 else 4 if sub=='自然' and year==113 else 2.5 if sub=='自然' else 3 if sub=='數學' else 2
        field={'id':f'choice-{n:02}','label':str(n),'text':f'原卷選擇題第 {n} 題（題文與選項見左側原卷圖像）','points':points,'answer':answers[n-1]}
        fields.append(field);entries.append({'id':field['id'],'source':{'fileId':'paper','page':pn,'sha256':paper['sha256']},'answerSource':{'fileId':'key','page':1,'sha256':key['sha256'],'raw':answers[n-1]},'points':points,'type':'code','review':'official-table-compared'})
      groups.append({'id':f'page-{pn}-choices','kind':'code','title':f'選擇題 {first}～{last}','sourceLabel':f'第{pn}頁','material':'依原卷題號選擇 A、B、C、D。此頁採原卷圖像，圖片可放大；送出整組後才揭示這組答案。','materialContent':{'text':'','media':[]},'promptContent':{'text':'','media':[]},'assets':[a],'choices':[{'id':c,'text':c,'content':{'text':c,'media':[]}} for c in 'ABCD'],'codes':list('ABCD'),'fields':fields,'notice':'歷年參考；115 上正式範圍尚未公告。'+('原卷配分合計為94分，不換算成100分。' if sub=='國文' else '')})
    def manual(mid,title,source_pages,points,refclip=None):
      imgs=[]
      for r,pn in source_pages:
        a,pr=asset(r,pn);imgs.append(a);crops.append(pr)
      reference,pr=asset(key,1,refclip,'reference');crops.append(pr)
      field={'id':mid,'label':title,'text':'請按原卷題號輸入答案、計算過程，或使用畫圖區。可先在紙上作答，再將各題答案及關鍵過程輸入此處。送出後對照官方參考，不自動判分。','points':points,'reference':'請逐題對照下方官方參考，核對符號、單位與計算過程。這組採自我核對，不列入自動分數。','referenceStatus':'provided'}
      groups.append({'id':mid,'kind':'manual','title':title,'sourceLabel':'非選擇題','material':'保留原卷作答意義；此組可以輸入文字或畫圖，答案與過程會保存。','materialContent':{'text':'','media':[]},'promptContent':{'text':'','media':[]},'assets':imgs,'choices':[],'codes':[],'fields':[field],'referenceUrl':reference['url']})
      entries.append({'id':mid,'source':{'fileId':'paper','page':source_pages[0][1],'sha256':source_pages[0][0]['sha256']},'answerSource':{'fileId':'key','page':1,'sha256':key['sha256'],'raw':'官方參考圖；不自動判分'},'points':points,'type':'manual'})
    blocked=[];issues=[]
    if sub=='英語':
      blocked=[{'id':f'listening-{n:02}','text':f'聽力第 {n} 題','points':2 if year==113 or n>10 else 1,'reason':'未取得原始聽力音檔，暫停聽力作答與計分；聽力文字稿未冒充音檔。'} for n in range(1,11 if year==113 else 16)]
      # 114 listening 1–15 = 20 points; 11–15 must also be excluded from page 1.
      if year==114:
        g=groups[0];g['fields']=[f for f in g['fields'] if int(f['label'])>=16];g['title']='選擇題 16～20';entries=[e for e in entries if not(e['id'].startswith('choice-') and int(e['id'].split('-')[1])<16)]
      pg=pymupdf.open(src/key['title'])[0];cut=y_of(key,'第二部分' if year==113 else '第三部分')
      manual('written','英語手寫題・自我核對',[(paper,4)],20 if year==113 else 30,[0,cut,pg.rect.width,pg.rect.height])
      issues.append('無原始聽力音檔，聽力20分暫停。')
    elif sub=='國文' and year==113:
      answerpaper=find(year,sub,'答案卷');pg=pymupdf.open(src/key['title'])[0];cut=y_of(key,'貳、選擇題')
      manual('written','國字注音、解釋與默寫・自我核對',[(answerpaper,1)],34,[0,0,pg.rect.width,cut])
    elif sub=='數學':
      pg=pymupdf.open(src/key['title'])[0]
      if year==113:
        cut=y_of(key,'二、選擇題'); lower=y_of(key,'三、填充題')
        manual('basic','基本觀念題・自我核對',[(paper,1)],40,[0,0,pg.rect.width,cut])
        manual('written','填充與計算題・自我核對',[(paper,2),(paper,3),(paper,4)],42,[0,lower,pg.rect.width,pg.rect.height])
      else:manual('written','數學全卷・自我核對',[(paper,1),(paper,2),(paper,3)],100)
      issues.append('計算與非選擇題採保存作答及官方參考自我核對；不自動判分，不以人工題數冒充自動題數。')
    if sub=='國文':issues.append('下載原卷所列配分合計94分，保留原配分，不自行補足100分。')
    if sub=='自然' and year==113:issues.append('試題首頁列第2、3、6章，解答首頁列第2、3、5章；採同頁公告配對，保留差異，不將解答頁誤植當作今年範圍。')
    # Preserve any passage/figure continuing from the preceding source page.
    for g in groups:
      if g['kind']=='code':
        pn=int(g['id'].split('-')[1])
        if pn>1:
          previous,pr=asset(paper,pn-1);g['assets'].insert(0,previous);crops.append(pr)
    pid=f'zhongzheng-{year}-1-g9-exam2-{slugs[sub]}'
    doc={'schema':2,'title':f'中正國中{year}上九年級第二次段考{sub}'+('・自我核對版' if sub=='數學' and year==114 else ''),'catalog':{'subject':sub,'sourceYear':f'{year}-1','exam':2,'grade':9,'volume':'9年級上學期','school_stage':'junior_high','scope_status':'historical_reference','school':'新北市立中正國民中學'},'groups':groups,'blocked':blocked}
    provenance={'sourceVersion':f'ccjhs-{year}-1-g9-exam2','sourceFiles':[{'fileId':label,'name':r['title'],'sha256':r['sha256']} for label,r in [('paper',paper),('key',key)]],'entries':entries,'crops':crops,'issues':issues,'qc':{'status':'source-table-compared','answerCount':len(answers),'answerTableCrossCheck':True,'renderMode':'original-page-image','manualGrade':False}}
    bundle={'paperId':pid,'owner':owner,'document':doc,'provenance':provenance,'sha256':hashlib.sha256(json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode()).hexdigest(),'assets':[]}
    bundle['assets']=[assets[h] for h in {c['imageSha256'] for c in crops}]
    bundles.append(bundle)
    (dest/(pid+'.private.json')).write_text(json.dumps(bundle,ensure_ascii=False,indent=2),encoding='utf-8')
(dest/'bundles.private.json').write_text(json.dumps(bundles,ensure_ascii=False),encoding='utf-8')
(dest/'assets.private.json').write_text(json.dumps(assets,ensure_ascii=False),encoding='utf-8')
summary=[{'id':b['paperId'],'groups':len(b['document']['groups']),'autoFields':sum(len(g['fields']) for g in b['document']['groups'] if g['kind']!='manual'),'manualGroups':sum(g['kind']=='manual' for g in b['document']['groups']),'blocked':len(b['document']['blocked']),'automaticPoints':sum(f['points'] for g in b['document']['groups'] if g['kind']!='manual' for f in g['fields'])} for b in bundles]
(dest/'build-report.private.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'papers':len(bundles),'assets':len(assets),'summary':summary},ensure_ascii=False))
