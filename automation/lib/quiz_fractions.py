"""以原始 WMF 可見分子、分母及橫線辨識分數；不讀 OLE 快取。"""
import re,struct,copy,hashlib

def visible_fraction(raw):
    # Read the actual visible WMF vector text and fraction bar, never stale OLE values.
    if raw[:4]!=b'\xd7\xcd\xc6\x9a':return None
    p=40;texts=[];lines=[];start=None;ended=False
    try:
        while p+6<=len(raw):
            words,fn=struct.unpack_from('<IH',raw,p)
            if words<3 or p+words*2>len(raw):return None
            b=raw[p+6:p+words*2]
            if fn==0:
                if words!=3:return None
                ended=True
                break
            if fn in (0x0324,0x0325,0x0418,0x041b,0x061c,0x0538,0x0817,0x081a):return None
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
        if not ended or len(texts)!=2 or len(lines)!=1 or any(not re.fullmatch(r'[0-9]{1,10}',t[2]) for t in texts):return None
        top,bottom=sorted(texts);bar=lines[0][0][0]
        if not top[0]<bar<bottom[0] or int(bottom[2])==0:return None
        return '\\frac{'+top[2]+'}{'+bottom[2]+'}'
    except (ValueError,struct.error,UnicodeDecodeError):return None

def replace_content_fractions(content, formulas):
    """回傳新的內容與稽核；保留其他圖片、表格及音訊，不修改原件。"""
    c=copy.deepcopy(content); audit=[]
    groups=[rs for p in c.get('layout',[]) for rs in ([p['runs']] if p['type']=='paragraph' else [cell for row in p['rows'] for cell in row])]
    for runs in groups:
        for i,run in enumerate(runs):
            if run.get('type')!='image': continue
            media=c['media'][run['media_index']]
            key=media['url'].rsplit('/',1)[-1].split('.')[0]
            formula=formulas.get(key)
            if not formula: continue
            if formula.get('media_sha256',formula.get('source_sha256'))!=key: raise ValueError('fraction_source_sha_mismatch')
            latex=formula['latex']
            if not re.fullmatch(r'\\frac\{[0-9]{1,10}\}\{[0-9]{1,10}\}',latex): raise ValueError('invalid_fraction_latex')
            if int(latex.rsplit('{',1)[-1][:-1])==0: raise ValueError('zero_denominator')
            runs[i]={'type':'text','text':'$'+latex+'$'}
            audit.append(dict(formula))
    if not audit:return c,audit
    used={i for i,m in enumerate(c.get('media',[])) if m.get('kind')!='image'}
    used.update(r['media_index'] for rs in groups for r in rs if r.get('type')=='image')
    ordered=sorted(used); remap={old:i for i,old in enumerate(ordered)}
    c['media']=[c['media'][i] for i in ordered]
    for rs in groups:
        for r in rs:
            if r.get('type')=='image':r['media_index']=remap[r['media_index']]
    c['text']='\n'.join(''.join(r['text'] for r in rs if r.get('type')=='text') for rs in groups).strip()
    return c,audit

def assert_no_fraction_images(content, formulas):
    _,audit=replace_content_fractions(content,formulas)
    if audit: raise ValueError('unconverted_fraction_images: '+str(len(audit)))
