"""純合成 WMF 與內容結構回歸；不需要私有教材。"""
import sys,struct,unittest,copy,tempfile,zipfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'lib'))
from quiz_fractions import visible_fraction,replace_content_fractions,assert_no_fraction_images

def record(fn,data=b''):
    data+=b'\0'*(len(data)%2)
    return struct.pack('<IH',3+len(data)//2,fn)+data

def fraction(n='3',d='8',bar=50):
    def text(s,y):return record(0x0521,struct.pack('<H',len(s))+s.encode()+b'\0'*(len(s)%2)+struct.pack('<hh',y,10))
    return b'\xd7\xcd\xc6\x9a'+b'\0'*36+text(n,10)+record(0x0214,struct.pack('<hh',bar,0))+record(0x0213,struct.pack('<hh',bar,100))+text(d,90)+record(0)

class Fractions(unittest.TestCase):
    def test_visible_not_cached(self):
        self.assertEqual(visible_fraction(fraction()),r'\frac{3}{8}')
        self.assertEqual(visible_fraction(fraction('12','100')),r'\frac{12}{100}')
        self.assertEqual(visible_fraction(fraction('1','100000')),r'\frac{1}{100000}')
    def test_reject_unknown(self):
        for raw in [b'',b'PNG',fraction('3','0'),fraction('x','8'),fraction(bar=100),fraction()[:-3]]:
            self.assertIsNone(visible_fraction(raw))
    def test_inline_table_audio_and_idempotence(self):
        f='a'*64;img='b'*64
        c={'text':'2','media':[{'kind':'image','url':'https://example.invalid/'+f},{'kind':'image','url':'https://example.invalid/'+img},{'kind':'audio','url':'https://example.invalid/audio'}],
           'layout':[{'type':'paragraph','runs':[{'type':'text','text':'2'},{'type':'image','media_index':0,'width':20}]},{'type':'table','rows':[[[{'type':'image','media_index':1,'width':80}]]]}]}
        before=copy.deepcopy(c);m={f:{'source_sha256':f,'latex':r'\frac{3}{8}'}}
        with self.assertRaises(ValueError):assert_no_fraction_images(c,m)
        out,audit=replace_content_fractions(c,m)
        self.assertEqual(c,before);self.assertEqual(len(audit),1)
        self.assertEqual(out['layout'][0]['runs'][1],{'type':'text','text':r'$\frac{3}{8}$'})
        self.assertEqual(out['layout'][1]['rows'][0][0][0]['media_index'],0)
        self.assertEqual([x['kind']for x in out['media']],['image','audio'])
        self.assertEqual(replace_content_fractions(out,m),(out,[]));assert_no_fraction_images(out,m)
    def test_hash_or_latex_mismatch_rejected(self):
        key='a'*64;c={'text':'','media':[{'kind':'image','url':'https://example.invalid/'+key}], 'layout':[{'type':'paragraph','runs':[{'type':'image','media_index':0}]}]}
        for f in [{'source_sha256':'bad','latex':r'\frac{1}{2}'},{'source_sha256':key,'latex':r'\frac{1}{0}'},{'source_sha256':key,'latex':'1/2'}]:
            with self.assertRaises(ValueError):replace_content_fractions(c,{key:f})
    def test_both_native_entrypoints_convert_mixed_fraction(self):
        from quiz_native_docx import Native
        from quiz_native_docx_content import Native as ContentNative
        xml='''<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:r><w:t>2</w:t></w:r><w:r><w:pict><v:shape style="width:20pt"><v:imagedata r:id="r1"/></v:shape></w:pict></w:r></w:p></w:body></w:document>'''
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);doc=root/'source.docx'
            with zipfile.ZipFile(doc,'w')as z:
                z.writestr('word/document.xml',xml)
                z.writestr('word/_rels/document.xml.rels','<Relationships><Relationship Id="r1" Target="media/fraction.wmf"/></Relationships>')
                z.writestr('word/media/fraction.wmf',fraction())
            for cls in [Native,ContentNative]:
                parser=cls(doc,root,**({'transform_fonts':False}if cls is ContentNative else {}))
                content=parser.nodes(parser.root.find('w:body',{'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}))
                self.assertEqual(content['text'],r'2$\frac{3}{8}$');self.assertEqual(content['media'],[])
                self.assertEqual(len(parser.formula_audit),1)
                parser.z.close()

if __name__=='__main__':unittest.main()
