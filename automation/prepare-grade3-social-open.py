"""Validate original reference-answer prompts for ungraded self-review."""
import argparse
from collections import Counter, defaultdict
import importlib.util
import json
from pathlib import Path
import re

REFERENCE = re.compile(r"[（(]答案僅供參考[）)]$")
QUANTITY = re.compile(r"(?:寫出|舉出|列舉|舉)(?:[^。？]{0,14}的)?([一兩二三])(?:項|種|個)")
COUNT = {"一": "一項", "兩": "兩項", "二": "兩項", "三": "三項"}

# More specific cues override literal matches in a reference example.
BOOK_TOPIC = (
    ("0301", r"家庭遭受變故", 60, ("關懷與協助", "家庭"),
     "同學家裡遇到困難時，可以主動關心，並在能力範圍內提供協助。"),
    ("0301", r"和同學相處應有的態度", 59, ("外表、個性、想法", "家庭背景及生活經驗"),
     "同學的背景與想法各有不同，可以互相尊重、接納差異。"),
    ("0402", r"侵犯到他人的隱私", 88, ("祕密", "擅自翻看"),
     "未經允許擅自翻看或碰觸他人私人物品，可能侵犯隱私。"),
    ("0402", r"隱私或身體受到侵犯", 91, ("受到侵犯", "求協助"),
     "遇到侵犯時，可以明確拒絕、離開現場或尋求協助。"),
)

def module(path):
    spec=importlib.util.spec_from_file_location(path.stem,path)
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for key in ("automation","metadata","originals","source-screen","book","output"):
        parser.add_argument("--"+key,type=Path,required=True)
    args=parser.parse_args()
    native=module(args.automation/"prepare-grade3-social-final.py")
    fields=module(args.automation/"prepare-grade3-social-fields.py")
    books=module(args.automation/"map-grade3-social-textbook.py")
    read=lambda p:json.loads(p.read_text(encoding="utf8"))
    sources={r["source"]:r for r in read(args.source_screen) if r.get("type_code")=="43"}
    metadata=read(args.metadata)
    masters={r["QUES_NO"]:r for r in metadata["QuesMaster"] if r["QUES_NO"] in sources}
    keys,details=defaultdict(list),defaultdict(list)
    for name,text,out in [("QuesAnswer","QUES_ANSW",keys),("QuesDetail","QUES_DETL",details)]:
        for row in metadata[name]:
            if row["QUES_NO"] in sources:
                out[row["QUES_NO"]].append(row[text])
    files={p.stem:p for p in args.originals.rglob("*.docx") if p.stem in sources}
    assert set(files)==set(masters)==set(sources)
    rows=[]
    for sid,record in sources.items():
        path=files[sid]
        item=masters[sid]
        try:
            require=native.require
            require(native.sha(path)==record["source_sha256"],"original_sha")
            word,key,detail=fields.read_original(path,args.output.parent,native)
            answer=key.removeprefix("《答案》").strip()
            require(len(keys[sid])==len(details[sid])==1 and
                    native.compact(answer)==native.compact(keys[sid][0]),"teacher_key_mismatch")
            require(native.compact(word+key+detail)==native.compact(details[sid][0]),"publisher_detail_mismatch")
            require(REFERENCE.search(answer) and not detail.strip(),"teacher_reference_only")
            example=REFERENCE.sub("",answer).strip()
            require(example and "《" not in example,"empty_reference")
            match=QUANTITY.search(word)
            if "並告訴我們要如何" in word:
                criteria=["有寫出一類學校設備，並說明如何珍惜使用。"]
            elif match:
                criteria=[f"有提出題目要求的{COUNT[match[1]]}具體例子，且內容符合題意。"]
            elif re.search(r"要怎麼做比較好",word):
                criteria=["有說明一個可行、能幫助釐清問題的做法。"]
            else:
                raise ValueError("unclear_response_count")
            rows.append({"passed":True,"source":sid,"source_file":str(path),"source_sha256":record["source_sha256"],
                "lesson":item["LESN_NUM"],"unit":int(item["LESN_NUM"][:2]),"knowledge":item["KNOW_SPOT"],
                "difficulty":dict(A=-3,B=0,C=3)[item["DIFC_CODE"]],"layout":"open","prompt":word,
                "options":[example],"answer":1,"explanation":"","criteria":criteria})
        except (ValueError,KeyError) as exc:
            rows.append({**record,"passed":False,"reason":str(exc)})
    spreads=read(args.book)
    pages={p["page"]:books.page_text(p["text"]) for s in spreads for p in s["pages"]}
    result=[]
    for row in books.apply(rows,spreads):
        if "prompt" in row:
            for lesson,pattern,page,anchors,explanation in BOOK_TOPIC:
                hit=re.search(pattern,row["prompt"])
                if row["lesson"]==lesson and hit:
                    assert all(anchor in pages[page] for anchor in anchors)
                    row={**row,"passed":True,"primary":page,"references":[page],"textbook_reason":explanation,
                         "textbook_matches":[{"page":page,"cue":hit[0]}]}
                    row.pop("reason",None)
                    break
        result.append(row)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf8")
    print(Counter(r.get("reason",r.get("layout")) for r in result))

if __name__=="__main__":
    main()
