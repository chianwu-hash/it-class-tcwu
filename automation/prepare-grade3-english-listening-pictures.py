"""Keep listening artwork in its original order and cross-check its keyed meaning."""
import argparse
from collections import Counter
import importlib.util
import json
from pathlib import Path
import re


# Descriptions were verified against the cropped Word artwork in these positions.
# They are review evidence kept outside the student question.
PICTURE_WORDS = {
    "0004efa8": ("green", "red"), "00d7dfb9": ("black","white"),
    "010deda1": ("ruler", "marker"), "01122792": ("marker","pencil"),
    "016aebeb": ("pen","pencil"), "0455c93d": ("black","white"),
    "04a99feb": ("book","eraser"), "05c6f59c": ("red","yellow"),
    "00316a01": ("black","yellow","blue"), "00d4bed1": ("pencil","this ruler","that ruler"),
    "01132c9e": ("book","eraser","pencil"), "0172da95": ("good afternoon","good night","sit down"),
    "025971c4": ("that eraser","book","this eraser"), "02cfe1b5": ("book","that pencil","this pen"),
    "0453ca48": ("yellow","white","red"), "0547d60c": ("blue","green","black"),
    "007222e4": ("book","ruler","pen"), "00d2eeaf": ("red","black","blue"),
    "013fe558": ("green","blue","yellow"), "021cda39": ("eraser","marker","pencil"),
    "03e465af": ("yellow","red","blue"), "040f9c70": ("pencil","eraser","pen"),
    "041d80da": ("yellow","white","blue"), "04205d7c": ("marker","book","pen"),
    "047de52a": ("red","blue","green"), "053cec22": ("book","marker","pencil"),
    "004a2787": ("good job thanks",), "01615431": ("this ruler",), "021b2edd": ("this pencil",),
    "025642ed": ("red",), "02620921": ("black",), "03203038": ("blue",),
    "033399ca": ("eraser",), "0413c6e3": ("good morning",),
    "01ab4cfc": ("watch","yo-yo"), "01c507d7": ("zoo","zebra"), "024d6847": ("van","vest"),
    "0254ebc8": ("turtle","quiz"), "02ccd435": ("snake","sun"), "02dfa8f2": ("red","rabbit"),
    "0322912a": ("queen","tiger"), "034c87ff": ("pig","pink"), "0390d8d0": ("yogurt","window"),
    "0509a577": ("up","umbrella"),
}


def heard_target(script, names, rules):
    normalized=script.lower()
    name_set=set(names)
    if "good job" in normalized and "thanks" in normalized:
        return "good job thanks"
    for greeting in ("good morning","good afternoon"):
        if greeting in normalized:
            return greeting
    ending=re.search(r"\bit's (?:a |an )?([a-z]+)[.!?]*$", normalized)
    if ending:
        term=ending[1]
        for label in ("this","that"):
            compound=label+" "+term
            if compound in name_set and "what's "+label in normalized:
                return compound
        return term
    return normalized


def convert(row, audio, second, media, book, rules):
    sid=row["id"]
    names=PICTURE_WORDS[sid]
    label=row["labels"][0]
    word,answer,solution=(row["original"][k] for k in ("preamble-question","answer","solution"))
    require=rules.require
    require(all(rules.sha(a["path"])==a["sha"] for a in row["original"].values()),"original_sha")
    require(not (word["shapes"] or word["tables"] or answer["tables"] or answer["shapes"] or answer["inline_images"]),"word_layout")
    images=media.get("images")
    require(images and len(images)==word["inline_images"]==len(names),"media_layout")
    require(rules.sha(media["container"])==media["container_sha"] and all(rules.sha(a["path"])==a["sha256"] for a in images),
            "media_sha")
    raw=row["content"]["content"]
    require(len(raw["questions"])==1 and not raw.get("preamble"),"source_group")
    q=raw["questions"][0]
    require(len(q["answers"])==1 and len(q["answers"][0])==1,"source_answer_shape")
    pub=q["answers"][0][0]
    script=rules.script_text(row["content"]["solution"])
    require(script==rules.script_text(solution["text"]),"publisher_transcript")
    require(audio.get("samples",0) and audio.get("peak",0) and rules.sha(audio["path"])==audio["sha256"]==row["audio_resource"]["sha256"],
            "audio_bytes")
    if second:
        require(second["sha256"]==audio["sha256"],"second_audio_sha")
    proper_asr=next((model for model,hyp in (("base.en",audio.get("asr")),("small",second.get("asr")))
                     if rules.audio_agrees(script,hyp,"choose_sentence")),None)
    require(proper_asr,"audio_transcript_review")
    context=[]
    if "畫○" in label:
        require(not q["options"] and pub==rules.teacher_text(answer) and pub in ("○","╳"),"teacher_key")
        if "字首發音" in label:
            require([v.strip().lower() for v in script.split(",")]==list(names),"picture_audio_words")
            correct=names[0][0]==names[1][0]
            page_mode="check_phonics"
        else:
            correct=heard_target(script,names,rules)==names[0]
            page_mode="choose_sentence"
        require(pub==("○" if correct else "╳"),"picture_judgment_key")
        options=["○","╳"]
        marked=options.index(pub)+1
        context=images
        kind="judge_picture"
    else:
        if "勾選" in label:
            require(not q["options"] and pub==rules.teacher_text(answer) and pub in ("左圖","右圖"),"teacher_key")
            require(rules.normalize(word["text"]).count("□")==len(names),"word_picture_order")
            marked=1 if pub=="左圖" else 2
        else:
            require(len(q["options"])==len(names) and all(not x.strip() for x in q["options"]),"publisher_image_options")
            marked=int(pub)
            require(rules.eq_positions(answer)==[marked] and rules.eq_positions(word)==list(range(1,len(names)+1)),
                    "word_picture_order")
        target=heard_target(script,names,rules)
        require([i for i,n in enumerate(names,1) if n==target]==[marked],"picture_choice_key")
        options=[""]*len(images)
        page_mode="choose_sentence"
        kind="choose_picture"
    refs=[]
    unit=rules.UNITS[row["sections"][0]]
    rules.page_refs(script,page_mode,"",refs,unit,book)
    return {"id":sid,"passed":True,"unit":unit,"shape":kind,"type":"single","label":label,
            "stem":"","options":options,"answer":marked,"images":images,"prompt_images":len(context),
            "word_container":media["container"],"audio":audio["path"],"sha256":audio["sha256"],"bytes":audio["bytes"],
            "asr":proper_asr,"script":script,"refs":refs,"visual_key":names}


def main():
    cli=argparse.ArgumentParser(description=__doc__)
    for name in ("rules","originals","audio-review","second-review","images","textbook-dir","output"):
        cli.add_argument("--"+name,type=Path,required=True)
    args=cli.parse_args()
    spec=importlib.util.spec_from_file_location("grade3_listening",args.rules)
    rules=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(rules)
    def read(path):
        return json.loads(path.read_text(encoding="utf8"))
    audio={r["id"]:r for r in read(args.audio_review)}
    second=read(args.second_review)
    images=read(args.images)
    rows=[]
    for r in read(args.originals):
        sid=r["id"]
        if sid not in PICTURE_WORDS:
            continue
        try:
            rows.append(convert(r,audio[sid],second.get(sid,{}),images[sid],args.textbook_dir,rules))
        except ValueError as exc:
            rows.append({"passed":False,"id":sid,"reason":str(exc),"label":r["labels"][0]})
    args.output.write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding="utf8")
    print(Counter(r.get("shape",r.get("reason")) for r in rows))


if __name__=="__main__":
    main()
