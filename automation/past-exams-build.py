"""將逐頁校對的中立草稿轉為本機預覽及私有匯入包；不連線、不發布。"""
import argparse,hashlib,html,json,re
from pathlib import Path
import pymupdf

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def write(path,data):path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def build(pid,root,require_qc=False):
    scope=read(root/'publication-scope.json')
    if pid not in scope['paperIds'] or pid in scope['publishedPaperIds']:raise ValueError('不在本次新增範圍，或為不可覆寫的既有試辦')
    folder=root/pid;draftpath=folder/'reviewed.private.json'
    if not draftpath.exists():draftpath=folder/'draft.private.json'
    draft=read(draftpath);sources=read(folder/'source-pages.private.json')['sources']
    pair=next(p for p in read(root/'inventory.private.json')['pairs'] if p['paperId']==pid)
    assert draft['paperId']==pid and draft['sourceTotal']==100
    for source in sources.values():
        assert digest(Path(source['original']))==source['originalSha256'],'原檔已變更'
        assert digest(Path(source['pdf']))==source['pdfSha256'],'轉檔已變更'
    groups=draft['groups'];blocked=draft['blocked'];fields=[f for g in groups for f in g['fields']]
    ids=[f['id'] for f in fields]+[b['id'] for b in blocked]
    assert len(ids)==len(set(ids)) and 0<len(fields)<=200 and 0<len(groups)<=100,'題號重複或數量超限'
    assert len({g['id'] for g in groups})==len(groups)
    bonus=draft.get('sourceBonusTotal',0)
    assert abs(sum(f['points'] for f in fields)+sum(b['points'] for b in blocked)-100-bonus)<.001,'基本配分與加分合計不符'
    assert sum(f['points'] for g in groups if g.get('optional') for f in g['fields'])==bonus,'選做加分配分不符'
    assert all(re.fullmatch(r'[A-Za-z0-9_-]{1,80}',v) for v in ids)
    for f in fields+blocked:
        assert 0<f['points']<=100 and 1<=f['paperPage']<=len(sources['paper']['pages']) and 1<=f['keyPage']<=len(sources['key']['pages'])
        assert f['text'].strip() and str(f['officialRaw']).strip(),'缺原題或官方記號'
    for g in groups:
        if g['kind']=='code' and not g['choices'] and g['codes']:
            g['choices']=[{'id':code,'text':code,'assets':[]} for code in g['codes']]
        assert g['kind'] in ['single','short','mark','code','set','sequence','manual','annotation']
        assert not re.search(r'同\s+s\d+-q|同上共同|同前共同',g['material']),'共同題幹仍為內部簡寫'
        assert 1<=len(g['fields'])<=30
        if g['kind'] in ['single','manual','annotation','sequence']:assert len(g['fields'])==1
        if g['kind']=='manual':assert g['fields'][0].get('reference','').strip() and 'answer' not in g['fields'][0]
        if g.get('optional'):assert g['kind']=='manual','選做只開放不計自動分數的自我核對'
        if g['kind'] not in ('annotation','manual'):assert all('answer' in f for f in g['fields'])
    owner=read(Path('automation/output/past-exam-production/bundle.private.json'))['owner']
    assets={};manifest=[];(folder/'assets').mkdir(exist_ok=True)
    crops=draft['crops'];assert len({c['id'] for c in crops})==len(crops)
    for c in crops:
        assert c['source'] in ('paper','key') and c['role'] in ('stem','choice','reference')
        assert (c['source']=='key')==(c['role']=='reference'),'解答圖只能作揭答參考'
        source=sources[c['source']];assert 1<=c['page']<=len(source['pages'])
        doc=pymupdf.open(source['pdf']);page=doc[c['page']-1];box=pymupdf.Rect(c['bbox'])
        assert not box.is_empty and page.rect.contains(box),'裁圖超出原頁或為空'
        pix=page.get_pixmap(clip=box,dpi=300,alpha=False)
        for masked in c.get('excludeBboxes',[]):
            mask=pymupdf.Rect(masked);assert box.contains(mask),'清除區域超出裁圖'
            assert pix.set_rect(pymupdf.IRect(mask*pymupdf.Matrix(300/72,300/72)),(255,255,255)),'清除區域未與圖片相交'
        raw=pix.tobytes('png');sha=hashlib.sha256(raw).hexdigest();path=folder/'assets'/f'{sha}.png';path.write_bytes(raw)
        assert len(raw)<=5*1024*1024,'裁圖超過媒體大小限制'
        url=f'https://quiz-media.invalid/{owner}/{sha}'
        assets[c['id']]={'url':url,'sha256':sha,'alt':c['alt']}
        manifest.append({**c,'sha256':sha,'sourceSha256':source['originalSha256'],'pdfSha256':source['pdfSha256'],'dpi':300,'width':page.get_pixmap(clip=box,dpi=300,alpha=False).width,'height':page.get_pixmap(clip=box,dpi=300,alpha=False).height,'bytes':len(raw),'file':str(path.resolve()),'url':url})
        doc.close()
    roles={c['id']:c['role'] for c in crops}
    runtime=[];entries=[]
    def provenance(f,kind):
        return {'id':f['id'],'points':f['points'],'type':kind,'source':{'fileId':'paper','page':f['paperPage'],'sha256':sources['paper']['originalSha256']},'answerSource':{'fileId':'key','page':f['keyPage'],'sha256':sources['key']['originalSha256'],'raw':f['officialRaw']}}
    for g in groups:
        for cid in g['assets']:assert roles[cid]=='stem'
        out={k:g[k] for k in ['id','kind','title','sourceLabel','material','codes']}
        if g.get('notice'):out['notice']=g['notice']
        if g.get('optional'):out['optional']=True
        prompt=g.get('prompt','')
        if g['kind'] in ('single','short') and len(g['fields'])==1 and not prompt.strip():prompt=g['fields'][0]['text']
        out.update(materialContent={'text':g['material'],'media':[]},promptContent={'text':prompt,'media':[]},assets=[assets[a] for a in g['assets']],fields=[])
        out['choices']=[]
        for c in g['choices']:
            for cid in c['assets']:assert roles[cid]=='choice'
            out['choices'].append({'id':c['id'],'text':c['text'],'content':{'text':c['text'],'media':[{'kind':'image','url':assets[a]['url'],'alt':assets[a]['alt']} for a in c['assets']]}})
        if g.get('referenceAsset'):
            assert g['kind'] in ('manual','annotation') and roles[g['referenceAsset']]=='reference'
            out['referenceUrl']=assets[g['referenceAsset']]['url']
        for f in g['fields']:
            entry=provenance(f,g['kind']);entries.append(entry)
            out['fields'].append({k:f[k] for k in ['id','label','text','points','answer','reference','referenceStatus'] if k in f})
        runtime.append(out)
    for b in blocked:entries.append(provenance(b,'blocked'))
    doc={'schema':2,'title':draft['title'],'catalog':{'subject':'自然' if pair['subject']=='自然科學' else pair['subject'],'sourceYear':pair['year'],'exam':pair['exam'],'grade':pair['grade'],'edition':pair['edition'],'range':pair['range']},'groups':runtime,'blocked':[{k:b[k] for k in ['id','text','points','reason']} for b in blocked]}
    qcpath=folder/'qc.private.json';qc=read(qcpath) if qcpath.exists() else {}
    verified=qc.get('draftSha256')==digest(draftpath) and qc.get('fieldIds')==ids and qc.get('cropSha256')=={c['id']:c['sha256'] for c in manifest} and qc.get('status')=='verified'
    provenance_data={'sourceBankSha256':digest(draftpath),'sourceVersion':pair['sourceRecord'],'sourceFiles':[{'fileId':role,'name':pair[role]['name'],'sha256':sources[role]['originalSha256'],'pdfSha256':sources[role]['pdfSha256']} for role in ('paper','key')],'entries':entries,'issues':draft['issues'],'qc':qc if verified else {'status':'awaiting-independent-qc'}}
    bundle={'paperId':pid,'owner':owner,'document':doc,'provenance':provenance_data,'sha256':hashlib.sha256(json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode('utf-8')).hexdigest(),'assets':[{'hash':c['sha256'],'url':c['url'],'owner_id':owner,'object_path':f"{owner}/{c['sha256']}",'mime':'image/png','bytes':c['bytes'],'file':c['file']} for c in manifest]}
    bundle['assets']=list({a['hash']:a for a in bundle['assets']}.values())
    write(folder/'images-manifest.private.json',manifest);write(folder/'bundle.private.json',bundle)
    preview=['<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>考古題本機校對</title><style>body{font:18px/1.7 system-ui;margin:24px auto;max-width:1000px;padding:0 18px;color:#173b45}article{border:2px solid #b8dfe8;padding:20px;margin:22px 0;border-radius:20px}img{max-width:100%;max-height:650px}pre{white-space:pre-wrap;font:inherit}details{background:#eff9fc;padding:12px}</style>',f'<h1>{html.escape(doc["title"])}</h1><p>{"逐頁校對已完成" if verified else "轉錄草稿：未完成獨立校對，不可發布"}</p>']
    readable=[f'# {doc["title"]}\n\n狀態：'+('已校對' if verified else '草稿，尚不可發布')]
    def figure(cid):
        a=assets[cid];return f'<figure><img src="assets/{a["sha256"]}.png" alt="{html.escape(a["alt"],quote=True)}"><figcaption>{html.escape(cid)}</figcaption></figure>'
    for g in groups:
        preview.extend(['<article>',f'<h2>{html.escape(g["title"])}</h2><pre>{html.escape(g["material"])}</pre>'])
        readable.extend([f'\n## {g["title"]}\n',g['material']])
        preview.extend(figure(cid) for cid in g['assets'])
        for c in g['choices']:
            preview.append(f'<p>{html.escape(c["id"])}　{html.escape(c["text"])}</p>');preview.extend(figure(cid) for cid in c['assets'])
            readable.append(f'- {c["id"]}　{c["text"]}')
        for f in g['fields']:
            answer=f.get('answer',f.get('reference','參考圖'))
            preview.append(f'<pre>{html.escape(f["text"])}</pre><p>{f["points"]}分｜原卷{f["paperPage"]}頁／解答{f["keyPage"]}頁</p><details><summary>官方答案</summary>{html.escape(str(answer))}</details>')
            readable.append(f'\n{f["text"]}\n\n官方：{answer}；{f["points"]}分，原卷{f["paperPage"]}頁／解答{f["keyPage"]}頁。')
        if g.get('referenceAsset'):preview.append('<details><summary>官方參考圖</summary>'+figure(g['referenceAsset'])+'</details>')
        preview.append('</article>')
    preview.append('<h2>暫停題與問題紀錄</h2><pre>'+html.escape(json.dumps({'blocked':blocked,'issues':draft['issues']},ensure_ascii=False,indent=2))+'</pre></html>')
    (folder/'preview.private.html').write_text('\n'.join(preview),encoding='utf-8');(folder/'bank.private.md').write_text('\n\n'.join(readable),encoding='utf-8');write(folder/'issues.private.json',{'blocked':blocked,'issues':draft['issues']})
    if require_qc and not verified:raise ValueError('未完成獨立校對，拒絕匯入或發布')
    return {'paperId':pid,'groups':len(groups),'fields':len(fields),'blocked':len(blocked),'crops':len(manifest),'verified':verified}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('paper_id');p.add_argument('--require-qc',action='store_true');p.add_argument('--root',type=Path,default=Path('automation/output/past-exams-batch'));a=p.parse_args();print(json.dumps(build(a.paper_id,a.root,a.require_qc),ensure_ascii=False))
