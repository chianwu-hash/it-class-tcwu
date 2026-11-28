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


def shared_image_choices(parent, targets, original, pages, legacy, docx, review=None):
    require = legacy.require
    norm = legacy.normalize
    native = parent["original_source"]["native_content"]
    raw = native["questions"]
    kinds = ("single_choice", "multiple_choice") if review else ("single_choice",)
    require(len(raw) == len(targets) > 1 and native.get("preamble")
            and all(t["kind"] in kinds for t in targets)
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
    teacher_keys = []
    if review:
        teacher = Path(original["question_docx"]).with_name("answer.docx.gz")
        require(legacy.digest(teacher) == review["teacher_sha256"], "teacher_word_changed")
        require(len(assets) == 1 and next(iter(assets.values()))["sha256"] == review["image_sha256"],
                "shared_image_changed")
        require(review["pattern"] in ("inline", "separate_options"), "unsupported_choice_layout")
        source_key = teacher_printed_answer(teacher, require)
        expected_mark = "ˇ" if review["pattern"] == "separate_options" else ""
        for i, entry in enumerate(re.split(r"[；;]", source_key.strip()), 1):
            match = re.fullmatch(r"[（(]([１-８1-8])[）)]([①②③④])(ˇ?)", entry.strip())
            require(match and int(match[1]) == i and match[3] == expected_mark, "teacher_choice_position")
            teacher_keys.append(norm(match[2]))
        require(len(teacher_keys) == len(raw), "teacher_choice_count")
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
        if review and review["pattern"] == "separate_options":
            line, removed = re.subn(r"(?m)^\s*[（(][\s_＿]*[）)](?=[①②③④])", "", line)
            require(removed == len(item["options"]), "word_choice_mark_count")
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
        if review:
            require(len(target["positions"]) == 1 and answers[0] == teacher_keys[i-1]
                    == norm(target["positions"][0]["reference_value"]), "review_choice_position")
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


def printed_selection_key(text):
    labels = "①②③④⑤⑥⑦⑧"
    text = re.sub(r"\s+", "", text)
    if re.fullmatch(rf"[{labels}]+圈起來", text):
        return "circle", list(text.removesuffix("圈起來"))
    if re.fullmatch(rf"[{labels}][ˇ✓√✔](?:[；;][{labels}][ˇ✓√✔])*", text):
        return "check", re.findall(rf"[{labels}]", text)
    raise ValueError("printed_selection_key")


def teacher_printed_answer(path, require):
    raw_word = path.read_bytes()
    if raw_word.startswith(b"\x1f\x8b"):
        raw_word = gzip.decompress(raw_word)
    with zipfile.ZipFile(BytesIO(raw_word)) as teacher:
        xml = ElementTree.fromstring(teacher.read("word/document.xml"))
    namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    markup = "".join(node.text or "" for node in xml.iter()
                     if node.tag in {namespace + "t", namespace + "instrText"})
    markup = re.sub(r"eq\s*\\o\(○,([１２３４５６７８1-8])\)",
                    lambda match: "①②③④⑤⑥⑦⑧"[int(match[1])-1], markup)
    require(re.match(r"^\s*答案[：:]", markup), "teacher_key")
    return re.sub(r"^\s*答案[：:]", "", markup)


def checked_explanation(target, revision, require):
    explanation = target["student_explanation"]
    if revision is not None:
        require(explanation == revision["original"] and revision["corrected"].strip(), "review_explanation_changed")
        return revision["corrected"]
    return explanation


def visual_grid_selection(parent, targets, original, pages, legacy, docx, review):
    require = legacy.require
    native = parent["original_source"]["native_content"]
    raw = native["questions"]
    require(len(raw) == len(targets) == 1 and not raw[0]["options"]
            and not (native.get("preamble") or "").strip(), "other_source_layout")
    target = targets[0]
    require(target["kind"] in ("checkbox", "multiple_choice")
            and target.get("include_in_current_practice") is not False
            and target["source_question_indices"] == [1]
            and len(target["positions"]) == 1, "source_position")
    labels = review["ordinals"]
    require(2 <= len(labels) <= 8 and labels == list("①②③④⑤⑥⑦⑧"[:len(labels)]), "printed_ordinal")

    word = Path(original["question_docx"])
    teacher_word = word.with_name("answer.docx.gz")
    asset = parent["question_only_asset"]
    snapshot = Path(asset["local_content"])
    require(legacy.digest(snapshot) == asset["sha256"], "word_snapshot_missing")
    require(legacy.digest(word) == original["question_docx_sha256"], "original_word_changed")
    require(legacy.digest(teacher_word) == review["answer_sha256"], "teacher_word_changed")
    parsed = legacy.read(snapshot)
    require(len(parsed["media"]) == 1 and len(parsed["layout"]) == 2
            and [block["type"] for block in parsed["layout"]] == ["paragraph", "paragraph"]
            and all(run["type"] == "text" for run in parsed["layout"][0]["runs"])
            and [run["type"] for run in parsed["layout"][1]["runs"]] == ["image"], "other_source_layout")
    assets = verify_assets(parsed, asset["images"], word, legacy)
    require(next(iter(assets.values()))["sha256"] == review["image_sha256"], "printed_ordinal")
    prompt = compact_layout(parsed["layout"], parsed["media"], docx)
    stem = re.sub(r"(?:【[\s_＿]*】\s*)+$", "", raw[0]["stem"]).strip()
    require(legacy.normalize(stem) == legacy.normalize(prompt["text"]), "word_prompt")

    key = printed_selection_key(teacher_printed_answer(teacher_word, require))
    recorded = "；".join(a.strip() for group in raw[0]["answers"] for a in group if a.strip())
    require(key == printed_selection_key(recorded)
            == printed_selection_key(target["reference_answer"])
            == printed_selection_key(target["positions"][0]["reference_value"]), "review_selection_key")
    mode, selected = key
    require(selected == [label for label in labels if label in selected], "printed_selection_positions")
    require((mode == "circle" and "圈" in stem) or (mode == "check" and "ˇ" in stem), "word_selection_action")

    explanation = checked_explanation(target, review.get("explanation_review"), require)
    options = list(map(legacy.plain, labels))
    keys = [labels.index(label) + 1 for label in selected]
    question = output_question("checkbox", prompt, options, keys, legacy.plain(explanation))
    return [{"target":target["target_id"],"refs":legacy.refs_for(target, original["unit"], pages),
             "question":question}], assets


def visual_grid_matching(parent, targets, original, pages, legacy, docx, review):
    require = legacy.require
    native = parent["original_source"]["native_content"]
    raw = native["questions"]
    require(len(raw) == 1 and not raw[0]["options"] and not (native.get("preamble") or "").strip(),
            "other_source_layout")
    left, right = review["left"], review["right"]
    labels = list("①②③④⑤⑥⑦⑧"[:len(left)])
    codes = list("ㄅㄆㄇ"[:len(right)])
    require(2 <= len(left) <= 8 and list(left) == labels and 2 <= len(right) <= 3 and list(right) == codes
            and len(set(right.values())) == len(right), "printed_matching_domain")
    require(len(targets) == len(labels) and all(t["kind"] == "matching"
            and t["source_question_indices"] == [1] and len(t["positions"]) == 1 for t in targets), "source_position")

    word = Path(original["question_docx"])
    teacher = word.with_name("answer.docx.gz")
    asset = parent["question_only_asset"]
    snapshot = Path(asset["local_content"])
    require(legacy.digest(snapshot) == asset["sha256"], "word_snapshot_missing")
    require(legacy.digest(word) == original["question_docx_sha256"] == review["question_sha256"], "original_word_changed")
    require(legacy.digest(teacher) == review["teacher_sha256"], "teacher_word_changed")
    parsed = legacy.read(snapshot)
    layout = parsed["layout"]
    require(len(parsed["media"]) == 1 and 2 <= len(layout) <= 4
            and all(block["type"] == "paragraph" for block in layout)
            and all(run["type"] == "text" for block in layout[:-1] for run in block["runs"])
            and [run["type"] for run in layout[-1]["runs"]] == ["image"], "other_source_layout")
    assets = verify_assets(parsed, asset["images"], word, legacy)
    require(next(iter(assets.values()))["sha256"] == review["image_sha256"], "printed_ordinal")
    stem = re.sub(r"(?:【[\s_＿]*】\s*)+$", "", raw[0]["stem"]).strip()
    require(legacy.normalize(stem) == legacy.normalize(parsed["text"]), "word_prompt")

    keys = [label + review["matches"][label] for label in labels]
    require(list(review["matches"]) == labels and all(key[1:] in right for key in keys), "printed_matching_domain")
    recorded = "；".join(a.strip() for group in raw[0]["answers"] for a in group if a.strip())
    require(keys == re.split(r"[；;]", teacher_printed_answer(teacher, require).strip())
            == re.split(r"[；;]", recorded), "printed_matching_key")
    by_label = {}
    for target in targets:
        position = target["positions"][0]
        match = re.match(r"^第?([①②③④⑤⑥⑦⑧])", position.get("source_part_locator") or "")
        require(match and match[1] not in by_label, "source_position")
        by_label[match[1]] = target
    require(set(by_label) == set(labels), "source_position")

    first = "".join(run["text"] for run in layout[0]["runs"]).strip()
    require(first == review["original_instruction"], "matching_instruction_changed")
    instruction = review["display_instruction"].strip()
    require(instruction, "matching_instruction_missing")
    material = compact_layout([{"type":"paragraph","runs":[{"type":"text","text":instruction}]}, layout[-1]],
                              parsed["media"], docx)
    questions = []
    for key in keys:
        label, code = key
        t = by_label[label]
        position = t["positions"][0]
        require(t["reference_answer"].strip() in (code, key)
                and position["reference_value"].strip() in (code, key), "review_matching_key")
        explanation = checked_explanation(t, review.get("explanations", {}).get(label), require)
        caption = left[label] if review["printed_text_labels"] else ""
        question = {"type":"fields", "prompt":legacy.plain(f"圖 {label}" + (f"　{caption}" if caption else "")),
                    "fields":[{"id":"pair", "label":"配對答案", "input":"single",
                               "options":[{"id":f"o{i}", "content":legacy.plain(right[c])} for i, c in enumerate(codes, 1)]}],
                    "answer":{"format":"fields-v1", "fields":{"pair":[f"o{codes.index(code)+1}"]}},
                    "explanation":legacy.plain(explanation)}
        questions.append({"target":t["target_id"],"refs":legacy.refs_for(t, original["unit"], pages),"question":question})
    return material, questions, assets


def reviewed_mixed_single_choices(parent, targets, original, pages, legacy, docx, review):
    require, norm = legacy.require, legacy.normalize
    native = parent["original_source"]["native_content"]
    raw = native["questions"]
    require(native.get("preamble") and len(raw) == len(targets) == len(review["choices"]) > 1
            and all(t["kind"] in ("single_choice", "multiple_choice") for t in targets), "mixed_choice_structure")
    indexed = {tuple(t["source_question_indices"]): t for t in targets}
    require(set(indexed) == {(i,) for i in range(1, len(raw)+1)}, "source_position")
    word = Path(original["question_docx"])
    teacher = word.with_name("answer.docx.gz")
    asset = parent["question_only_asset"]
    snapshot = Path(asset["local_content"])
    require(legacy.digest(snapshot) == asset["sha256"], "word_snapshot_missing")
    require(legacy.digest(word) == original["question_docx_sha256"] == review["question_sha256"], "original_word_changed")
    require(legacy.digest(teacher) == review["teacher_sha256"], "teacher_word_changed")
    parsed = legacy.read(snapshot)
    require(all(b["type"] == "paragraph" for b in parsed["layout"]), "original_table")
    assets = verify_assets(parsed, asset["images"], word, legacy)
    require(len(assets) == 1 and next(iter(assets.values()))["sha256"] == review["image_sha256"], "shared_image_changed")

    prefix, items = [], []
    for block in parsed["layout"]:
        line = "".join(run["text"] for run in block["runs"] if run["type"] == "text")
        match = legacy.WORD_ORDINAL.fullmatch(line)
        if match:
            require(norm(match[1]) == str(len(items)+1), "source_position")
            items.append([{**block, "runs":[{"type":"text", "text":match[2]}]}])
        else:
            (items[-1] if items else prefix).append(block)
    material = compact_layout(prefix, parsed["media"], docx)
    require(norm(material["text"]) == norm(native["preamble"]) and len(items) == len(raw), "source_preamble")
    require(review["placement"] in ("shared", "last_item")
            and bool(material["media"]) == (review["placement"] == "shared"), "mixed_choice_image_scope")

    teacher_keys = re.split(r"[；;]", teacher_printed_answer(teacher, require).strip())
    require(len(teacher_keys) == len(raw), "teacher_choice_count")
    questions = []
    for i, (item, blocks, entry, expected) in enumerate(zip(raw, items, teacher_keys, review["choices"]), 1):
        target = indexed[(i,)]
        mode, options = expected["mode"], expected["options"]
        require(expected["ordinal"] == i and len(target["positions"]) == 1, "source_position")
        match = re.fullmatch(r"[（(]([１-８1-8])[）)](.+)", entry.strip())
        require(match and int(match[1]) == i, "teacher_choice_position")
        extracted = [a.strip() for group in item["answers"] for a in group if a.strip()]
        require(len(extracted) == 1 and norm(extracted[0]) == norm(match[2])
                == norm(target["reference_answer"]) == norm(target["positions"][0]["reference_value"]),
                "review_choice_position")

        content = compact_layout(blocks, parsed["media"], docx)
        require(bool(content["media"]) == (review["placement"] == "last_item" and i == len(raw)), "mixed_choice_image_scope")
        if mode in ("circled_text", "bopomofo"):
            require(not content["media"], "mixed_choice_image_scope")
            pattern = r"[①②③④]" if mode == "circled_text" else r"[（(][\s_＿]*[）)]\s*([ㄅㄆㄇㄈ])\s*"
            tokens = list(re.finditer(pattern, content["text"]))
            codes = [(m[0] if mode == "circled_text" else m[1]) for m in tokens]
            labels = [content["text"][m.end():tokens[j+1].start() if j+1 < len(tokens) else len(content["text"])].strip()
                      for j, m in enumerate(tokens)]
            require(codes == list(options) and list(map(norm, labels)) == list(map(norm, options.values())), "word_choice_alignment")
            if item["options"]:
                require(list(map(norm, labels)) == list(map(norm, item["options"])), "publisher_choice_alignment")
            stem = content["text"][:tokens[0].start()].strip()
            key = match[2].removesuffix("ˇ")
            prompt = legacy.plain(stem)
        else:
            require(content["media"] and mode in ("image_circled", "image_directions"), "mixed_choice_image_scope")
            require(list(options) == list("①②" if mode == "image_circled" else "北東南西"), "printed_matching_domain")
            stem = content["text"]
            key = match[2].removeprefix("ˇ")
            prompt = content
        require(norm(stem) == norm(expected["stem"]) and key == expected["key"] and key in options, "word_choice_alignment")
        question = output_question("single_choice", prompt, list(map(legacy.plain, options.values())),
                                   [list(options).index(key)+1], legacy.plain(target["student_explanation"]))
        questions.append({"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages),"question":question})
    return material, questions, assets


def reviewed_text_source(parent, targets, original, legacy, review, preamble_key=None):
    require, norm = legacy.require, legacy.normalize
    native = parent["original_source"]["native_content"]
    raw = native["questions"]
    require(len(raw) == len(targets) > 1 and native.get("preamble"), "reviewed_text_source_structure")
    indexed = {tuple(t["source_question_indices"]):t for t in targets}
    require(set(indexed) == {(i,) for i in range(1, len(raw)+1)}, "source_position")
    word = Path(original["question_docx"])
    teacher = word.with_name("answer.docx.gz")
    snapshot = Path(parent["question_only_asset"]["local_content"])
    require(legacy.digest(word) == original["question_docx_sha256"] == review["question_sha256"], "original_word_changed")
    require(legacy.digest(teacher) == review["teacher_sha256"], "teacher_word_changed")
    require(legacy.digest(snapshot) == parent["question_only_asset"]["sha256"] == review["snapshot_sha256"], "word_snapshot_missing")
    body = legacy.read(snapshot)
    require(not body["media"] and all(b["type"] == "paragraph" for b in body["layout"]), "reviewed_text_source_layout")
    preamble, lines = legacy.numbered_lines(body["text"])
    compare = preamble_key or norm
    require(compare(preamble) == compare(native["preamble"]) and len(lines) == len(raw), "source_preamble")
    parts = re.split(r"[（(]([１-８1-8])[）)]", teacher_printed_answer(teacher, require))
    require(not parts[0].strip() and [int(n) for n in parts[1::2]] == list(range(1, len(raw)+1)), "teacher_choice_position")
    return preamble, indexed, list(zip(raw, lines, parts[2::2], strict=True))


def reviewed_text_classification(parent, targets, original, pages, legacy, review):
    require, norm, plain = legacy.require, legacy.normalize, legacy.plain
    preamble, indexed, entries = reviewed_text_source(parent, targets, original, legacy, review)
    require(len(entries) == len(review["match"]) and all(t["kind"] == "matching" for t in targets), "classification_source_structure")
    domain = review["options"]
    require(list(domain) in [list(s) for s in ("ㄅㄆ", "ㄅㄆㄇ", "ABC", "甲乙丙")]
            and len(set(domain.values())) == len(domain), "classification_domain")
    previous = -1
    for code in domain:
        index = preamble.find(code, previous+1)
        require(index > previous, "classification_domain")
        previous = index

    def key(text):
        return norm(text).strip(";").split(";")

    multiple = review["set_domain"] is True
    options = [plain(label) for label in domain.values()]
    options_by_code = {code: i for i, code in enumerate(domain, 1)}
    result = []
    for i, ((item, line, printed_key), expected) in enumerate(zip(entries, review["match"], strict=True), 1):
        target = indexed[(i,)]
        require(expected["ordinal"] == i and len(target["positions"]) == 1, "source_position")
        selected = expected["selection"]
        original_key = "；".join(a.strip() for group in item["answers"] for a in group if a.strip())
        require(selected and selected == [c for c in domain if c in selected]
                and selected == key(printed_key) == key(original_key) == key(target["reference_answer"])
                == key(target["positions"][0]["reference_value"]), "classification_answer_key")
        require(not item["options"] and (multiple or len(selected) == 1), "classification_answer_mode")
        prompt = legacy.statement(line).rstrip("：:")
        require(prompt and norm(prompt) == norm(legacy.statement(item["stem"]).rstrip("：:")), "word_prompt")
        q = output_question("checkbox" if multiple else "single_choice", plain(prompt), options,
                            [options_by_code[c] for c in selected], plain(target["student_explanation"]))
        result.append({"target":target["target_id"], "refs":legacy.refs_for(target,original["unit"],pages), "question":q})
    return plain(preamble), result, {}


def reviewed_text_choices(parent, targets, original, pages, legacy, review):
    require, norm, plain = legacy.require, legacy.normalize, legacy.plain
    preamble, indexed, entries = reviewed_text_source(parent, targets, original, legacy, review)
    require(len(entries) == len(review["items"]) and all(t["kind"] in ("checkbox", "multiple_choice", "single_choice_code")
            for t in targets), "choice_source_structure")

    questions = []
    for i, ((item, line, teacher_key), expected) in enumerate(zip(entries, review["items"], strict=True), 1):
        target = indexed[(i,)]
        require(expected["ordinal"] == i and len(target["positions"]) == 1, "source_position")
        answer = norm(teacher_key).strip(";")
        publisher = norm("；".join(a for group in item["answers"] for a in group if a.strip())).strip(";")
        require(answer and answer == publisher == norm(target["reference_answer"]).strip(";")
                == norm(target["positions"][0]["reference_value"]).strip(";"), "review_choice_position")
        is_circled = expected["mode"] == "circled_text"
        require(is_circled == bool(item["options"]) and expected["mode"] in ("circled_text", "bopomofo"), "printed_choice_layout")
        pattern = r"[①②③④]" if is_circled else r"[（(][\s_＿]*[）)]\s*([ㄅㄆㄇㄈㄉ])\s*"
        spans = list(re.finditer(pattern, line))
        codes = [m[0] if is_circled else m[1] for m in spans]
        alphabet = "①②③④" if is_circled else "ㄅㄆㄇㄈㄉ"
        require(2 <= len(codes) <= len(alphabet) and codes == list(alphabet[:len(codes)]), "printed_choice_order")
        labels = [line[m.end():spans[j+1].start() if j+1<len(spans) else len(line)].strip() for j,m in enumerate(spans)]
        require(codes == list(expected["options"]) and list(map(norm, labels)) == list(map(norm, expected["options"].values())), "word_choice_alignment")
        if is_circled:
            require(answer.isdigit() and 1 <= int(answer) <= len(codes)
                    and list(map(norm, labels)) == list(map(norm, item["options"])), "publisher_choice_alignment")
            chosen = [codes[int(answer)-1]]
        else:
            marked = answer.split(";")
            require(all(re.fullmatch(r"[ㄅㄆㄇㄈㄉ]ˇ", m) for m in marked), "printed_choice_mark")
            chosen = [m[0] for m in marked]
        require(chosen == expected["selected"] == [c for c in codes if c in chosen], "word_choice_alignment")
        stem = line[:spans[0].start()].strip()
        require(stem and norm(stem) == norm(expected["stem"]), "word_prompt")
        question = output_question("checkbox" if len(chosen)>1 else "single_choice", plain(stem), list(map(plain,labels)),
                                   [codes.index(c)+1 for c in chosen], plain(target["student_explanation"]))
        questions.append({"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages),"question":question})
    return plain(preamble), questions, {}


def printed_boolean_key(value, ordinal, legacy):
    value = legacy.normalize(value).strip(";")
    position = re.fullmatch(r"\((\d+)\)(.+)", value)
    if position:
        legacy.require(int(position[1]) == ordinal, "boolean_key_position")
        value = position[2]
    return {"○":True,"◯":True,"〇":True,"ˇ":True,"✓":True,"✔":True,"√":True,"v":True,"o":True,
            "╳":False,"×":False,"x":False,"✕":False,"✗":False,"✘":False}.get(value.lower())


def reviewed_text_booleans(parent, targets, original, pages, legacy, review):
    require, norm, plain = legacy.require, legacy.normalize, legacy.plain
    def preamble_key(text):
        return norm(text).replace("◯", "○").replace("⋯⋯", "......")

    material, indexed, entries = reviewed_text_source(parent, targets, original, legacy, review, preamble_key)
    require(len(entries) == len(review["positions"]) and all(t["kind"] == "true_false" for t in targets),
            "boolean_source_structure")
    questions = []
    for ordinal, ((item, line, teacher_key), expected) in enumerate(zip(entries, review["positions"], strict=True), 1):
        target = indexed[(ordinal,)]
        require(expected["index"] == ordinal and type(expected["keys"]["teacher"]) is bool
                and len(target["positions"]) == 1 and not item["options"], "source_position")
        publisher = [a.strip() for group in item["answers"] for a in group if a.strip()]
        require(len(publisher) == 1, "boolean_publisher_key")
        selected = expected["keys"]["teacher"]
        keys = (teacher_key, publisher[0], target["reference_answer"], target["positions"][0]["reference_value"])
        require(all(printed_boolean_key(key, ordinal, legacy) is selected for key in keys), "boolean_answer_key")
        prompt = legacy.statement(line)
        publisher_prompt = legacy.statement(item["stem"])
        correction = expected.get("verified_transcription")
        if correction:
            require(prompt == correction["word"] and publisher_prompt == correction["transcription"]
                    and target["student_explanation"] == correction["fixed_explanation"], "boolean_transcription_review")
        else:
            require(prompt and norm(prompt) == norm(publisher_prompt), "word_prompt")
        options = list(map(plain, ("○","╳")))
        question = output_question("true_false", plain(prompt), options, [1 if selected else 2], plain(target["student_explanation"]))
        questions.append({"target":target["target_id"], "refs":legacy.refs_for(target,original["unit"],pages), "question":question})
    return plain(material), questions, {}


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
    parser.add_argument("--visual-grid-selections", type=Path)
    parser.add_argument("--visual-grid-matching", type=Path)
    parser.add_argument("--shared-single-reviews", type=Path)
    parser.add_argument("--mixed-single-reviews", type=Path)
    parser.add_argument("--text-classification-reviews", type=Path)
    parser.add_argument("--text-choice-reviews", type=Path)
    parser.add_argument("--text-boolean-reviews", type=Path)
    args=parser.parse_args()
    legacy=load_module(args.legacy)
    docx=load_module(args.docx)
    visual_reviews = legacy.read(args.visual_ordinals) if args.visual_ordinals else {}
    grid_reviews = legacy.read(args.visual_grid_selections) if args.visual_grid_selections else {}
    matching_reviews = legacy.read(args.visual_grid_matching) if args.visual_grid_matching else {}
    single_reviews = legacy.read(args.shared_single_reviews) if args.shared_single_reviews else {}
    mixed_reviews = legacy.read(args.mixed_single_reviews) if args.mixed_single_reviews else {}
    classification_reviews = legacy.read(args.text_classification_reviews) if args.text_classification_reviews else {}
    choice_reviews = legacy.read(args.text_choice_reviews) if args.text_choice_reviews else {}
    boolean_reviews = legacy.read(args.text_boolean_reviews) if args.text_boolean_reviews else {}
    modes = (visual_reviews, grid_reviews, matching_reviews, single_reviews, mixed_reviews, classification_reviews, choice_reviews, boolean_reviews)
    if len(set().union(*modes)) != sum(map(len, modes)):
        parser.error("the same source cannot use multiple visual review modes")
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
        sid=old["parent"]
        if old["reason"]!="original_media" and not any(sid in reviews for reviews in (classification_reviews, choice_reviews, boolean_reviews)):
            continue
        source=sources[sid]
        try:
            parent = parents[sid]
            group = targets[sid]
            material = None
            if sid in visual_reviews:
                rule = "visual_true_false"
                material, qs, assets = visual_true_false(parent, group, source, pages, legacy, docx, visual_reviews[sid])
            elif sid in grid_reviews:
                rule = "visual_grid_selection"
                qs, assets = visual_grid_selection(parent, group, source, pages, legacy, docx, grid_reviews[sid])
            elif sid in matching_reviews:
                rule = "visual_grid_matching"
                material, qs, assets = visual_grid_matching(parent, group, source, pages, legacy, docx, matching_reviews[sid])
            elif sid in single_reviews:
                rule = "reviewed_shared_single_choices"
                material, qs, assets = shared_image_choices(parent, group, source, pages, legacy, docx, single_reviews[sid])
            elif sid in mixed_reviews:
                rule = "reviewed_mixed_single_choices"
                material, qs, assets = reviewed_mixed_single_choices(parent, group, source, pages, legacy, docx, mixed_reviews[sid])
            elif sid in classification_reviews:
                rule = "reviewed_text_classification"
                material, qs, assets = reviewed_text_classification(parent, group, source, pages, legacy, classification_reviews[sid])
            elif sid in choice_reviews:
                rule = "reviewed_text_choices"
                material, qs, assets = reviewed_text_choices(parent, group, source, pages, legacy, choice_reviews[sid])
            elif sid in boolean_reviews:
                rule = "reviewed_text_booleans"
                material, qs, assets = reviewed_text_booleans(parent, group, source, pages, legacy, boolean_reviews[sid])
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
