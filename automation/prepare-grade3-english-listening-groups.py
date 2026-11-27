"""Review shared listening passages and numbered phonics worksheets as groups."""
import argparse
import importlib.util
import json
from pathlib import Path
import re


DIALOGUES = {
    "035ac9e8": ([2, 3], [59, 58, 60, 44], (
        "Kenny 說他的鉛筆是黃色的。",
        "Tina 的鉛筆是綠色和紅色的，Kenny 的鉛筆是黃色的。")),
    "0387a8a4": ([2, 3], [44, 45, 42], (
        "回答 Edison 的 Mia 說她有一枝新鉛筆。",
        "Edison 說那是他的新尺。")),
    "041e6294": ([2, 3], [58, 59, 45, 42], (
        "James 說他的橡皮擦是紅色和黑色的。",
        "James 說他的包包是藍色的。")),
    "055d7a5b": ([3, 1], [42, 44, 45], (
        "錄音裡用 this 詢問的是一本新書。",
        "錄音裡用 that 詢問的是一塊橡皮擦。")),
}
PHONICS = {
    "0381dbf3": (["zoo", "quiz", "window"], [63, 48, 62]),
    "03d0e25b": (["tiger", "yogurt", "snake"], [49, 63]),
}


def arguments():
    cli=argparse.ArgumentParser(description=__doc__)
    for name in ("rules","originals","audio-review","second-review","images","textbook-dir","output"):
        cli.add_argument("--"+name,type=Path,required=True)
    return cli.parse_args()


def evidence(script, native, rows, audio, second, rules):
    require=rules.require
    require(audio.get("samples",0) and audio.get("peak",0)
            and rules.sha(audio["path"])==audio["sha256"]==rows["audio_resource"]["sha256"],"audio_bytes")
    require(script and script==rules.script_text(rows["original"]["solution"]["text"]),"publisher_transcript")
    if rows["id"] in DIALOGUES:
        require(rules.audio_agrees(script,audio.get("asr"),"choose_sentence"),"dialogue_transcript")
        return "base.en"
    require(second.get("sha256")==audio["sha256"],"second_audio_sha")
    heard=rules.normalize(second["asr"]).lower()
    numbers={"one":"1.", "two":"2.", "three":"3."}
    heard=re.sub(r"\b(one|two|three)\b",lambda m:numbers[m[0]],heard)
    recognized=rules.ordered_script(heard)
    expected=rules.ordered_script(script)
    require(len(recognized)==len(expected)==3,"audio_number_order")
    known=PHONICS[rows["id"]][0]
    for index,(clip,original) in enumerate(zip(recognized,expected),1):
        word=original.rsplit(",",1)[-1].strip(" .")
        words=re.findall(r"[a-z]+",clip)
        require([w for w in words if w in known] and set(w for w in words if w in known)=={word},"audio_word_order")
        require(words[-1]==word and native[known.index(word)]==f"{index} {word}","teacher_number_word")
    return "small"


def source_images(row, assets, rules):
    image=assets.get("images",[])
    require=rules.require
    require(len(image)==row["original"]["preamble-question"]["inline_images"],"original_image_count")
    if image:
        require(rules.sha(assets["container"])==assets["container_sha"]
                and all(rules.sha(a["path"])==a["sha256"] for a in image),"original_image_sha")
    return image


