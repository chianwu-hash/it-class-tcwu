"""發布建池前回讀 Word 字型；來源／工具缺漏或注音未轉換即拒絕。"""
import sys,json,re
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'lib'))
from quiz_native_docx_content import Native,ns,split_options

def fields(q):
    return {'prompt':q['prompt'],**{f'option_{i}':o['content'] for i,o in enumerate(q['options'])},'explanation':q['explanation']}

def verify(rows):
    checked=0;phonetic=0;failures=[]
    for row in rows:
        course=row['checks']['source_catalog']
        if course not in ('kang-g3-ch','kang-g6-ch'):
            continue
        checked+=1
        try:
            folder=Path(__file__).resolve().parents[1]/'output/quiz/all-midterm-local'/course
            native=Native(folder/'source'/(row['source_item_id']+'.docx'),folder)
            if not native.font_changes:
                continue
            phonetic+=1
            if all(not o['content'].get('media') for o in row['question']['options']):
                option_texts=[o['content']['text'].strip() for o in row['question']['options']]
                if len(set(option_texts))!=len(option_texts):
                    raise ValueError('duplicate_phonetic_options')
            cells=native.root.find('w:body/w:tbl',ns).findall('w:tr',ns)[1].findall('w:tc',ns)
            values=split_options(native.nodes(cells[0]))
            expected=dict(prompt=values[0],**{f'option_{i}':v for i,v in enumerate(values[1:])},explanation=native.nodes(cells[2]))
            for name,content in fields(row['question']).items():
                text=expected[name]['text']
                # 僅檢查承載純注音的欄位；不重建已核對的圖片與公式。
                if any('\u3105'<=c<='\u312f' for c in text):
                    if content['text'].rstrip().removesuffix('。')!=text.rstrip().removesuffix('。'):
                        raise ValueError('phonetic_field_mismatch:'+name)
                    if content.get('layout'):
                        rendered=''.join(run.get('text','') for part in content['layout'] for runs in ([part['runs']] if part['type']=='paragraph' else [cell for row in part['rows'] for cell in row]) for run in runs if run['type']=='text')
                        if re.sub(r'\s+','',rendered).removesuffix('。')!=re.sub(r'\s+','',text).removesuffix('。'):
                            raise ValueError('phonetic_layout_mismatch:'+name)
        except Exception as exc:
            failures.append({'id':row['source_item_id'],'error':str(exc)})
    if failures:
        raise ValueError(json.dumps({'chinese_font_validation_failed':failures},ensure_ascii=True))
    return {'checked':checked,'phonetic_questions':phonetic}

if __name__=='__main__':
    print(json.dumps(verify(json.load(sys.stdin))))
