"""Preserve Word media placement for verified Grade 3 science questions."""
import argparse
from collections import Counter, defaultdict
import gzip
from hashlib import sha256
import importlib.util
from io import BytesIO
import json
from pathlib import Path
import re
from xml.etree import ElementTree
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


def shared_image_choices(parent, targets, original, pages, legacy, docx):
    require = legacy.require
    norm = legacy.normalize
    native = parent["original_source"]["native_content"]
    raw = native["questions"]
    require(len(raw) == len(targets) > 1 and native.get("preamble")
            and all(t["kind"] == "single_choice" for t in targets)
            and all(item["options"] for item in raw), "other_source_layout")
    by_position = {tuple(t["source_question_indices"]):t for t in targets}
    require(set(by_position) == {(i,) for i in range(1, len(raw) + 1)}, "source_position")
    asset = parent["question_only_asset"]
    path = Path(asset["local_content"])
    require(legacy.digest(path) == asset["sha256"], "word_snapshot_missing")
    require(legacy.digest(original["question_docx"]) == original["question_docx_sha256"],
            "original_word_changed")
    parsed = legacy.read(path)
    require(all(block["type"] == "paragraph" for block in parsed["layout"]), "original_table")
    assets = verify_assets(parsed, asset["images"], original["question_docx"], legacy)
    prefix, body = [], []
    for block in parsed["layout"]:
        runs = block["runs"]
        text = "".join(run["text"] for run in runs if run["type"] == "text").strip()
        if body or legacy.WORD_ORDINAL.fullmatch(text):
            require(all(run["type"] == "text" for run in runs), "item_media")
            body.append(text)
        else:
            prefix.append(block)
    common = compact_layout(prefix, parsed["media"], docx)
    require(common["media"] and norm(common["text"]) == norm(native["preamble"]), "source_preamble")
    extra_preamble, lines = legacy.numbered_lines("\n".join(body))
    require(not extra_preamble and len(lines) == len(raw), "source_position")
    questions = []
    for i, (item, line) in enumerate(zip(raw, lines), 1):
        target = by_position[(i,)]
        source = {"layout":[{"type":"paragraph","runs":[{"type":"text","text":line}]}],"media":[]}
        prompt, *labels = docx.split_options(source)
        labels = [legacy.plain(label["text"]) for label in labels]
        require(norm(prompt["text"]) == norm(legacy.statement(item["stem"]))
                and [norm(label["text"]) for label in labels] == list(map(norm, item["options"])),
                "word_choice_alignment")
        require(len({norm(label["text"]) for label in labels}) == len(labels), "duplicate_options")
        answers = [norm(str(a)) for group in item["answers"] for a in group if str(a).strip()]
        require(len(answers) == 1 and answers[0] in {str(j) for j in range(1, len(labels)+1)}
                and answers[0] == norm(target["reference_answer"]), "review_choice_key")
        explanation = re.sub(r"[①②③④]", lambda match: "「"+labels[ord(match[0])-0x2460]["text"]+"」"
                             if ord(match[0])-0x2460 < len(labels) else match[0],
                             target["student_explanation"])
        require(not re.search(r"[①②③④⑤⑥⑦⑧]|選項\s*[A-H1-8]", explanation), "ordinal_explanation")
        question = output_question("single_choice", legacy.plain(prompt["text"]), labels,
                                   [int(answers[0])], legacy.plain(explanation))
        questions.append({"target":target["target_id"],"refs":legacy.refs_for(target, original["unit"], pages),
                          "question":question})
    return common, questions, assets


