"""只使用已複製的本機來源建立圖文目錄；不再連到光碟。"""
import pathlib,json,gzip,zipfile,io,re,hashlib,posixpath,collections,unicodedata
import sys
sys.stdout.reconfigure(encoding='utf-8')
from lxml import etree as E
from PIL import Image
import struct
formula_audit=[]
def visible_fraction(raw):
    # Read the actual visible WMF vector text and fraction bar, never stale OLE values.
    if raw[:4]!=b'\xd7\xcd\xc6\x9a':return None
    p=40;texts=[];lines=[];start=None
    try:
        while p+6<=len(raw):
            words,fn=struct.unpack_from('<IH',raw,p)
            if words<3 or p+words*2>len(raw):return None
            b=raw[p+6:p+words*2]
            if fn==0x0a32:
                y,x,n,opts=struct.unpack_from('<hhhh',b);pos=8+(8 if opts&6 else 0)
                t=b[pos:pos+n].decode('ascii').strip()
                if t:texts.append((y,x,t))
            elif fn==0x0521:
                n=struct.unpack_from('<H',b)[0];t=b[2:2+n].decode('ascii').strip();y,x=struct.unpack_from('<hh',b,2+((n+1)//2)*2)
                if t:texts.append((y,x,t))
            elif fn==0x0214:start=struct.unpack_from('<hh',b)
            elif fn==0x0213:
                end=struct.unpack_from('<hh',b)
                if start and start[0]==end[0] and abs(start[1]-end[1])>30:lines.append((start,end))
                start=end
            p+=words*2
        if len(texts)!=2 or len(lines)!=1 or any(not re.fullmatch(r'[0-9]{1,4}',t[2]) for t in texts):return None
        top,bottom=sorted(texts);bar=lines[0][0][0]
        if not top[0]<bar<bottom[0] or int(bottom[2])==0:return None
        return '\\frac{'+top[2]+'}{'+bottom[2]+'}'
    except (ValueError,struct.error,UnicodeDecodeError):return None
base=pathlib.Path(__file__).resolve().parent

ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships','v':'urn:schemas-microsoft-com:vml','wp':'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'}
def clean(s):return s.replace('\u3000',' ').replace('\u2009',' ')
def norm(s):
    s=re.sub(r'\$\\frac\{[0-9]+\}\{[0-9]+\}\$','',s)
    s=re.sub(r'\$\\boxed\{([0-9]+)\}\$',r'\1',s)
    return re.sub(r'\s+','',s).replace('☐','□').replace('⋯','…').replace('◯','○').removesuffix('。')
def textof(runs):return ''.join(r['text'] for r in runs if r['type']=='text')
def parse(file):
    with zipfile.ZipFile(io.BytesIO(gzip.decompress(file.read_bytes()))) as z:
        x=E.fromstring(z.read('word/document.xml'))
        rels={r.get('Id'):posixpath.normpath('word/'+r.get('Target')) for r in E.fromstring(z.read('word/_rels/document.xml.rels'))}
        media=[];indexes={}
        def para(p):
            assert all(E.QName(c).localname in ('r','pPr','bookmarkStart','bookmarkEnd','proofErr') for c in p),'unsupported_paragraph_child'
            runs=[];field=None
            def txt(t):
                t=clean(t)
                if not t:return
                if runs and runs[-1]['type']=='text':runs[-1]['text']+=t
                else:runs.append({'type':'text','text':t})
            for run in p.findall('w:r',ns):
                for node in run:
                    tag=E.QName(node).localname
                    if tag=='fldChar':
                        kind=node.get('{'+ns['w']+'}fldCharType')
                        if kind=='begin':assert field is None;field=''
                        elif kind=='end':
                            assert field is not None
                            field=re.sub(r'\\{2,}',lambda _: '\\',field)
                            boxed=re.fullmatch(r'\s*EQ\s+\\o\(([0-9]),□\)\s*',field,re.I)
                            if boxed:
                                txt('$\\boxed{'+boxed[1]+'}$');field=None;continue
                            match=re.fullmatch(r'\s*eq\s+\\o(?:\\ac)?\(○,([１２３４５６７８９０0-9]+)\)\s*',field,re.I)
                            assert match,('未知Word欄位',field)
                            runs.append({'type':'marker','number':int(unicodedata.normalize('NFKC',match[1]))});field=None
                        else:raise ValueError('未支援欄位分隔')
                    elif tag=='instrText':
                        assert field is not None;field+=node.text or ''
                    elif tag=='t':assert field is None;txt(node.text or '')
                    elif tag in ('br','cr'):txt('\n')
                    elif tag=='tab':txt(' ')
                    elif tag=='sym':
                        assert node.get('{'+ns['w']+'}font')=='Symbol' and node.get('{'+ns['w']+'}char')=='F0B4','未知符號字型'
                        txt('×')
                    elif tag in ('drawing','object','pict'):
                        refs=node.xpath('.//a:blip/@r:embed|.//v:imagedata/@r:id',namespaces=ns)
                        assert len(refs)==1,('圖形參照數',len(refs))
                        name=rels[refs[0]];raw=z.read(name);digest=hashlib.sha256(raw).hexdigest();ext=pathlib.PurePosixPath(name).suffix.lower()
                        fraction=visible_fraction(raw) if ext=='.wmf' else None
                        if fraction:
                            txt('$'+fraction+'$');formula_audit.append({'source_image_sha256':digest,'latex':fraction,'method':'visible_wmf_text_and_bar'});continue
                        web=digest+'.png' if ext in ('.emf','.wmf') else digest+ext
                        crop=node.find('.//a:srcRect',ns)
                        if crop is not None and any(int(v) for v in crop.attrib.values()):
                            spec={k:int(crop.get(k,'0')) for k in ['l','t','r','b']}
                            cropped=hashlib.sha256((web+json.dumps(spec,sort_keys=True)).encode()).hexdigest()+'.png'
                            with Image.open(base/'web-images'/web) as image:
                                w,h=image.size;box=(round(w*spec['l']/100000),round(h*spec['t']/100000),round(w*(1-spec['r']/100000)),round(h*(1-spec['b']/100000)))
                                assert box[2]>box[0] and box[3]>box[1]
                                image.crop(box).save(base/'web-images'/cropped)
                            web=cropped
                        if web not in indexes:
                            indexes[web]=len(media);media.append({'kind':'image','url':'https://hanlin-midterm.example.invalid/'+web,'alt':'書商原圖'})
                        extent=node.find('.//wp:extent',ns)
                        if extent is not None:width=float(extent.get('cx'))/9525
                        else:
                            style=''.join(node.xpath('.//v:shape/@style',namespaces=ns));m=re.search(r'width:([\d.]+)(pt|in)',style);assert m,style;width=float(m[1])*(96/72 if m[2]=='pt' else 96)
                        runs.append({'type':'image','media_index':indexes[web],'width':round(max(18,min(800,width*1.5)),2)})
                    elif tag in ('rPr','lastRenderedPageBreak'):pass
                    else:raise ValueError('未知run:'+tag)
            assert field is None
            return runs
        layout=[]
        for node in x.find('w:body',ns):
            tag=E.QName(node).localname
            if tag=='p':
                runs=para(node)
                if runs:layout.append({'type':'paragraph','runs':runs})
            elif tag=='tbl':
                assert not node.xpath('.//w:vMerge',namespaces=ns),'尚未支援直向合併表格'
                rows=[];spans=[]
                for tr in node.findall('w:tr',ns):
                    before=tr.find('w:trPr/w:gridBefore',ns);after=tr.find('w:trPr/w:gridAfter',ns)
                    row=[[] for _ in range(int(before.get('{'+ns['w']+'}val')) if before is not None else 0)]
                    for tc in tr.findall('w:tc',ns):
                        assert not tc.findall('w:tbl',ns),'巢狀表格'
                        runs=[]
                        for p in tc.findall('w:p',ns):
                            v=para(p)
                            if runs and v:runs.append({'type':'text','text':'\n'})
                            runs.extend(v)
                        span=tc.find('w:tcPr/w:gridSpan',ns);width=int(span.get('{'+ns['w']+'}val')) if span is not None else 1
                        if width>1:spans.append({'row':len(rows),'column':len(row),'colspan':width})
                        row.append(runs);row.extend([[] for _ in range(width-1)])
                    row.extend([[] for _ in range(int(after.get('{'+ns['w']+'}val')) if after is not None else 0)])
                    rows.append(row)
                assert len({len(row) for row in rows})==1
                table={'type':'table','rows':rows}
                if spans:table['source_spans']=spans
                layout.append(table)
            else:assert tag in ('sectPr','bookmarkStart','bookmarkEnd'),tag
        return {'media':media,'layout':layout}
def content(layout,media):
    # 選項拆分後重新編列媒體，避免多帶答案或其他選項素材。
    layout=json.loads(json.dumps(layout));used=[]
    def visit(runs):
        for j,r in enumerate(runs):
            if r['type']=='marker':runs[j]={'type':'text','text':chr(0x2460+r['number']-1)}
            elif r['type']=='image':
                old=r['media_index']
                if old not in used:used.append(old)
                r['media_index']=used.index(old)
    for block in layout:
        if block['type']=='paragraph':visit(block['runs'])
        else:
            for row in block['rows']:
                for cell in row:visit(cell)
    texts=[]
    for block in layout:
        runs=[block['runs']] if block['type']=='paragraph' else [cell for row in block['rows'] for cell in row]
        texts.extend(textof(v) for v in runs)
    if not layout:return {'text':'','media':[]}
    return {'text':'\n'.join(texts).strip(),'media':[media[i] for i in used],'layout':layout}
def split_mc(raw,q):
    layouts=[[] for _ in range(5)];active=0;markers=[]
    for block in raw['layout']:
        if block['type']=='table':layouts[active].append(block);continue
        runs=[]
        def flush():
            nonlocal runs
            if runs:layouts[active].append({'type':'paragraph','runs':runs});runs=[]
        for run in block['runs']:
            if run['type']=='marker':
                flush();active=run['number'];assert active<=4;markers.append(active)
            else:runs.append(run)
        flush()
    assert markers==[1,2,3,4],markers
    values=[content(v,raw['media']) for v in layouts]
    for i,v in enumerate(values[1:]):assert norm(v['text'])==norm(q['options'][i]),('選項文字不符',i,v['text'],q['options'][i])
    return values