def adapt(row, audio, second, assets, book_dir, rules):
    sid=row["id"]
    require=rules.require
    originals=row["original"]
    require(all(rules.sha(a["path"])==a["sha"] for a in originals.values()),"original_sha")
    source, teacher=(originals[n] for n in ("preamble-question","answer"))
    require(not (source["tables"] or source["shapes"] or teacher["tables"] or teacher["shapes"] or teacher["inline_images"]),
            "word_layout")
    qs=row["content"]["content"]["questions"]
    script=rules.script_text(row["content"]["solution"])
    images=source_images(row,assets,rules)
    if sid in DIALOGUES:
        keys,pages,reasons=DIALOGUES[sid]
        require(len(qs)==2 and [q["answers"] for q in qs]==[[[str(k)]] for k in keys],"dialogue_publisher_key")
        require(rules.eq_positions(teacher)==keys and rules.eq_positions(source)==[1,2,3]*2,"dialogue_teacher_key")
        split=re.split(r"\(\s*\)\([12]\)\s*",rules.normalize(source["text"]))[1:]
        require(len(split)==2,"dialogue_word_structure")
        questions=[]
        for i,(q,part,reason,key) in enumerate(zip(qs,split,reasons,keys)):
            prompt,*o=[t.strip() for t in part.split("\x15")]
            options=[rules.normalize(v) for v in q["options"]]
            require(prompt==rules.normalize(q["stem"]) and len(options)==len(o)==3,"dialogue_question_text")
            if images:
                require(len(images)==6 and all(v=="/" for v in o) and all(not v for v in options),"dialogue_image_positions")
            else:
                require(o==options,"dialogue_original_options")
            questions.append({"stem":prompt,"options":options,"answer":key,"explanation":reason,"images":images[i*3:i*3+3]})
        model=evidence(script,keys,row,audio,second,rules)
        converted={"kind":"dialogue","questions":questions,"published_images":images}
    else:
        words,pages=PHONICS[sid]
        require(len(qs)==1 and not qs[0]["options"] and len(images)==6,"phonics_source")
        raw_keys=[k[0] for k in qs[0]["answers"] if len(k)==1]
        require(len(raw_keys)==3 and raw_keys==rules.teacher_text(teacher).split(";"),"phonics_teacher_key")
        expected=[w[1:] for w in words]
        printed=re.findall(r"\(\s*\)\s*/\s*/([a-z]+)",rules.normalize(source["text"]))
        require(printed==expected,"phonics_word_slots")
        require(rules.normalize(re.sub(r"【\s*】","",qs[0]["stem"]))==" ".join(f"( ) {v}" for v in expected),
                "phonics_publisher_slots")
        model=evidence(script,raw_keys,row,audio,second,rules)
        for image in images[1::2]:
            require(image["h"] < image["w"] and image["sha256"]==images[1]["sha256"],"phonics_blank_shape")
        converted={"kind":"compound","targets":[{
            "suffix":w[1:],"letter":w[0],"number":k[0],"image":a}
            for w,k,a in zip(words,raw_keys,images[::2])],"published_images":images[::2]}
    refs=[]
    for n in pages:
        # Reuse the same page and print verification as the text rollout.
        origin,name=(39,"05_HWG1_U3.pdf") if n < 53 else (53,"06_HWG1_U4.pdf")
        path=book_dir/name
        with rules.pymupdf.open(path) as book:
            raw=book[n-origin].get_text()
        require(str(n) in [line.strip() for line in raw.splitlines()],"textbook_page")
        normalized=rules.normalize(raw).lower()
        require(all(re.search(r"\b"+re.escape(term)+r"\b",normalized) for term in rules.PAGE_TERMS[n]),"textbook_terms")
        refs.append({"page":n,"file":name,"sha":rules.sha(path),"index":n-origin+1})
    return {"id":sid,"passed":True,"unit":rules.UNITS[row["sections"][0]],"label":row["labels"][0],
        "audio":audio["path"],"sha256":audio["sha256"],"bytes":audio["bytes"],"asr":model,"script":script,
        "refs":refs,"all_images":images,"word_container":assets.get("container"),**converted}


def main():
    args=arguments()
    spec=importlib.util.spec_from_file_location("grade3_listening",args.rules)
    rules=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(rules)
    def read(path):
        return json.loads(path.read_text(encoding="utf8"))
    audio={r["id"]:r for r in read(args.audio_review)}
    second=read(args.second_review)
    media=read(args.images)
    result=[]
    for r in read(args.originals):
        sid=r["id"]
        if sid not in DIALOGUES and sid not in PHONICS:
            continue
        try:
            result.append(adapt(r,audio[sid],second.get(sid,{}),media[sid],args.textbook_dir,rules))
        except ValueError as exc:
            result.append({"id":sid,"passed":False,"reason":str(exc),"label":r["labels"][0]})
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf8")
    print([(r["id"],r.get("kind",r.get("reason"))) for r in result])


if __name__=="__main__":
    main()
