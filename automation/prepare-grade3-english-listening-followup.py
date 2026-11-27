"""Replay the remaining listening decisions from reviewed original audio clips."""
import argparse
from collections import Counter
import importlib.util
import json
from pathlib import Path


def load_module(directory, name):
    path=directory/f"prepare-grade3-english-listening{name}.py"
    spec=importlib.util.spec_from_file_location(path.stem,path)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    cli=argparse.ArgumentParser(description=__doc__)
    for name in ("originals","audio-review","second-review","clip-review","images","textbook-dir","output"):
        cli.add_argument("--"+name,type=Path,required=True)
    cli.add_argument("--remaining",nargs="+",required=True)
    args=cli.parse_args()
    folder=Path(__file__).parent
    rules=load_module(folder,"")
    writing=load_module(folder,"-writing")
    pictures=load_module(folder,"-pictures")
    def read(path):
        return json.loads(path.read_text(encoding="utf8"))
    audio={r["id"]:r for r in read(args.audio_review)}
    second=read(args.second_review)
    review=read(args.clip_review)
    images=read(args.images)
    remaining=set(args.remaining)
    result=[]
    for row in read(args.originals):
        sid=row["id"]
        if sid not in remaining:
            continue
        clip=review.get(sid)
        try:
            if sid in pictures.PICTURE_WORDS:
                r=pictures.convert(row,audio[sid],second.get(sid,{}),images[sid],args.textbook_dir,rules,clip)
            elif row["labels"][0].split("仔細聽，",1)[-1] in writing.RULES:
                r=writing.convert(row,audio[sid],second.get(sid,{}),images[sid],args.textbook_dir,rules,clip)
            else:
                r=rules.convert(row,audio[sid],second.get(sid,{}),args.textbook_dir,clip)
            result.append(r)
        except ValueError as exc:
            result.append({"passed":False,"id":sid,"label":row["labels"][0],"reason":str(exc),
                           "audio_sha256":audio[sid]["sha256"],
                           "original_document_sha256":{k:v["sha"] for k,v in row["original"].items()}})
    assert {row["id"] for row in result}==remaining
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf8")
    print(Counter(row.get("shape",row.get("reason")) for row in result))


if __name__=="__main__":
    main()
