"""原生Word圖文轉換；不執行巨集、不將題目截圖。原始檔另存備查。"""
import pathlib,zipfile,json,hashlib,re,posixpath,copy,unicodedata
import sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from quiz_chinese_fonts import convert_zhuyin_tree
from lxml import etree as E
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships','v':'urn:schemas-microsoft-com:vml','wp':'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'}
class Native:
 def __init__(self,file,base,transform_fonts=True):
  self.z=zipfile.ZipFile(file);self.base=pathlib.Path(base);self.root=E.fromstring(self.z.read('word/document.xml'));self.media=[];self.flags=[]
  self.font_changes=convert_zhuyin_tree(self.root) if transform_fonts else []
  self.rels={x.get('Id'):posixpath.normpath('word/'+x.get('Target')) for x in E.fromstring(self.z.read('word/_rels/document.xml.rels'))}
  for d in ['original-images','web-images']:(self.base/d).mkdir(exist_ok=True)
 def para(self,p):
  out=[];field=None
  def text(t):
   if not t:return
   if out and out[-1]['type']=='text':out[-1]['text']+=t
   else:out.append({'type':'text','text':t})
  for r in p:
   tag=E.QName(r).localname
   if tag in ['pPr','bookmarkStart','bookmarkEnd','proofErr']:continue
   if tag!='r':raise ValueError('unsupported paragraph element '+tag)
   for n in r:
    tag=E.QName(n).localname
    if tag=='rPr':continue
    if tag=='t':
     if field is None:text(n.text or '')
    elif tag in ['tab','br','cr']:text('\n' if tag!='tab' else ' ')
    elif tag=='instrText':
     if field is None:raise ValueError('Word field without begin')
     field+=n.text or ''
    elif tag=='fldChar':
     kind=n.get('{'+ns['w']+'}fldCharType')
     if kind=='begin':
      if field is not None:raise ValueError('nested Word field')
      field=''
     elif kind=='end':
      value=re.sub(r'\\{2,}',lambda m:'\\',field or '');m=re.fullmatch(r'\s*eq\s+\\o(?:\\ac)?\(○,([１２３４1-4ＡＢＣＤA-D])\)\s*',value,re.I)
      if not m:raise ValueError('unsupported Word field')
      marker=unicodedata.normalize('NFKC',m[1]);number=int(marker) if marker.isdigit() else ord(marker.upper())-ord('A')+1;text(chr(0x2460+number-1));field=None
     elif kind!='separate':raise ValueError('unsupported field control')
    elif tag=='sym':raise ValueError('symbol font requires verification')
    elif tag in ['drawing','object','pict']:
     refs=n.xpath('.//a:blip/@r:embed|.//v:imagedata/@r:id',namespaces=ns)
     if len(refs)!=1:raise ValueError('ambiguous image reference')
     member=self.rels[refs[0]];raw=self.z.read(member);sha=hashlib.sha256(raw).hexdigest();ext=pathlib.PurePosixPath(member).suffix.lower();original=sha+ext;web=sha+'.png' if ext in ['.emf','.wmf'] else original
     (self.base/'original-images'/original).write_bytes(raw)
     if ext not in ['.emf','.wmf']:(self.base/'web-images'/web).write_bytes(raw)
     if n.xpath('.//a:srcRect[@l or @t or @r or @b]',namespaces=ns):raise ValueError('cropped original requires verification')
     url='https://publisher-local.example.invalid/'+web
     idx=next((i for i,m in enumerate(self.media) if m['url']==url),None)
     if idx is None:idx=len(self.media);self.media.append({'kind':'image','url':url,'alt':'書商原圖'})
     extent=n.find('.//wp:extent',ns)
     if extent is not None:width=float(extent.get('cx'))/9525
     else:
      style=''.join(n.xpath('.//v:shape/@style',namespaces=ns));m=re.search(r'width:([\d.]+)(pt|in)',style)
      if not m:raise ValueError('missing image geometry')
      width=float(m[1])*(96/72 if m[2]=='pt' else 96)
     out.append({'type':'image','media_index':idx,'width':round(max(18,min(800,width*1.5)),2)})
    elif tag in ['lastRenderedPageBreak']:pass
    else:raise ValueError('unsupported run '+tag)
  return out
 def nodes(self,nodes):
  layout=[]
  for node in nodes:
   tag=E.QName(node).localname
   if tag=='p':
    runs=self.para(node)
    if runs:layout.append({'type':'paragraph','runs':runs})
   elif tag=='tbl':
    if node.xpath('.//w:gridSpan|.//w:vMerge|.//w:tbl/w:tr/w:tc/w:tbl',namespaces=ns):raise ValueError('merged or nested table')
    rows=[]
    for tr in node.findall('w:tr',ns):
     row=[]
     for tc in tr.findall('w:tc',ns):
      runs=[]
      for p in tc.findall('w:p',ns):
       more=self.para(p)
       if runs and more:runs.append({'type':'text','text':'\n'})
       runs.extend(more)
      row.append(runs)
     rows.append(row)
    if len({len(r) for r in rows})!=1:raise ValueError('ragged table')
    layout.append({'type':'table','rows':rows})
   elif tag not in ['tcPr','sectPr','bookmarkStart','bookmarkEnd']:raise ValueError('unsupported block '+tag)
  return compact(layout,self.media)
def groups(c):
 return [rs for p in c.get('layout',[]) for rs in ([p['runs']] if p['type']=='paragraph' else [c for row in p['rows'] for c in row])]
def compact(layout,media):
 c={'layout':copy.deepcopy(layout)};used=[]
 for runs in groups(c):
  for r in runs:
   if r['type']=='image':
    old=r['media_index']
    if old not in used:used.append(old)
    r['media_index']=used.index(old)
 c['media']=[copy.deepcopy(media[i]) for i in used];c['text']='\n'.join(''.join(r['text'] for r in rs if r['type']=='text') for rs in groups(c)).strip()
 if not layout:c.pop('layout')
 return c
def split_options(c):
 layouts=[[] for _ in range(5)];active=0;found=[]
 for p in c['layout']:
  if p['type']=='table':layouts[active].append(p);continue
  runs=[]
  def flush():
   nonlocal runs
   if runs:layouts[active].append({'type':'paragraph','runs':runs});runs=[]
  for r in p['runs']:
   if r['type']!='text':runs.append(r);continue
   start=0
   for m in re.finditer(r'[①②③④]|[（(][A-D][）)]',r['text']):
    if m.start()>start:runs.append({'type':'text','text':r['text'][start:m.start()]})
    flush();active=ord(m[0])-0x2460+1 if len(m[0])==1 else ord(m[0][1])-ord('A')+1;found.append(active);start=m.end()
   if start<len(r['text']):runs.append({'type':'text','text':r['text'][start:]})
  flush()
 if found not in [[1,2],[1,2,3],[1,2,3,4]]:raise ValueError('choice markers '+str(found))
 return [compact(v,c['media']) for v in layouts[:len(found)+1]]
