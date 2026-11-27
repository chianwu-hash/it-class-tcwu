import argparse,hashlib,json,re,unicodedata
from collections import Counter
from pathlib import Path

REVIEWS={
 "00aa218e":{"answers":[1,3],"refs":[61,45],"why":["Betty 說她的麥克筆是藍色。Jack 的不是紅色，所以 Jack 拿綠色。","藍色和綠色都有主人，剩下的紅色麥克筆是 Ken 的。"]},
 "02610e0f":{"answers":[3,1],"refs":[45,44],"why":["圖中的 3 號物品是橡皮擦。","圖中的 2 號物品是直尺。"]},
 "03798aec":{"answers":[1,2],"refs":[44,45],"why":["Judy 和 Jimmy 都有鉛筆和書。","Jimmy 的鉛筆盒裡有麥克筆。"]},
 "03e4b639":{"answers":[2,3],"refs":[61,44,45],"why":["黃色的筆在 Jimmy 的禮物裡。","Ted 拿到的橡皮擦是黃色。"]},
 "037881db":{"words":["black","eraser","blue"],"refs":[61,45]},
 "039ccc6d":{"words":["yellow","pencil","marker"],"refs":[61,44,45]},
}

def require(condition,reason):
    if not condition:raise ValueError(reason)

def n(s):
    return " ".join(unicodedata.normalize("NFKC",s).replace("’","'").split())

def answer_fields(word):
    result=[]
    for f in word["fields"]:
        match=re.fullmatch(r"eq\s+\\o\(○,([ABC])\)",n(f["code"]),re.I)
        require(match,"teacher_position")
        result.append(ord(match[1].upper())-ord("A")+1)
    return result

def numeric_key(raw):
    s=n(raw)
    if re.fullmatch(r"[123]",s):
        return int(s)
    match=re.fullmatch(r"\(?([ABC])\)?",s)
    return ord(match[1])-ord("A")+1 if match else None

def adapt(row,media):
    sid=row["id"];review=REVIEWS[sid];word,key=(row["original"][k] for k in ("preamble-question","answer"))
    require(not word["tables"] and not row["audio"] and len(row["sections"])==1,"source_shape")
    require(all(hashlib.sha256(Path(o["path"]).read_bytes()).hexdigest()==o["sha"] for o in (word,key)),"word_sha")
    images=media["images"]
    require(len(images)==word["inline_images"] and all(hashlib.sha256(Path(i["path"]).read_bytes()).hexdigest()==i["sha256"] for i in images),"media_sha")
    require(hashlib.sha256(Path(media["container"]).read_bytes()).hexdigest()==media["container_sha"],"media_container")
    unit={"398850":3,"398851":4,"398852":5}[row["sections"][0]]
    native=row["content"]["content"]["questions"]
    answers=answer_fields(key)
    vote={"id":sid,"unit":unit,"passed":True,"references":review["refs"],"images":images}
    if "words" in review:
        require(len(images)==len(answers)==3 and len(native)==1,"picture_word_map")
        bank=[n(o) for o in word["text"].split("\r")[0].split("\x15")[1:]]
        picked=[bank[i-1] for i in answers]
        require(len(bank)==3 and len(set(bank))==3 and picked==review["words"],"picture_word_answer")
        require([numeric_key(a[0]) for a in native[0]["answers"]]==answers,"native_key")
        return {**vote,"kind":"map","choices":bank,"key":answers}
    require(len(answers)==len(native)==2 and answers==review["answers"],"visual_group_keys")
    pieces=re.split(r"（\s*）\([１２12]\)\s*",word["text"])
    require(len(pieces)==3 and all(o.count("\x15")==3 for o in pieces[1:]),"word_group_layout")
    out=[]
    for i,query in enumerate(native):
        stem,*raw=pieces[i+1].split("\x15")
        opts=[n(o) for o in raw]
        if query["options"]:
            require(opts==list(map(n,query["options"])),"native_options")
        else:
            require(opts==re.findall(r"[ⒶⒷⒸ]\s*([A-Za-z]+)",query["stem"]),"native_choice_symbols")
        require(len(query["answers"])==1 and numeric_key(query["answers"][0][0])==answers[i],"native_answer")
        if sid=='02610e0f' and i==0:
            require('/' in stem and len(images)==2,"number_pointer")
            stem="What’s that? 請看圖中編號 3 的物品。"
        out.append({"prompt":stem.strip(),"options":opts,"answer":answers[i],"why":review["why"][i]})
    return {**vote,"kind":"reading","shared_intro":pieces[0].replace("/","").strip(),"questions":out}


def main():
    parser=argparse.ArgumentParser(description="Map remaining Grade 3 picture sets to fixed independent questions.")
    for name in ("originals","images","output"):parser.add_argument("--"+name,required=True,type=Path)
    a=parser.parse_args()
    read=lambda p:json.loads(p.read_text(encoding="utf8"))
    media=read(a.images);out=[]
    for row in read(a.originals):
        if row["id"] not in REVIEWS:continue
        try:out.append(adapt(row,media[row["id"]]))
        except ValueError as error:out.append({"id":row["id"],"passed":False,"reason":str(error)})
    a.output.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf8")
    print(Counter(r.get("kind",r.get("reason")) for r in out))

if __name__=="__main__":
    main()
