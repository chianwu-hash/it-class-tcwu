"""Map original listening worksheets to one answer field per writing slot."""
import argparse
from collections import Counter
import importlib.util
import json
from pathlib import Path
import re

RULES = {
    "寫出正確的發音字母": ("phonics_write", "f8cee96f1b"),
    "將字母重組成正確的單字": ("unscramble", "c76c784134"),
    "寫出正確的大寫和小寫字母": ("case_write", "c76c784134"),
    "抄寫正確的單字": ("copy", "fbd05b8341"),
}


def convert(item, original_audio, second_audio, assets, book, rules, reviewed_clip=None):
    label = item["labels"][0].split("仔細聽，", 1)[-1]
    shape, blank = RULES[label]
    require = rules.require
    norm = rules.normalize
    originals = item["original"]
    word, answer, solution = (originals[k] for k in ("preamble-question", "answer", "solution"))
    require(all(rules.sha(r["path"]) == r["sha"] for r in originals.values()), "original_sha")
    require(not (word["fields"] or word["shapes"] or answer["fields"] or answer["shapes"]
                 or answer["tables"] or answer["inline_images"]), "word_layout")
    require(word["tables"] == (1 if shape == "copy" else 0), "word_table")
    blanks = assets.get("images")
    require(blanks and len(blanks) == word["inline_images"], "blank_image_count")
    require(rules.sha(assets["container"]) == assets["container_sha"], "blank_container")
    is_double_y = shape == "phonics_write" and len(blanks) == 2
    if is_double_y:
        blank = "702e8be764"
    for image in blanks:
        require(rules.sha(image["path"]) == image["sha256"] and image["sha256"].startswith(blank), "blank_image_sha")
    native = item["content"]["content"]
    require(len(native["questions"]) == 1 and not native.get("preamble"), "source_group")
    q = native["questions"][0]
    require(not q["options"] and all(len(a) == 1 for a in q["answers"]), "source_answer_shape")
    keys = [norm(a[0]) for a in q["answers"]]
    require(keys == rules.teacher_text(answer).split(";") and len(keys) == len(blanks), "teacher_key")
    original = norm(word["text"])
    printed = norm(re.sub(r"【\s*】", "", q["stem"]))
    script = rules.script_text(item["content"]["solution"])
    require(script == rules.script_text(solution["text"]), "publisher_transcript")
    a = original_audio
    if not script and shape=="unscramble" and reviewed_clip and reviewed_clip["script_absent_in_publisher"]:
        fallback=norm(reviewed_clip["publishable_transcript"])
        require(rules.clip_review_agrees(reviewed_clip,fallback,a["sha256"]),"missing_transcript_clip")
        require(rules.audio_agrees(fallback,a.get("asr"),shape),"missing_transcript_full_recording")
        script=fallback
    require(script, "publisher_transcript")
    require(a.get("samples", 0) and a.get("peak", 0) and rules.sha(a["path"]) == a["sha256"] == item["audio_resource"]["sha256"],
            "audio_bytes")
    if second_audio:
        require(a["sha256"] == second_audio["sha256"], "second_audio_sha")
    mode = {"phonics_write":"check_phonics","case_write":"choose_letter"}.get(shape,shape)
    verified = next((model for model, text in (("base.en", a.get("asr")),("small", second_audio.get("asr")))
                     if rules.audio_agrees(script,text,mode)), None)
    if not verified and rules.clip_review_agrees(reviewed_clip,script,a["sha256"]):
        verified="reviewed_clip"
    require(verified, "audio_transcript_review")
    if shape == "phonics_write":
        pronunciation = re.fullmatch(r"/([a-z])/,\s*/\1/,\s*(.+)", script, re.I)
        require(pronunciation and set(keys) == {pronunciation[1].lower()} and original.replace("/", "") == printed,
                "word_phonics_slots")
        inserted = original
        for k in keys:
            inserted = inserted.replace("/", k, 1)
        require(inserted.lower() == pronunciation[2].lower(), "audio_phonics_key")
        index = iter(range(1, len(keys)+1))
        stem = re.sub("/", lambda _:f"〔{next(index)}〕", original)
        page_mode = "check_phonics"
    elif shape == "case_write":
        require(original == "/" and not printed and len(script) == 1 and keys == [script.upper()+script.lower()],
                "audio_case_key")
        stem = ""
        page_mode = "choose_letter"
    elif shape == "unscramble":
        require(original.endswith(" /") and original[:-2] == printed and keys == [script] and
                Counter(printed.replace(" / ", "")) == Counter(script), "audio_unscramble_key")
        stem = printed
        page_mode = "check_word"
    else:
        require(original.endswith("\x07 \x07\x01") and original[:-4].strip() == printed and
                len(printed.split()) == 3 and keys == [script] and script in printed.split(), "audio_copy_key")
        stem = printed
        page_mode = "check_word"
    refs=[]
    unit=rules.UNITS[item["sections"][0]]
    rules.page_refs(script, page_mode, stem, refs, unit, book)
    return {"passed":True,"id":item["id"],"unit":unit,"shape":shape,"label":item["labels"][0],
            "type":"text","stem":stem,"answers":keys,"audio":a["path"],"sha256":a["sha256"],"bytes":a["bytes"],
            "asr":verified,"script":script,"refs":refs,"slot_sources":blanks,"word_container":assets["container"]}


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
        if r["labels"][0].split("仔細聽，",1)[-1] not in RULES:
            continue
        sid=r["id"]
        try:
            rows.append(convert(r,audio[sid],second.get(sid,{}),images[sid],args.textbook_dir,rules))
        except ValueError as exc:
            rows.append({"passed":False,"id":sid,"reason":str(exc),"label":r["labels"][0]})
    args.output.write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding="utf8")
    print(Counter(r.get("shape",r.get("reason")) for r in rows))


if __name__=="__main__":
    main()
