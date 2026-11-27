"""Extract original option cards from a two-column Hanlin worksheet grid."""
from collections import Counter, defaultdict
from hashlib import sha256
import argparse
import io
import json
from pathlib import Path
import re

import cv2
import numpy as np
from PIL import Image
from rapidocr_onnxruntime import RapidOCR

ORDINALS="①②③④⑤⑥"
DARK=210

def rule(condition, code):
    if not condition:
        raise ValueError(code)

def bands(projection, threshold):
    groups=[]
    for point in np.flatnonzero(projection>threshold).tolist():
        if groups and point==groups[-1][-1]+1:
            groups[-1].append(point)
        else:
            groups.append([point])
    return groups

def card_cells(rgb, ocr):
    mask=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)<DARK
    horizontal=bands(mask.mean(axis=1),.84)
    vertical=bands(mask.mean(axis=0),.84)
    rule(len(horizontal) in (3,4) and len(vertical)==3,"rectangular_dividers")
    h,w=mask.shape
    rule(horizontal[0][0]<12 and horizontal[-1][-1]>h-35 and
         vertical[0][0]<12 and vertical[-1][-1]>w-12,"rectangular_margins")
    results=[]
    for i,(top,bottom) in enumerate(zip(horizontal,horizontal[1:])):
        for j,(left,right) in enumerate(zip(vertical,vertical[1:])):
            x0,y0=left[-1]+2,top[-1]+2
            x1,y1=right[0]-1,bottom[0]-1
            card=rgb[y0:y1,x0:x1].copy()
            marks=mask[y0:y1,x0:x1]
            ch,cw=marks.shape
            rule(ch>=160 and cw>=150,"card_dimensions")
            detected,_=ocr(card)
            index=2*i+j
            leading=[]
            for box,text,score in detected or []:
                x,y=box[0]
                if x<=.085*cw and y<=.23*ch and score>=.65 and text.lstrip().startswith(ORDINALS[index]):
                    leading.append((box,text))
            rule(len(leading)==1,"printed_ordinal")
            box,_=leading[0]
            start=int(box[0][1])
            trailing=marks[:min(ch//3,110),int(.70*cw):]
            side=bands(trailing.mean(axis=0),.42)
            base=bands(trailing[:,-25:].mean(axis=1),.65)
            rule(len(side)==len(base)==1,"checkbox_border")
            bx=int(.70*cw)+side[0][0];by=base[0][-1]
            rule(.76*cw<=bx<=.90*cw and 23<=by<=100,"checkbox_position")
            rule(not marks[:by-3,bx+4:].any(),
                 "checkbox_not_empty")
            card[:by+2,bx:]=255
            prefix_width=int(.17*cw)
            prefix=marks[max(0,start-6):start+55,:prefix_width]
            _,_,stats,_=cv2.connectedComponentsWithStats(prefix.astype("uint8"))
            shapes=[(x,y,ww,hh) for x,y,ww,hh,size in stats[1:] if x<13 and 21<=ww<=42 and .81<=hh/ww<=1.21]
            rule(len(shapes)==1,"ordinal_glyph_boundary")
            x,y,ww,hh=shapes[0]
            cy=max(0,start-6)+y
            rule(x+ww+1<prefix_width and not marks[cy:cy+hh,x+ww:x+ww+1].any(),"ordinal_glyph_overlap")
            card[cy:cy+hh,x:x+ww]=255
            outer=(cv2.cvtColor(card,cv2.COLOR_RGB2GRAY)<245)
            yy,xx=np.nonzero(outer)
            rule(len(xx)>100,"option_empty")
            card=card[max(0,yy.min()-6):yy.max()+7,max(0,xx.min()-6):xx.max()+7]
            results.append((card,[int(v) for v in (x0,y0,x1,y1)], [int(v) for v in (x,cy,ww,hh)]))
    return results

def answer_indices(raw):
    normalized=re.sub(r"\s+","",raw)
    pieces=re.split(r"[；;、]",normalized)
    result=[]
    for piece in pieces:
        match=re.fullmatch(r"([①②③④⑤⑥]|\([1-6]\))[ˇ✓√✔vV]",piece)
        rule(match,"checkbox_key_format")
        label=match[1]
        result.append(ORDINALS.index(label)+1 if len(label)==1 else int(label[1]))
    rule(0<len(result)<=6 and sorted(set(result))==sorted(result),"checkbox_key_invalid")
    return sorted(result)

def ordinals_removed(text, keys):
    # A final phase that only re-lists the marked cards is redundant.
    final=re.search(r"[，。；;]\s*(?:所以|因此)?([^。；;]*[①②③④⑤⑥][^。；;]*)。?$",text)
    if final and sorted(set(ORDINALS.index(c)+1 for c in final[1] if c in ORDINALS))==keys:
        fragment=final[1]
        names=re.sub(r"[①②③④⑤⑥\s、，,（()）]|與|和|及|這兩個|這三個|個|正確|的選項|選項|要打勾|打勾|打ˇ|答案|選擇|選|全部都要|全都要|都要|全","",fragment)
        if len(names)<22 or re.fullmatch(r"(?:所以|因此)?[^①②③④⑤⑥。；;]{0,22}[①②③④⑤⑥、和及與\s]+(?:全|全部|都|要|應|選|打|勾|ˇ)*",fragment):
            text=text[:final.start()].rstrip()+"。"
    text=re.sub(r"（[①②③④⑤⑥、和及與]+）","",text)
    text=re.sub(r"([①②③④⑤⑥])(?=[\u3400-\u9fff])","",text)
    rule(not re.search(r"[①②③④⑤⑥]|選項\s*[A-F1-6]",text) and len(text)>=18,"ordinal_explanation")
    return text

def adapt(parent,targets,source,pages,output,legacy,native,ocr):
    asset=parent["question_only_asset"]
    word_path=Path(source["question_docx"])
    snapshot=Path(asset["local_content"])
    rule(legacy.digest(snapshot)==asset["sha256"] and legacy.digest(word_path)==source["question_docx_sha256"],
         "source_snapshot_changed")
    layout=legacy.read(snapshot)
    rule(len(layout["media"])==len(asset["images"])==1,"single_original_grid")
    content=parent["original_source"]["native_content"]
    rule(len(content["questions"])==len(targets)==1 and not (content["preamble"] or "").strip(),"independent_grid")
    q=content["questions"][0]; target=targets[0]
    rule(target["kind"] in ("multiple_choice","checkbox") and target["source_question_indices"]==[1] and not q["options"],
         "grid_option_source")
    rule(legacy.normalize(layout["text"])==legacy.normalize(legacy.statement(q["stem"])) and
         re.search(r"(?:哪些|怎麼做|什麼方法).*打[ˇ勾√✓]",q["stem"]),"grid_question")
    teacher=[str(value).strip() for row in q["answers"] for value in row if str(value).strip()]
    rule(len(teacher)==1,"grid_teacher_key")
    keys=answer_indices(teacher[0])
    rule(keys==answer_indices(target["reference_answer"]),"grid_review_key")
    refs=legacy.refs_for(target,source["unit"],pages)
    explanation=ordinals_removed(target["student_explanation"],keys)
    descriptors=native.verify_assets(layout,asset["images"],word_path,legacy)
    original=next(iter(descriptors.values()))
    pic=np.array(Image.open(original["path"]).convert("RGB"))
    cards=card_cells(pic,ocr)
    rule(max(keys)<=len(cards),"key_does_not_fit_grid")
    labels=[]; assets={}
    for crop,box,ordinal_box in cards:
        data=io.BytesIO()
        Image.fromarray(crop).save(data,format="WEBP",lossless=True,method=6)
        bits=data.getvalue()
        hash=sha256(bits).hexdigest()
        path=output/(hash+".webp");path.write_bytes(bits)
        labels.append({"text":"","media":[{"kind":"image","url":str(path),"alt":"選項原圖與文字"}]})
        assets[str(path)]={**original,"sha256":hash,"mime":"image/webp","bytes":len(bits),"path":str(path),
                           "parent_media_file":original["path"],"parent_media_sha256":original["sha256"],
                           "cell":box,"erased_ordinal_glyph":ordinal_box}
    rule(len(assets)==len(cards),"duplicate_graphic_options")
    # The deployed checkbox presenter moves these numbered prompt runs into
    # the controls. The immutable prompt keeps the normal media authorization.
    option_text=["圖一","圖二","圖三","圖四","圖五","圖六"]
    prompt={"text":layout["text"],"media":[label["media"][0] for label in labels],
            "layout":[{"type":"paragraph","runs":[{"type":"text","text":layout["text"]}]}]}
    choices=[]
    for i in range(len(labels)):
        marker=f"（{i+1}）"
        prompt["layout"].append({"type":"paragraph","runs":[{"type":"text","text":marker},
                                {"type":"image","media_index":i,"width":300}]})
        choices.append(legacy.plain(marker+option_text[i]))
    prompt["text"]+="\n"+"\n".join(f"（{i+1}）" for i in range(len(labels)))
    question=native.output_question("checkbox",prompt,choices,keys,legacy.plain(explanation))
    return {"passed":True,"parent":parent["id"],"source":source["id"],"unit":source["unit"],"difficulty":source["difficulty"],
            "rule":"grid_checkbox","questions":[{"target":target["target_id"],"refs":refs,"question":question}],"assets":assets}

def main():
    cli=argparse.ArgumentParser(description=__doc__)
    for name in ("mapper","legacy","export","source-catalog","previous","page-registry","output"):
        cli.add_argument("--"+name,required=True,type=Path)
    args=cli.parse_args()
    import importlib.util
    spec=importlib.util.spec_from_file_location("native",args.mapper)
    native=importlib.util.module_from_spec(spec);spec.loader.exec_module(native)
    legacy=native.load_module(args.legacy)
    export=legacy.read(args.export)
    source={r["stable_id"]:r for r in legacy.read(args.source_catalog)["records"]}
    parents={r["id"]:r for r in export["parents"]}
    targets=defaultdict(list)
    for t in export["logical_targets"]:
        targets[t["parent_id"]].append(t)
    book=legacy.read(args.page_registry)
    pages={(3 if name.startswith("G3_U3") else 4,p,r["source_filename"],r["source_sha256"],r["pdf_page_1based"])
           for name,r in book.items() for p in r["printed_pages"]}
    crop_dir=args.output.parent/"crops"
    crop_dir.mkdir(exist_ok=True)
    ocr=RapidOCR()
    rows=[]
    for r in legacy.read(args.previous):
        sid=r["parent"]
        t=targets[sid]
        if r.get("reason")!="other_source_layout" or len(t)!=1 or t[0]["kind"] not in ("multiple_choice","checkbox"):
            continue
        try:
            rows.append(adapt(parents[sid],t,source[sid],pages,crop_dir,legacy,native,ocr))
        except (OSError,KeyError,ValueError) as error:
            rows.append({"passed":False,"parent":sid,"reason":str(error)})
    args.output.write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding="utf8")
    print(Counter(r.get("reason",r.get("rule")) for r in rows))

if __name__=="__main__":
    main()