def visual_true_false(parent, targets, original, pages, legacy, docx, visual_review):
    require = legacy.require
    native = parent["original_source"]["native_content"]
    raw = native["questions"]
    require(len(raw) == 1 and not raw[0]["options"] and not (native.get("preamble") or "").strip()
            and 2 <= len(targets) <= 4 and all(t["kind"] == "true_false" for t in targets), "other_source_layout")
    source_part = r"^(?:原圖|第)?([①②③④ㄅㄆㄇ])"
    labels = visual_review["ordinals"]
    require(labels in [list("①②③"), list("①②③④"), list("ㄅㄆㄇ")] and len(labels) == len(targets),
            "printed_ordinal")
    by_label = {}
    for target in targets:
        match = re.match(source_part, target.get("source_part_locator") or "")
        require(target["source_question_indices"] == [1] and match and match[1] not in by_label,
                "source_position")
        by_label[match[1]] = target
    require(set(labels) == by_label.keys(), "source_position")

    word = Path(original["question_docx"])
    teacher_word = word.with_name("answer.docx.gz")
    asset = parent["question_only_asset"]
    path = Path(asset["local_content"])
    require(legacy.digest(path) == asset["sha256"], "word_snapshot_missing")
    require(legacy.digest(word) == original["question_docx_sha256"], "original_word_changed")
    require(legacy.digest(teacher_word) == visual_review["answer_sha256"], "teacher_word_changed")
    parsed = legacy.read(path)
    require(len(parsed["media"]) == 1 and len(parsed["layout"]) == 2
            and [block["type"] for block in parsed["layout"]] == ["paragraph", "paragraph"]
            and all(run["type"] == "text" for run in parsed["layout"][0]["runs"])
            and [run["type"] for run in parsed["layout"][1]["runs"]] == ["image"], "other_source_layout")
    assets = verify_assets(parsed, asset["images"], word, legacy)
    require(next(iter(assets.values()))["sha256"] == visual_review["image_sha256"], "printed_ordinal")
    common = compact_layout(parsed["layout"], parsed["media"], docx)
    printed_stem = re.sub(r"(?:【[\s_＿]*】\s*)+$", "", raw[0]["stem"]).strip()
    require(legacy.normalize(printed_stem) == legacy.normalize(common["text"]), "word_prompt")

    ns = {"w":"http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    with zipfile.ZipFile(BytesIO(gzip.decompress(teacher_word.read_bytes()))) as teacher:
        xml = ElementTree.fromstring(teacher.read("word/document.xml"))
    markup = "".join(node.text or "" for node in xml.iter()
                     if node.tag in {f"{{{ns['w']}}}t", f"{{{ns['w']}}}instrText"})
    markup = re.sub(r"eq\s*\\o\(○,([１２３４1-4])\)", lambda m: "①②③④"[int(m[1])-1], markup)
    marks = r"[ˇ✓√✔○◯×╳X]"
    teacher_keys = re.findall(r"([①②③④ㄅㄆㄇ])("+marks+")", markup)
    require(not re.sub(r"答案[：:]|[；;\s]|[①②③④ㄅㄆㄇ]"+marks, "", markup), "teacher_key")
    raw_keys = re.findall(r"([①②③④ㄅㄆㄇ])("+marks+")", "；".join(a.strip() for group in raw[0]["answers"] for a in group))
    require([label for label, _ in teacher_keys] == labels and raw_keys == teacher_keys, "teacher_key")
    questions = []
    for label, mark in teacher_keys:
        t = by_label[label]
        require(t["reference_answer"].strip() == label + mark and len(t["positions"]) == 1,
                "review_boolean_key")
        position = t["positions"][0]
        position_label = re.match(source_part, position.get("source_part_locator") or "")
        require(position_label and position_label[1] == label and position["reference_value"].strip() in (mark, label + mark),
                "review_boolean_key")
        key = 1 if mark in "ˇ✓√✔○◯" else 2
        question = output_question("true_false", legacy.plain(f"判斷圖 {label}。"),
                                   list(map(legacy.plain, ("○", "×"))), [key],
                                   legacy.plain(t["student_explanation"]))
        questions.append({"target":t["target_id"],"refs":legacy.refs_for(t, original["unit"], pages),
                          "question":question})
    return common, questions, assets


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
    parser.add_argument("--visual-ordinals", type=Path)
    args=parser.parse_args()
    legacy=load_module(args.legacy)
    docx=load_module(args.docx)
    visual_reviews = legacy.read(args.visual_ordinals) if args.visual_ordinals else {}
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
            parent = parents[sid]
            group = targets[sid]
            material = None
            if sid in visual_reviews:
                rule = "visual_true_false"
                material, qs, assets = visual_true_false(parent, group, source, pages, legacy, docx, visual_reviews[sid])
            elif len(group) > 1 and all(t["kind"] == "single_choice" for t in group):
                rule = "shared_image_choices"
                material, qs, assets = shared_image_choices(parent, group, source, pages, legacy, docx)
            else:
                rule,qs,assets=adapt(parent,group,source,pages,legacy,docx)
            row = {"passed":True,"parent":sid,"source":source["id"],"unit":source["unit"],
                   "difficulty":source["difficulty"],"rule":rule,"questions":qs,"assets":assets}
            if material is not None:
                row["material"] = material
            rows.append(row)
        except (KeyError,ValueError,OSError) as exc:
            rows.append({"passed":False,"parent":sid,"reason":str(exc)})
    args.output.write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding="utf8")
    print(Counter(r.get("rule",r.get("reason")) for r in rows))


if __name__=="__main__":
    main()
