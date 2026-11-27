"""Bind textbook dialogue blanks to Word slots, teacher keys and source images."""
import argparse,hashlib,json,re,unicodedata
from collections import Counter
from pathlib import Path
import pymupdf

UNIT={"398850":3,"398851":4}
PICTURES={
 "00ab9b8b":("What's this?",(42,45)),
 "00dac66b":("It's an eraser.",(44,)),
 "027f2095":("It's red.",(58,61)),
 "03557c23":("It's a ruler.",(45,)),
 "04a0b989":("What's that?",(42,47)),
 "05030dbb":("It's yellow.",(64,)),
 "050a9f70":("It's a marker.",(42,45)),
 "05465516":("It's blue.",(58,)),
 "05783edb":("What color is it?",(64,)),
 "05e6ea33":("It's green.",(58,61)),
}
TERMS={12:["what's your name"],42:["what's this","what's that"],44:["eraser","pen"],45:["marker","ruler"],46:["cool"],47:["pencil"],55:["black"],58:["what color is it","blue"],60:["good afternoon"],61:["red","green"],62:["watch"],64:["white","yellow"]}


def n(text):
    return " ".join(unicodedata.normalize("NFKC",text).replace("’","'").replace("��","'").split())


def require(ok, reason):
    if not ok: raise ValueError(reason)


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def ref(page, directory):
    file, origin=("02_HWG1_U1.pdf",7) if page<39 else ("05_HWG1_U3.pdf",39) if page<53 else ("06_HWG1_U4.pdf",53)
    p=directory/file
    with pymupdf.open(p) as pdf:raw=pdf[page-origin].get_text()
    require(str(page) in [w.strip() for w in raw.splitlines()] and all(t in n(raw).lower() for t in TERMS[page]),"textbook_page")
    return {"page":page,"file":file,"sha":digest(p),"index":page-origin+1}


def choose_refs(completed):
    text=n(completed).lower()
    pages=[]
    for triggers,p in [(("what's this","what's that"),42),(("pen.","an eraser"),44),(("marker","ruler"),45),
                       (("cool!",),46),(("good afternoon",),60),(("what color","blue"),58),(("red","green"),61),(("black",),55),
                       (("my watch",),62),(("what's your name",),12),(("white","yellow"),64)]:
        if any(re.search(r"\b"+re.escape(w)+r"(?![a-z])",text) for w in triggers):pages.append(p)
    return pages


def adapt(r, assets, textbooks):
    sid=r["id"];orig=r["original"];q,k=(orig[name] for name in ("preamble-question","answer"))
    require(all(digest(x["path"])==x["sha"] for x in orig.values()),"source_sha")
    require(not any(k[x] for x in ("inline_images","shapes","tables","fields")), "teacher_layout")
    require(len(r["sections"])==1 and not r["audio"],"source_scope")
    raw=r["content"]["content"]
    require(not raw.get("preamble") and len(raw["questions"])==1,"source_group")
    native=raw["questions"][0]
    answers=[a.strip() for a in n(k["text"]).removeprefix("答案:").split(";")]
    require(not native["options"] and answers==[n(a[0]) for a in native["answers"] if len(a)==1],"teacher_native_key")
    native_stem=re.sub(r"【\s*】","",native["stem"])
    images=assets.get("images")
    if sid in PICTURES:
        choice=PICTURES[sid]
        require(answers==[choice[0]] and q["inline_images"]==2 and not q["tables"] and images and len(images)==2,"picture_key")
        require(digest(assets["container"])==assets["container_sha"] and all(digest(v["path"])==v["sha256"] for v in images),"image_sha")
        lines=[line.strip(" \t") for line in q["text"].strip().splitlines()]
        require(lines[0]=="\x01" and sum(line.count("\x01") for line in lines)==2,"picture_blank")
        stem="\n".join(lines[1:])
        require(n(stem.replace("\x01",""))==n(native_stem),"source_prompt")
        prompt="看圖，寫出對話中缺少的一句。\n"+stem.replace("\x01","〔1〕")
        completed=stem.replace("\x01",answers[0])
        pages=choice[1]
        shape="picture"
    else:
        require(r["labels"][0].startswith("Read and Copy") and not images and q["tables"]==1,"copy_layout")
        parts=q["text"].strip().split("\r\x07\r\x07\r")
        require(len(parts)==2,"word_bank")
        bank=n(parts[0]).split()
        require(Counter(bank)==Counter(answers),"word_bank_answers")
        stem=parts[1]
        require(n(stem.replace("＿",""))==n(re.split(r"(?=A:)",native_stem,maxsplit=1)[1]),"source_dialogue")
        require(n(parts[0])==n(re.split(r"(?=A:)",native_stem,maxsplit=1)[0]),"native_word_bank")
        count=len(re.findall("＿{2,}",stem))
        require(count==len(answers), "slot_count")
        words=iter(answers)
        completed=re.sub("＿{2,}",lambda _:next(words),stem)
        index=iter(range(1,count+1))
        prompt="從詞庫選字，填在對應的答案欄。\n"+"　".join(bank)+"\n"+re.sub("＿{2,}",lambda _:f"〔{next(index)}〕",stem.strip()).replace("\r","\n")
        pages=choose_refs(completed)
        shape="bank"
    require(pages,"textbook_evidence")
    return {"id":sid,"unit":UNIT[r["sections"][0]],"passed":True,"shape":shape,"answers":answers,"prompt":prompt,
     "completed":completed.strip().replace("\r","\n"),"refs":[ref(p,textbooks) for p in pages],"image":images[0] if images else None}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ("originals","images","textbook-dir","output"):
        parser.add_argument("--"+name,type=Path,required=True)
    a=parser.parse_args()
    read=lambda p:json.loads(p.read_text(encoding="utf8"))
    media=read(a.images);out=[]
    for row in read(a.originals):
        if row["id"] not in PICTURES and not row["labels"][0].startswith("Read and Copy"):continue
        try:out.append(adapt(row,media[row["id"]],a.textbook_dir))
        except ValueError as e:out.append({"id":row["id"],"passed":False,"reason":str(e)})
    a.output.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf8")
    print(Counter(r.get("shape",r.get("reason")) for r in out))


if __name__=="__main__":
    main()
