"""Preserve Word media placement for verified Grade 3 science questions."""
import argparse
from collections import Counter, defaultdict
from hashlib import sha256
import importlib.util
import json
from pathlib import Path
import re
import zipfile


def load_module(path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def compact_layout(layout, media, docx):
    value = docx.compact(layout, media)
    return {k:v for k,v in value.items() if k in ("text","media","layout")}


def verify_assets(parsed, image_catalog, original_docx, legacy):
    descriptors = {}
    records = {a["path"]:a for a in image_catalog}
    with zipfile.ZipFile(original_docx) as doc:
        embedded = {sha256(doc.read(name)).hexdigest()
                    for name in doc.namelist() if name.startswith("word/media/") and not name.endswith("/")}
    for image in parsed["media"]:
        legacy.require(image["kind"] == "image", "unsupported_media")
        path = Path(image["url"])
        data = path.read_bytes()
        if data.startswith(b"\x89PNG\r\n\x1a\n"):
            mime = "image/png"
        elif data.startswith(b"\xff\xd8\xff"):
            mime = "image/jpeg"
        elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
            mime = "image/webp"
        else:
            raise ValueError("unsupported_media_mime")
        h = legacy.digest(path)
        record = records[image["url"]]
        raw = Path(record["original_path"])
        legacy.require((record["sha256"],record["mime"],record["bytes"]) == (h,mime,len(data))
                       and legacy.digest(raw) == record["original_sha256"] in embedded, "original_media_sha")
        descriptors[image["url"]] = {"sha256":h,"mime":mime,"bytes":len(data),"path":str(path),
                                     "original_file":str(raw),"original_sha256":record["original_sha256"]}
    return descriptors


def output_question(kind, prompt, labels, keys, explanation):
    opts = [{"id":f"o{i}","content":c} for i,c in enumerate(labels,1)]
    if kind == "checkbox":
        return {"type":"fields","prompt":prompt,
                "fields":[{"id":"selected","input":"set","label":"勾選正確的項目","options":opts}],
                "answer":{"format":"fields-v1","fields":{"selected":[[f"o{i}" for i in keys]]}},
                "explanation":explanation}
    return {"type":"single","prompt":prompt,"options":opts,
            "answer":{"option_id":f"o{keys[0]}"},"explanation":explanation}


def adapt(parent, targets, original, pages, legacy, docx):
    require = legacy.require
    plain, norm = legacy.plain, legacy.normalize
    asset = parent["question_only_asset"]
    path = Path(asset["local_content"])
    require(legacy.digest(path) == asset["sha256"], "word_snapshot_missing")
    require(legacy.digest(original["question_docx"]) == original["question_docx_sha256"], "original_word_changed")
    parsed = legacy.read(path)
    require(parsed["media"], "original_media_missing")
    assets = verify_assets(parsed,asset["images"],original["question_docx"],legacy)
    native = parent["original_source"]["native_content"]
    raw = native["questions"]
    unit = original["unit"]
    require(targets and all(t.get("include_in_current_practice") is not False for t in targets),"unsupported_target")
    kind = targets[0]["kind"]
    if len(raw)>1 and len(targets)==1 and kind in ("checkbox","multiple_choice"):
        t=targets[0]
        require(t["source_question_indices"]==list(range(1,len(raw)+1)) and 2<=len(raw)<=8, "checkbox_positions")
        original_preamble, lines=legacy.numbered_lines(parsed["text"])
        require(norm(original_preamble)==norm(native["preamble"] or "") and len(lines)==len(raw), "source_preamble")
        require(all(not r["options"] and norm(legacy.statement(r["stem"]))==norm(line)
                    for r,line in zip(raw,lines)), "word_choices")
        original_choices = []
        prefix=[]
        for block in parsed["layout"]:
            if block["type"]=="paragraph":
                entry="".join(run["text"] for run in block["runs"] if run["type"]=="text").strip()
                if re.match(r"^"+r"(?:[（(][\s_＿]*[）)]\s*)?[（(][0-9０-９]+[）)]",entry):
                    require(all(run["type"]=="text" for run in block["runs"]),"option_media")
                    original_choices.append(entry)
                    continue
            require(not original_choices,"media_after_choices")
            prefix.append(block)
        require(len(original_choices)==len(lines),"word_option_numbering")
        prompt=compact_layout(prefix,parsed["media"],docx)
        require(prompt["media"] and norm(prompt["text"])==norm(original_preamble),"word_media_link")
        symbols={"ˇ","✓","√","✔"}
        answers=[[str(a).strip() for v in r["answers"] for a in v if str(a).strip()] for r in raw]
        require(all(not a or len(a)==1 and a[0] in symbols for a in answers),"teacher_checkbox")
        keys=[i for i,a in enumerate(answers,1) if a]
        expected=norm(t["reference_answer"])
        fixed=[int(i) for i in re.findall(r"\(([0-9]+)\)[vVˇ✓√✔]",expected)]
        require(keys and sorted(fixed)==keys and
                not re.sub(r"\([0-9]+\)[vVˇ✓√✔]|[;,、]","",expected),"review_checkbox")
        explanation=t["student_explanation"]
        explanation=re.sub(r"\(([1-8])\)",lambda m:"「"+lines[int(m[1])-1]+"」" if int(m[1])<=len(lines) else m[0],
                           explanation)
        return "checkbox", [
            {"target":t["target_id"],"refs":legacy.refs_for(t,unit,pages),
             "question":output_question("checkbox",prompt,list(map(plain,lines)),keys,plain(explanation))}],assets

    require(len(raw)==len(targets)==1 and not (native.get("preamble") or "").strip(),"other_source_layout")
    t=targets[0]; payload=raw[0]
    require(t["source_question_indices"]==[1], "source_position")
    answer=[str(x).strip() for group in payload["answers"] for x in group if str(x).strip()]
    require(len(answer)==1,"teacher_key")
    if kind=="true_false":
        require(not payload["options"] and norm(legacy.statement(payload["stem"]))==norm(parsed["text"]),"word_prompt")
        codes={"○":1,"◯":1,"〇":1,"ˇ":1,"×":2,"╳":2,"X":2}
        key=codes.get(answer[0])
        require(key and key==codes.get(t["reference_answer"].strip()),"review_boolean_key")
        prompt=compact_layout(parsed["layout"],parsed["media"],docx)
        labels=list(map(plain,("○","╳")))
    elif kind=="single_choice":
        prompt,*labels=docx.split_options(parsed)
        require(norm(prompt["text"])==norm(legacy.statement(payload["stem"])) and
                list(map(norm,[v["text"] for v in labels]))==list(map(norm,payload["options"])),"word_choice_alignment")
        raw_key=norm(answer[0])
        require(raw_key.isdigit() and 1<=int(raw_key)<=len(labels) and raw_key==norm(t["reference_answer"]),
                "review_choice_key")
        require(len({(v["text"],tuple(m["url"] for m in v["media"])) for v in labels})==len(labels),"duplicate_options")
        key=int(raw_key)
    else:
        raise ValueError("other_source_layout")
    explanation=t["student_explanation"]
    if kind=="single_choice":
        # Strip only a trailing summary that cites the already checked option.
        # Keeps the explanation valid regardless of the delivered option order.
        suffix=re.search(r"[，,。；;]\s*(?:所以)?答案(?:是|選)\s*([①②③④⑤⑥⑦⑧])\s*([^。]*)(?:。)?$",explanation)
        if suffix:
            require("①②③④⑤⑥⑦⑧".index(suffix[1])+1==key,"ordinal_explanation_key")
            cited=norm(suffix[2]).rstrip("。")
            require(not cited or cited==norm(labels[key-1]["text"]).rstrip("。"),"ordinal_explanation_label")
            explanation=explanation[:suffix.start()].rstrip()+"。"
    require(not re.search(r"[①②③④⑤⑥⑦⑧]|選項\s*[A-H1-8]",explanation),"ordinal_explanation")
    return kind,[{"target":t["target_id"],"refs":legacy.refs_for(t,unit,pages),
                   "question":output_question(kind,prompt,labels,[key],plain(explanation))}],assets


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ("legacy","docx","export","source-catalog","previous","page-registry","output"):
        parser.add_argument("--"+name, type=Path,required=True)
    args=parser.parse_args()
    legacy=load_module(args.legacy)
    docx=load_module(args.docx)
    sources={r["stable_id"]:r for r in legacy.read(args.source_catalog)["records"]}
    export=legacy.read(args.export)
    parents={r["id"]:r for r in export["parents"]}
    targets=defaultdict(list)
    for t in export["logical_targets"]:
        targets[t["parent_id"]].append(t)
    book=legacy.read(args.page_registry)
    pages={(3 if name.startswith("G3_U3") else 4,p,r["source_filename"],r["source_sha256"],r["pdf_page_1based"])
           for name,r in book.items() for p in r["printed_pages"]}
    rows=[]
    for old in legacy.read(args.previous)["held"]:
        if old["reason"]!="original_media":
            continue
        sid=old["parent"]
        source=sources[sid]
        try:
            rule,qs,assets=adapt(parents[sid],targets[sid],source,pages,legacy,docx)
            rows.append({"passed":True,"parent":sid,"source":source["id"],"unit":source["unit"],
                         "difficulty":source["difficulty"],"rule":rule,"questions":qs,"assets":assets})
        except (KeyError,ValueError,OSError) as exc:
            rows.append({"passed":False,"parent":sid,"reason":str(exc)})
    args.output.write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding="utf8")
    print(Counter(r.get("rule",r.get("reason")) for r in rows))


if __name__=="__main__":
    main()
