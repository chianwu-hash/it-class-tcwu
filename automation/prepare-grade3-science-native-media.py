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


def reviewed_text_entries(parent, original, legacy, review, preamble_key=None):
    require, norm = legacy.require, legacy.normalize
    native = parent["original_source"]["native_content"]
    raw = native["questions"]
    require(raw and native.get("preamble"), "reviewed_text_source_structure")
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
    return preamble, list(zip(raw, lines, parts[2::2], strict=True))


def reviewed_text_source(parent, targets, original, legacy, review, preamble_key=None, minimum_item_count=2):
    preamble, entries = reviewed_text_entries(parent, original, legacy, review, preamble_key)
    indexed = {tuple(t["source_question_indices"]):t for t in targets}
    legacy.require(len(entries) == len(targets) >= minimum_item_count
                   and set(indexed) == {(i,) for i in range(1,len(entries)+1)}, "source_position")
    return preamble, indexed, entries


def reviewed_text_classification(parent, targets, original, pages, legacy, review):
    require, norm, plain = legacy.require, legacy.normalize, legacy.plain
    preamble, indexed, entries = reviewed_text_source(parent, targets, original, legacy, review)
    kinds = ("matching", "short_answer") if review.get("reviewed_code_bank") else ("matching",)
    require(len(entries) == len(review["match"]) and all(t["kind"] in kinds for t in targets), "classification_source_structure")
    domain = review["options"]
    require(list(domain) in [list(s) for s in ("ㄅㄆ", "ㄅㄆㄇ", "ABC", "甲乙丙")]
            and len(set(domain.values())) == len(domain), "classification_domain")
    previous = -1
    for code in domain:
        index = preamble.find(code, previous+1)
        require(index > previous, "classification_domain")
        previous = index

    def key(text):
        if isinstance(text, list):
            return list(map(norm, text))
        return re.split(r"[;、]", norm(text).strip(";、"))

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
    preamble, indexed, entries = reviewed_text_source(parent, targets, original, legacy, review, minimum_item_count=1)
    require(len(entries) == len(review["items"]) and all(t["kind"] in ("checkbox", "multiple_choice", "single_choice_code")
            for t in targets), "choice_source_structure")

    questions = []
    for i, ((item, line, teacher_key), expected) in enumerate(zip(entries, review["items"], strict=True), 1):
        target = indexed[(i,)]
        require(expected["ordinal"] == i and len(target["positions"]) == 1, "source_position")
        mode = expected["mode"]
        answer = norm(teacher_key).strip(";")
        if mode == "circled_mark":
            require(re.fullmatch(r"[1-4]ˇ", answer), "printed_choice_mark")
            answer = answer.removesuffix("ˇ")
        publisher = norm("；".join(a for group in item["answers"] for a in group if a.strip())).strip(";")
        require(answer and answer == publisher == norm(target["reference_answer"]).strip(";")
                == norm(target["positions"][0]["reference_value"]).strip(";"), "review_choice_position")
        is_circled = mode in ("circled_text", "circled_mark")
        require(is_circled == bool(item["options"]) and mode in ("circled_text", "circled_mark", "bopomofo"), "printed_choice_layout")
        pattern = {"circled_text":r"([①②③④])",
                   "circled_mark":r"[（(][\s_＿]*[）)]\s*([①②③④])\s*",
                   "bopomofo":r"[（(][\s_＿]*[）)]\s*([ㄅㄆㄇㄈㄉ])\s*"}[mode]
        spans = list(re.finditer(pattern, line))
        codes = [m[1] for m in spans]
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


def reviewed_numbered_choices(parent, targets, original, pages, legacy, review):
    require, norm, plain = legacy.require, legacy.normalize, legacy.plain
    native = parent["original_source"]["native_content"]
    asset = parent["question_only_asset"]
    snapshot = Path(asset["local_content"])
    word = Path(original["question_docx"])
    teacher = word.with_name("answer.docx.gz")
    require(legacy.digest(word) == original["question_docx_sha256"] == review["question_sha256"], "original_word_changed")
    require(legacy.digest(teacher) == review["teacher_sha256"], "teacher_word_changed")
    require(legacy.digest(snapshot) == asset["sha256"] == review["snapshot_sha256"], "word_snapshot_missing")
    body = legacy.read(snapshot)
    require(not body["media"] and all(b["type"] == "paragraph" for b in body["layout"]), "reviewed_text_source_layout")
    preamble, labels = legacy.numbered_lines(body["text"])
    require(preamble == review["source_introduction"] and labels == review["source_options"], "printed_choice_layout")
    require(len(targets) == 1 and 2 <= len(labels) == len(native["questions"]) <= 8, "source_position")
    target = targets[0]
    require(target["kind"] in ("checkbox", "multiple_choice") and target["target_id"] == review["target"]
            and len(target["positions"]) == 1 and target["source_question_indices"] == list(range(1,len(labels)+1)), "source_position")

    def verify_text(position, printed, transcription):
        variant = review["verified_word_variants"].get(position)
        if variant:
            require(printed == variant["word"] and transcription == variant["transcription"], "numbered_choice_transcription")
        else:
            require(norm(printed) == norm(transcription), "numbered_choice_transcription")

    verify_text("introduction", preamble, native["preamble"])
    marked = []
    for index,(label,item) in enumerate(zip(labels,native["questions"],strict=True),1):
        require(not item["options"], "printed_choice_layout")
        verify_text(str(index), label, legacy.statement(item["stem"]))
        values = [a for group in item["answers"] for a in group if isinstance(a,str) and a.strip()]
        require(all(norm(v) in ("ˇ","✓","✔","√","v","V") for v in values), "printed_choice_mark")
        if values:
            marked.append(index)

    def key(value):
        labels = r"(?:\(([1-8])\)|([1-8]))[vVˇ✓✔√]?"
        normalized = norm(value)
        require(not re.sub(labels+r"|;", "",normalized), "numbered_choice_key")
        return [int(a or b) for a,b in re.findall(labels,normalized)]

    chosen = review["selected"]
    require(chosen and chosen == sorted(set(chosen)) and max(chosen) <= len(labels)
            and chosen == key(teacher_printed_answer(teacher,require)) == key(target["reference_answer"])
            == key(target["positions"][0]["reference_value"]) and (not marked or marked == chosen), "numbered_choice_key")
    prompt = re.sub(r"^[（(][\s_＿]*[）)]\s*", "", preamble).replace("？。", "？")
    question = output_question("checkbox" if len(chosen)>1 else "single_choice", plain(prompt),list(map(plain,labels)),
                               chosen,plain(target["student_explanation"]))
    return plain(""), [{"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages),"question":question}], {}


def reviewed_text_sequence(parent, targets, original, pages, legacy, review):
    require, norm, plain = legacy.require, legacy.normalize, legacy.plain
    preamble, entries = reviewed_text_entries(parent, original, legacy, review)
    require(len(targets) == 1 and 2 <= len(entries) <= 8, "sequence_source_structure")
    target = targets[0]
    ordinals = list(range(1,len(entries)+1))
    require(target["kind"] == "ordering" and target["source_question_indices"] == ordinals
            and len(target["positions"]) == len(entries), "sequence_source_position")
    ranks = []
    labels = []
    for i, ((item, label, printed), position) in enumerate(zip(entries,target["positions"],strict=True),1):
        publisher = [a for group in item["answers"] for a in group if isinstance(a,str) and a.strip()]
        require(not item["options"] and len(publisher) == 1 and re.search(rf"\({i}\)", norm(position["source_part_locator"])),
                "sequence_source_position")
        value = norm(printed).strip(";")
        require(re.fullmatch(r"[1-8]", value) and value == norm(publisher[0]) == norm(position["reference_value"])
                and norm(label) == norm(legacy.statement(item["stem"])), "sequence_answer_key")
        ranks.append(int(value))
        labels.append(label)
    expected = ";".join(f"({i}){rank}" for i,rank in enumerate(ranks,1))
    require(sorted(ranks) == ordinals and ranks == review["ranks"] and labels == review["options"]
            and expected == norm(target["reference_answer"]), "sequence_answer_key")
    sequence = [ordinal for ordinal,_ in sorted(enumerate(ranks,1),key=lambda entry:entry[1])]
    require(sequence == review["sequence"], "sequence_answer_key")
    question = {"type":"fields", "prompt":plain(preamble),
                "fields":[{"id":"sequence", "label":"依序排列操作步驟", "input":"sequence",
                           "options":[{"id":f"o{i}","content":plain(label)} for i,label in enumerate(labels,1)]}],
                "answer":{"format":"fields-v1","fields":{"sequence":[[f"o{i}" for i in sequence]]}},
                "explanation":plain(target["student_explanation"])}
    return plain(""), [{"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages),"question":question}], {}


def reviewed_image_source(parent, original, legacy, review):
    require = legacy.require
    asset = parent["question_only_asset"]
    snapshot = Path(asset["local_content"])
    word = Path(original["question_docx"])
    teacher = word.with_name("answer.docx.gz")
    require(legacy.digest(word) == original["question_docx_sha256"] == review["question_sha256"], "original_word_changed")
    require(legacy.digest(teacher) == review["teacher_sha256"], "teacher_word_changed")
    require(legacy.digest(snapshot) == asset["sha256"] == review["snapshot_sha256"], "word_snapshot_missing")
    parsed = legacy.read(snapshot)
    require(all(b["type"] == "paragraph" for b in parsed["layout"]), "reviewed_image_layout")
    assets = verify_assets(parsed, asset["images"], word, legacy)
    require(len(assets) == 1 and next(iter(assets.values()))["sha256"] == review["image_sha256"], "shared_image_changed")
    original_key = teacher_printed_answer(teacher, require)
    require(original_key == review["teacher_text"], "reviewed_teacher_key")
    return parsed, assets, original_key


def reviewed_image_single_choices(parent, targets, original, pages, legacy, docx, review):
    require, norm, plain = legacy.require, legacy.normalize, legacy.plain
    parsed, assets, original_key = reviewed_image_source(parent, original, legacy, review)
    require(len(targets) == review["reviewed_count"] and all(t["kind"] == "single_choice" and len(t["positions"]) == 1 for t in targets),
            "source_position")
    native = parent["original_source"]["native_content"]
    layout = review["verified_layout"]
    mode = layout["mode"]
    raw = native["questions"]
    require(len(raw) == review["native_count"] and all(not q["options"] for q in raw), "reviewed_image_layout")
    if mode == "printed_image_ordinals":
        keys = [original_key.strip()]
        require(len(targets) == len(raw) == 1 and norm(parsed["text"]) == norm(legacy.statement(raw[0]["stem"])), "word_prompt")
    else:
        parts = re.split(r"[（(]([１-８1-8])[）)]", original_key)
        require(not parts[0].strip() and [int(i) for i in parts[1::2]] == list(range(1,len(targets)+1)), "teacher_choice_position")
        keys = [k.strip().strip("；;") for k in parts[2::2]]
    if mode in ("text_circle_pair", "named_table_choices"):
        prefix = []
        for block in parsed["layout"]:
            line = "".join(r["text"] for r in block["runs"] if r["type"] == "text")
            if legacy.WORD_ORDINAL.fullmatch(line):
                break
            prefix.append(block)
        material = compact_layout(prefix, parsed["media"], docx)
        preamble, lines = legacy.numbered_lines(parsed["text"])
        require(len(lines) == len(raw) == len(targets) and norm(material["text"]) == norm(preamble)
                == norm(native["preamble"]).replace("⋯⋯", "......"),
                "source_preamble")
    else:
        require(mode in ("printed_image_pairs", "printed_image_ordinals") and len(raw) == 1
                and norm(parsed["text"]) == norm(legacy.statement(raw[0]["stem"])), "word_prompt")
        material = compact_layout(parsed["layout"], parsed["media"], docx)
        lines = [f"請選出第 {i} 組的正確風向。" for i in range(1,len(targets)+1)] if mode == "printed_image_pairs" else [parsed["text"]]
    require(len(material["media"]) == 1, "shared_image_changed")

    questions = []
    for i, (target, line, key) in enumerate(zip(targets,lines,keys,strict=True),1):
        position = target["positions"][0]
        require(norm(position["reference_value"]) == norm(target["reference_answer"]) == norm(key), "review_choice_position")
        expected_index = 1 if mode.startswith("printed_image_") else i
        require(target["source_question_indices"] == [expected_index], "source_position")
        if mode == "printed_image_pairs":
            require(re.match(rf"^第\({i}\)小題", norm(position["source_part_locator"])), "source_position")
        elif mode in ("text_circle_pair", "named_table_choices", "printed_image_ordinals"):
            raw_keys = [a for group in raw[expected_index-1]["answers"] for a in group if a.strip()]
            require(len(raw_keys) == 1 and norm(raw_keys[0]) == norm(key), "review_choice_key")
        if mode == "text_circle_pair":
            prompt, options, selected = legacy.circle_pair(line, raw[i-1]["stem"], key, target["reference_answer"])
            reviewed = review["circle_pair_reviews"][i-1]
            require(reviewed == {"ordinal":i,"prompt":prompt,"options":options,"answer_index":int(selected)}, "word_choice_alignment")
            selected = int(selected)
        else:
            options = list(layout["options"][i-1])
            require(len(options) in (2,3,4) and len(set(options)) == len(options) and key in options
                    and key == layout["selected"][i-1], "word_choice_alignment")
            prompt = legacy.statement(line)
            if mode == "named_table_choices":
                require(norm(prompt) == norm(legacy.statement(raw[i-1]["stem"])), "word_prompt")
            selected = options.index(key)+1
        q = output_question("single_choice", plain(prompt),list(map(plain,options)),[selected],plain(target["student_explanation"]))
        questions.append({"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages),"question":q})
    return material, questions, assets


def reviewed_diagram_choices(parent, targets, original, pages, legacy, docx, review):
    require, norm, plain = legacy.require, legacy.normalize, legacy.plain
    parsed, assets, teacher = reviewed_image_source(parent, original, legacy, review)
    native = parent["original_source"]["native_content"]
    raw = native["questions"]
    layout = review["verified_layout"]
    mode, selected = layout["mode"], layout["selected"]
    require(len(raw) == review["native_count"] and len(targets) == len(selected) == review["reviewed_count"], "source_position")

    def split_key(text):
        return re.split(r"[;、]", norm(text).strip(";、"))

    if mode == "inline_image_choices":
        require(len(raw) == len(targets) == 1, "source_position")
        prompt,*labels = docx.split_options(parsed)
        require(len(prompt["media"]) == 1 and len(labels) == 4 and not any(option["media"] for option in labels)
                and norm(prompt["text"]) == norm(legacy.statement(raw[0]["stem"]))
                and [norm(v["text"]) for v in labels] == list(map(norm,raw[0]["options"])) == list(map(norm,layout["options"])),
                "word_choice_alignment")
        material, prompts, option_sets = plain(""), [prompt], [labels]
        keys = [split_key(teacher)]
    elif mode == "picture_code":
        prefix = []
        for block in parsed["layout"]:
            line = "".join(r["text"] for r in block["runs"] if r["type"] == "text")
            if legacy.WORD_ORDINAL.fullmatch(line):
                break
            prefix.append(block)
        material = compact_layout(prefix,parsed["media"],docx)
        preamble, lines = legacy.numbered_lines(parsed["text"])
        require(len(raw) == len(lines) == len(targets) and len(material["media"]) == 1
                and norm(material["text"]) == norm(preamble) == norm(native["preamble"]), "source_preamble")
        require(layout["options"] in [list("ㄅㄆㄇ"),list("ABCD")], "classification_domain")
        prompts = []
        for line,item in zip(lines,raw,strict=True):
            require(not item["options"] and norm(legacy.statement(line)) == norm(legacy.statement(item["stem"])), "word_prompt")
            label = re.sub(r"[（(][\s_＿]*[）)]", "",line).rstrip("：:、 ")
            require(label, "word_prompt")
            prompts.append(plain(label))
        option_sets = [list(map(plain,layout["options"])) for _ in targets]
        parts = re.split(r"[（(]([１-８1-8])[）)]", teacher)
        require(not parts[0].strip() and [int(i) for i in parts[1::2]] == list(range(1,len(targets)+1)), "teacher_choice_position")
        keys = [split_key(k) for k in parts[2::2]]
    else:
        original_stem = re.sub(r"(?:【[\s_＿]*】\s*)+$", "", raw[0]["stem"])
        require(mode == "picture_directions" and len(raw) == 1 and len(targets) == 2 and not raw[0]["options"]
                and norm(parsed["text"]) == norm(legacy.statement(original_stem)), "word_prompt")
        material = compact_layout(parsed["layout"],parsed["media"],docx)
        require(len(material["media"]) == 1, "shared_image_changed")
        prompts = [plain(f"圖 {i} 的風從哪個方向吹來？") for i in (1,2)]
        option_sets = [list(map(plain,labels)) for labels in layout["options"]]

        def positioned_directions(text):
            pieces = re.findall(r"[（(]([１２1-2])[）)]\s*([^；;]+)|([①②])\s*([^；;]+)",text.strip())
            labels = [int(a or norm(c)) for a,_,c,_ in pieces]
            require(labels == [1,2], "teacher_choice_position")
            return [[norm(b or d).removesuffix("ˇ")] for _,b,_,d in pieces]

        keys = positioned_directions(teacher)
        publisher = "；".join(a for g in raw[0]["answers"] for a in g if a.strip())
        require(positioned_directions(publisher) == keys, "review_choice_key")

    require(keys == selected, "reviewed_teacher_key")
    questions = []
    for i,(target,prompt,labels,chosen) in enumerate(zip(targets,prompts,option_sets,keys,strict=True),1):
        position_index = 1 if mode == "picture_directions" else i
        require(target["kind"] in ("matching","multiple_choice","single_choice")
                and target["source_question_indices"] == [position_index], "source_position")
        fixed = split_key(target["reference_answer"])
        positions = [v for pos in target["positions"] for v in split_key(pos["reference_value"])]
        if mode == "picture_directions":
            require(len(positions) == 1 and all(re.match(rf"^第(?:\({i}\)|{i})小題",norm(p["source_part_locator"])) for p in target["positions"]),
                    "source_position")
            fixed = [re.sub(rf"^{i}(?=\D)","",v) for v in fixed]
            positions = [re.sub(rf"^{i}(?=\D)","",v) for v in positions]
        else:
            answers = [a for group in raw[i-1]["answers"] for a in group if a.strip()]
            require(split_key("；".join(answers)) == chosen, "review_choice_key")
        require(fixed == positions == chosen, "review_choice_position")
        values = [str(j) for j in range(1,len(labels)+1)] if mode == "inline_image_choices" else [label["text"] for label in labels]
        require(len(values) == len(set(values)) and chosen and chosen == [v for v in values if v in chosen], "word_choice_alignment")
        qtype = "checkbox" if len(chosen)>1 else "single_choice"
        q = output_question(qtype,prompt,labels,[values.index(k)+1 for k in chosen],plain(target["student_explanation"]))
        questions.append({"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages),"question":q})
    return material,questions,assets


def reviewed_figure_answers(parent, targets, original, pages, legacy, docx, review):
    require, norm, plain = legacy.require, legacy.normalize, legacy.plain
    parsed, assets, teacher = reviewed_image_source(parent, original, legacy, review)
    native = parent["original_source"]["native_content"]
    raw = native["questions"]
    require(all(not item["options"] for item in raw), "figure_answer_layout")

    def printed_prompt(text):
        text = re.sub(r"(?:【[\s_＿]*】\s*)+$", "", text)
        return legacy.statement(re.sub(r"\s*答[：:]\s*$", "", text).strip())

    if review["mode"] == "figure_sequence":
        require(len(targets) == len(raw) == 1 and not native.get("preamble"), "sequence_source_structure")
        target = targets[0]
        labels, ranks = review["ordinals"], review["ranks"]
        require(target["kind"] == "ordering" and target["source_question_indices"] == [1]
                and labels in [list("①②③"),list("①②③④")] and sorted(ranks) == list(range(1,len(labels)+1)), "sequence_source_position")
        expected = [f"{label}{rank}" for label,rank in zip(labels,ranks,strict=True)]
        publisher = [v for group in raw[0]["answers"] for v in group if v.strip()]
        require([norm(v) for v in expected] == [norm(v) for v in re.split(r"[；;]",teacher)]
                == list(map(norm,publisher)) == [norm(v) for v in re.split(r"[；;]",target["reference_answer"])]
                and [norm(pos["reference_value"]) for pos in target["positions"]] == list(map(str,ranks)), "sequence_answer_key")
        sequence = [i for i,_ in sorted(enumerate(ranks,1),key=lambda x:x[1])]
        require([labels[i-1] for i in sequence] == review["sequence"]
                and norm(parsed["text"]) == norm(printed_prompt(raw[0]["stem"])), "word_prompt")
        prompt = compact_layout(parsed["layout"],parsed["media"],docx)
        question = {"type":"fields", "prompt":prompt,
                    "fields":[{"id":"sequence", "label":"依風力排列圖號", "input":"sequence",
                               "options":[{"id":f"o{i}","content":plain(v)} for i,v in enumerate(labels,1)]}],
                    "answer":{"format":"fields-v1","fields":{"sequence":[[f"o{i}" for i in sequence]]}},
                    "explanation":plain(target["student_explanation"])}
        return plain(""), [{"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages),"question":question}],assets

    require(review["mode"] == "figure_finite_answer" and len(targets) == len(raw) == len(review["keys"]), "figure_answer_layout")
    common = []
    started = False
    for block in parsed["layout"]:
        line = "".join(r.get("text","") for r in block["runs"])
        started = started or bool(legacy.WORD_ORDINAL.fullmatch(line))
        if not started or any(r["type"] == "image" for r in block["runs"]):
            require(not started or all(r["type"] == "image" for r in block["runs"]), "figure_answer_layout")
            common.append(block)
    material = compact_layout(common,parsed["media"],docx)
    preamble, lines = legacy.numbered_lines(parsed["text"])
    require(len(material["media"]) == 1 and len(lines) == len(raw)
            and norm(material["text"]) == norm(preamble) == norm(native["preamble"]), "source_preamble")
    teacher_parts = re.split(r"[（(]([１-８1-8])[）)]", teacher)
    require(not teacher_parts[0].strip() and [int(i) for i in teacher_parts[1::2]] == list(range(1,len(raw)+1)), "teacher_choice_position")
    keys = [part.strip().strip("；;") for part in teacher_parts[2::2]]
    require(keys == review["keys"], "reviewed_teacher_key")
    questions = []
    for i,(item,target,line,key,accepted) in enumerate(zip(raw,targets,lines,keys,review["accepted"],strict=True),1):
        publisher = [a for group in item["answers"] for a in group if a.strip()]
        require(target["kind"] == "short_answer" and target["source_question_indices"] == [i]
                and len(target["positions"]) == len(publisher) == 1 and key == accepted[0]
                and norm(key) == norm(publisher[0]) == norm(target["reference_answer"]) == norm(target["positions"][0]["reference_value"]),
                "review_choice_position")
        prompt = printed_prompt(line)
        require(prompt and norm(prompt) == norm(printed_prompt(item["stem"])), "word_prompt")
        question = {"type":"fields", "prompt":plain(prompt), "fields":[{"id":"answer", "label":"答案", "input":"text"}],
                    "answer":{"format":"fields-v1","fields":{"answer":accepted}}, "explanation":plain(target["student_explanation"])}
        questions.append({"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages),"question":question})
    return material,questions,assets


def reviewed_native_table_choices(parent, targets, original, pages, legacy, docx, review):
    require, norm, plain = legacy.require, legacy.normalize, legacy.plain
    asset = parent["question_only_asset"]
    snapshot = Path(asset["local_content"])
    word = Path(original["question_docx"])
    teacher = word.with_name("answer.docx.gz")
    require(legacy.digest(word) == original["question_docx_sha256"] == review["question_sha256"], "original_word_changed")
    require(legacy.digest(teacher) == review["teacher_sha256"], "teacher_word_changed")
    require(legacy.digest(snapshot) == asset["sha256"] == review["snapshot_sha256"], "word_snapshot_missing")
    parsed = legacy.read(snapshot)
    blocks = parsed["layout"]
    require(not parsed["media"] and len(blocks) > 2 and [b["type"] for b in blocks[:2]] == ["paragraph","table"]
            and all(b["type"] == "paragraph" for b in blocks[2:]), "native_table_layout")
    plain_cells = [["".join(run["text"] for run in cell) for cell in row] for row in blocks[1]["rows"]]
    require(plain_cells == review["cells"], "native_table_cells")
    material = compact_layout(blocks[:2],[],docx)
    native = parent["original_source"]["native_content"]
    preamble, lines = legacy.numbered_lines(parsed["text"])
    require(norm(material["text"]) == norm(preamble) == norm(native["preamble"]) and len(lines) == len(targets)
            == len(native["questions"]) == len(review["items"]), "source_preamble")
    parts = re.split(r"[（(]([１-８1-8])[）)]", teacher_printed_answer(teacher,require))
    require(not parts[0].strip() and [int(i) for i in parts[1::2]] == list(range(1,len(lines)+1)), "teacher_choice_position")
    questions = []
    for i,(item,target,line,expected,printed) in enumerate(zip(native["questions"],targets,lines,review["items"],parts[2::2],strict=True),1):
        require(target["kind"] == "single_choice" and target["source_question_indices"] == [i] and len(target["positions"]) == 1
                and expected["ordinal"] == i, "source_position")
        value = norm(printed).strip(";").removesuffix("ˇ")
        publisher = [a for group in item["answers"] for a in group if a.strip()]
        require(len(publisher) == 1 and value == norm(publisher[0]) == norm(target["reference_answer"])
                == norm(target["positions"][0]["reference_value"]) == str(expected["option_index"]), "review_choice_position")
        stem,*options = docx.split_options({"layout":[{"type":"paragraph","runs":[{"type":"text","text":line}]}],"media":[]})
        labels = [legacy.statement(v["text"]) for v in options]
        require(norm(stem["text"]) == norm(legacy.statement(item["stem"]))
                and list(map(norm,labels)) == list(map(norm,map(legacy.statement,item["options"])))
                == list(map(norm,map(legacy.statement,expected["options"]))) and 1 <= int(value) <= len(labels), "word_choice_alignment")
        q = output_question("single_choice",plain(stem["text"]),list(map(plain,labels)),[int(value)],plain(target["student_explanation"]))
        questions.append({"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages),"question":q})
    return material,questions,{}


def reviewed_image_layout_source(parent, original, legacy, review):
    require = legacy.require
    asset = parent["question_only_asset"]
    snapshot = Path(asset["local_content"])
    word = Path(original["question_docx"])
    teacher = word.with_name("answer.docx.gz")
    require(legacy.digest(word) == original["question_docx_sha256"] == review["word_sha256"], "original_word_changed")
    require(legacy.digest(teacher) == review["teacher_sha256"], "teacher_word_changed")
    require(legacy.digest(snapshot) == asset["sha256"] == review["snapshot_sha256"], "word_snapshot_missing")
    parsed = legacy.read(snapshot)
    assets = verify_assets(parsed, asset["images"], word, legacy)
    require([a["sha256"] for a in assets.values()] == review["media"], "original_media_sha")
    key = teacher_printed_answer(teacher, require)
    require(key == review["teacher_key"], "reviewed_teacher_key")
    return parsed, assets, key


def reviewed_mixed_image_choices(parent, targets, original, pages, legacy, docx, review):
    require, norm, plain = legacy.require, legacy.normalize, legacy.plain
    parsed, assets, key = reviewed_image_layout_source(parent, original, legacy, review)
    media = parsed["media"]
    blocks = parsed["layout"]
    layout = review["verified_layout"]
    mode, selected = layout["mode"], layout["selected"]
    native = parent["original_source"]["native_content"]
    items = native["questions"]
    ordinal = r"[（(]([１-８1-8])[）)]"
    numbered_key = re.split(ordinal, key)
    require(not numbered_key[0].strip() and [int(v) for v in numbered_key[1::2]] == list(range(1,len(targets)+1)), "teacher_choice_position")

    def answer(value, index):
        value = re.sub(rf"^\({index}\)", "", norm(value).strip(";、"))
        return [v.rstrip("ˇvV") for v in re.split(r"[;、]",value)]

    def paragraph(block):
        return "".join(run["text"] for run in block["runs"] if run["type"] == "text")

    def image_sha(content):
        return [assets[item["url"]]["sha256"] for item in content["media"]]

    expected_media = review["media"]
    if mode == "each_item_image":
        require(len(items) == 1 and len(blocks) == len(targets)+1 and not items[0]["options"], "mixed_image_layout")
        material = compact_layout(blocks[:1],media,docx)
        stem = re.sub(r"(?:【[\s_＿]*】\s*)+$", "", items[0]["stem"])
        require(not material["media"] and norm(material["text"]) == norm(stem), "word_prompt")
        prompts = []
        for i,(block,h) in enumerate(zip(blocks[1:],expected_media,strict=True),1):
            image = compact_layout([block],media,docx)
            require(not image["text"].strip() and image_sha(image) == [h], "mixed_image_placement")
            heading = {"type":"paragraph","runs":[{"type":"text","text":f"第 {i} 小題"}]}
            prompts.append(compact_layout([heading,block],media,docx))
        label_sets = layout["image_options"]
        require(all(labels in [list("ㄅㄆ"),list("ㄅㄆㄇ")] for labels in label_sets), "word_choice_alignment")
        values = label_sets
        publisher = [v for group in items[0]["answers"] for text in group for v in re.split(r"[；;]",text) if v.strip()]
        publisher_keys = [answer(v,i) for i,v in enumerate(publisher,1)]
    else:
        require(mode in {"shared_image_numbered","shared_image_symbol","one_inline_layout"} and len(items) == len(targets), "mixed_image_layout")
        starts = [(i,m) for i,b in enumerate(blocks) if b["type"] == "paragraph" and (m := re.match(ordinal,paragraph(b)))]
        require([int(m.group(1)) for _,m in starts] == list(range(1,len(targets)+1)), "word_question_position")
        material = compact_layout(blocks[:starts[0][0]],media,docx)
        require(norm(material["text"]) == norm(native["preamble"]), "source_preamble")
        require(image_sha(material) == (expected_media if mode.startswith("shared_image_") else []), "mixed_image_placement")
        prompts, label_sets, values, publisher_keys = [], [], [], []
        ends = [i for i,_ in starts[1:]]+[len(blocks)]
        for i,((start,match),end,item) in enumerate(zip(starts,ends,items,strict=True),1):
            stem = paragraph(blocks[start])[match.end():].strip()
            tail = blocks[start+1:end]
            raw = item["stem"]
            if mode == "one_inline_layout" and i == 1:
                require(len(tail) == 1 and tail[0]["type"] == "table", "mixed_image_layout")
                prompt = compact_layout([{"type":"paragraph","runs":[{"type":"text","text":stem}]},*tail],media,docx)
                require(image_sha(prompt) == expected_media and norm(prompt["text"]) == norm(raw), "mixed_image_placement")
                labels = layout["image_options"]
                require(labels in [list("①②"),list("甲乙")], "word_choice_alignment")
                cell_labels = re.findall(r"([①②])([甲乙]?)[（(][\s_＿]*[）)]",prompt["text"])
                require([symbol or number for number,symbol in cell_labels] == labels, "word_choice_alignment")
                codes = ["1","2"]
            elif mode == "shared_image_symbol":
                require(len(tail) == 1 and tail[0]["type"] == "paragraph" and not item["options"], "word_choice_alignment")
                line = paragraph(tail[0]).strip()
                require(line.startswith("□") and norm(stem+line) == norm(re.sub(r"【[\s_＿]*】\s*$","",raw).replace("☐","□")), "word_prompt")
                labels = [v.strip() for v in line.split("□")[1:]]
                codes = list(map(norm,labels))
                prompt = plain(stem)
            else:
                require(tail and all(b["type"] == "paragraph" for b in tail), "word_choice_alignment")
                options = [re.fullmatch(r"[（(][\s_＿]*[）)]\s*([①-⑧])\s*(.+)", paragraph(b)) for b in tail]
                require(all(options) and norm(stem) == norm(re.sub(r"[（(][\s_＿]*[）)]\s*$","",raw)), "word_prompt")
                labels = [m.group(2) for m in options]
                codes = [norm(m.group(1)) for m in options]
                require(codes == [str(j) for j in range(1,len(labels)+1)] and list(map(norm,labels)) == list(map(norm,item["options"])), "word_choice_alignment")
                prompt = plain(stem)
            prompts.append(prompt)
            label_sets.append(labels)
            values.append(codes)
            publisher_keys.append([v for group in item["answers"] for text in group for v in answer(text,i)])

    require(publisher_keys == selected and [answer(v,i) for i,v in enumerate(numbered_key[2::2],1)] == selected, "reviewed_teacher_key")
    questions = []
    for i,(target,prompt,labels,codes,chosen,bound) in enumerate(zip(targets,prompts,label_sets,values,selected,review["targets"],strict=True),1):
        require(target["source_question_indices"] == bound["source_indices"] == [1 if mode == "each_item_image" else i]
                and target["positions"] == bound["positions"] and target["reference_answer"] == bound["answer"], "source_position")
        require(chosen == answer(bound["answer"],i) == [v for p in bound["positions"] for v in answer(p["reference_value"],i)], "review_choice_position")
        require(len(codes) >= 2 and len(codes) == len(set(codes)) and chosen and chosen == [v for v in codes if v in chosen], "word_choice_alignment")
        kind = "checkbox" if len(chosen)>1 else "single_choice"
        question = output_question(kind,prompt,list(map(plain,labels)),[codes.index(v)+1 for v in chosen],plain(target["student_explanation"]))
        questions.append({"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages),"question":question})
    return material,questions,assets


def reviewed_wind_strength(parent, targets, original, pages, legacy, docx, review):
    require, norm, plain = legacy.require, legacy.normalize, legacy.plain
    parsed, assets, key = reviewed_image_layout_source(parent, original, legacy, review)
    media, blocks = parsed["media"], parsed["layout"]
    native = parent["original_source"]["native_content"]
    require(native == review["original"], "word_snapshot_changed")
    target_keys = ("target_id", "kind", "source_question_indices", "reference_answer", "positions")
    require([{k:t[k] for k in target_keys} for t in targets] == review["targets"], "source_position")
    mode = review["verified_layout"]["mode"]
    expected = review["verified_layout"]["answer_by_position"]
    numbers = "①②③"
    bank = ["無風", "弱風", "強風"]

    def glyphs(text):
        return norm(text).replace("◯","○")

    def unnumber(text, index):
        return re.sub(rf"^(?:\({index}\)|{index}(?=[無弱強]))", "", glyphs(text))

    def printed_ordinal(text, index):
        return bool(re.search(rf"\({index}\)|{index}(?=(?:號|小題|下方))",glyphs(text)))

    def paragraph_text(block):
        return "".join(run["text"] for run in block["runs"] if run["type"] == "text")

    material = compact_layout(blocks[:1],media,docx)
    body = native["questions"]
    raw_publisher = [token for item in body for group in item["answers"] for text in group for token in re.split(r"[;；]",text) if token.strip()]
    teacher = glyphs(key).split(";")
    if mode == "strongest_and_weakest" or (mode == "one_image_per_classification" and blocks[1]["type"] == "table"):
        require(len(blocks)==2 and blocks[1]["type"]=="table", "wind_image_layout")
        row_labels, row_images, row_blanks = blocks[1]["rows"]
        require([cell[0]["text"] for cell in row_labels] == list(numbers) and all(len(cell)==1 for cell in row_labels), "wind_image_position")
        require([cell[0]["media_index"] for cell in row_images] == list(range(3)) and all(len(cell)==1 for cell in row_images), "wind_image_position")
        require(len(row_blanks)==3 and all(len(cell)==1 and norm(cell[0]["text"])=="()" for cell in row_blanks), "wind_image_layout")
        if mode == "strongest_and_weakest":
            target, = targets
            positions = target["positions"]
            keys = []
            for part in positions:
                ordinal = re.match(r"^([1-3])號",glyphs(part["source_part_locator"]))
                require(ordinal is not None, "source_position")
                keys.append(ordinal.group(1)+glyphs(part["reference_value"]))
            require(keys == teacher == list(map(glyphs,raw_publisher)) == glyphs(target["reference_answer"]).split(";") == expected, "reviewed_teacher_key")
            meaning = {"ˇ":"風力最強", "○":"風力最弱"}
            require({v[1:] for v in keys} == set(meaning) and len({v[0] for v in keys})==2, "wind_mark_positions")
            fields, answers = [], {}
            choices = [{"id":f"o{i}","content":plain(symbol)} for i,symbol in enumerate(numbers,1)]
            for index,symbol in enumerate(("ˇ","○"),1):
                field_id = f"f{index}"
                fields.append({"id":field_id,"label":meaning[symbol],"input":"single","options":choices})
                answers[field_id] = ["o" + next(v[0] for v in keys if v[1:]==symbol)]
            table = {**blocks[1],"rows":[row_labels,row_images]}
            material = compact_layout([blocks[0],table],media,docx)
            question = {"type":"fields","prompt":plain("哪一盆的風力最強？哪一盆的風力最弱？"),"fields":fields,
                        "answer":{"format":"fields-v1","fields":answers},"explanation":plain(target["student_explanation"])}
            return material,[{"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages),"question":question}],assets
        pictures = [{"type":"paragraph","runs":cell} for cell in row_images]
    elif mode == "one_numbered_image_for_classification":
        require(len(blocks)==3 and norm(paragraph_text(blocks[1]))=="".join(bank) and len(media)==1, "wind_image_layout")
        material = compact_layout([blocks[0],blocks[2]],media,docx)
        require(len(material["media"])==1, "wind_image_position")
        pictures = [None]*3
    else:
        require(mode in {"one_image_per_classification","one_image_per_choice"} and len(blocks)==4 and len(media)==3, "wind_image_layout")
        pictures = []
        for i,block in enumerate(blocks[1:],1):
            require(block["type"]=="paragraph", "wind_image_layout")
            expected_text = f"()({i})" if mode=="one_image_per_classification" else ""
            images = [run for run in block["runs"] if run["type"]=="image"]
            require(norm(paragraph_text(block))==expected_text and len(images)==1 and images[0]["media_index"]==i-1, "wind_image_position")
            pictures.append({"type":"paragraph","runs":images})

    options = list("ㄅㄆ") if mode=="one_image_per_choice" else bank
    require(len(targets)==len(teacher)==len(raw_publisher)==len(expected)==3, "source_position")
    require([unnumber(v,i) for i,v in enumerate(teacher,1)] == [unnumber(v,i) for i,v in enumerate(raw_publisher,1)] == expected, "reviewed_teacher_key")
    questions = []
    for i,(target,picture,value) in enumerate(zip(targets,pictures,expected,strict=True),1):
        position, = target["positions"]
        require(printed_ordinal(position["source_part_locator"],i) and value==unnumber(target["reference_answer"],i)==unnumber(position["reference_value"],i), "review_choice_position")
        choice = value.removesuffix("ˇ")
        require(choice in options, "wind_classification_value")
        title = f"第 {i} 小題" if mode=="one_image_per_choice" else f"圖{numbers[i-1]}的風力屬於哪一種？"
        intro = {"type":"paragraph","runs":[{"type":"text","text":title}]}
        prompt = compact_layout([intro,picture],media,docx) if picture else plain(title)
        require(len(prompt["media"])==int(picture is not None), "wind_image_position")
        question = output_question("single_choice",prompt,list(map(plain,options)),[options.index(choice)+1],plain(target["student_explanation"]))
        questions.append({"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages),"question":question})
    return material,questions,assets


def reviewed_solubility_results(parent, targets, original, pages, legacy, docx, review):
    require, norm, plain = legacy.require, legacy.normalize, legacy.plain
    parsed, assets, key = reviewed_image_layout_source(parent, original, legacy, review)
    media, blocks = parsed["media"], parsed["layout"]
    native = parent["original_source"]["native_content"]
    require(native == review["native"], "word_snapshot_changed")
    raw_items = native["questions"]
    layout = review["verified_layout"]
    mode = layout["mode"]
    keys = layout["keys"]
    ordinal = r"[（(]([１-８1-8])[）)]"
    blank = r"[（(][\s_＿]+[）)]"

    def paragraph_text(block):
        return "".join(run["text"] for run in block["runs"] if run["type"]=="text")

    def answer(text):
        return re.sub(r"[ˇ✓√](?=;|$)","",norm(text)).strip(";")

    segments = re.split(ordinal,key)
    require(not segments[0].strip() and [int(v) for v in segments[1::2]]==list(range(1,len(targets)+1)), "teacher_choice_position")
    require([answer(v) for v in segments[2::2]]==keys, "reviewed_teacher_key")
    starts = [(i,m) for i,b in enumerate(blocks) if b["type"]=="paragraph" and (m:=re.match(ordinal,paragraph_text(b)))]
    require([int(m.group(1)) for _,m in starts]==list(range(1,len(targets)+1)), "word_question_position")
    material = compact_layout(blocks[:starts[0][0]],media,docx)
    require(norm(material["text"])==norm(native["preamble"]), "source_preamble")
    common_count = {"shared_result_image":1,"shared_native_tally_table":2,"image_choices_per_question":0}
    require(len(material["media"])==common_count[mode], "mixed_image_placement")
    if mode=="shared_native_tally_table":
        require([b["type"] for b in material["layout"]]==["paragraph","table"], "native_table_layout")
        rows = material["layout"][1]["rows"]
        require(len(rows)==3 and all(len(row)==2 for row in rows)
                and [rows[i][0][0]["text"] for i in (1,2)]==["食鹽","砂糖"]
                and [rows[i][1][0]["media_index"] for i in (1,2)]==[0,1], "native_table_cells")

    questions = []
    ends = [i for i,_ in starts[1:]]+[len(blocks)]
    for i,(target,raw,(start,match),end,expected,bound) in enumerate(zip(targets,raw_items,starts,ends,keys,review["targets"],strict=True),1):
        require(target["source_question_indices"]==bound["source_question_indices"]==[i]
                and target["kind"]==bound["kind"] and target["positions"]==bound["position"]
                and target["reference_answer"]==bound["key"], "source_position")
        publisher = ";".join(v for group in raw["answers"] for v in group if v.strip())
        require(answer(publisher)==answer(bound["key"])==answer(";".join(p["reference_value"] for p in bound["position"]))==expected,
                "reviewed_teacher_key")
        refs = legacy.refs_for(target,original["unit"],pages)
        require(refs==bound["printed_pages"], "original_textbook_mismatch")
        stem = paragraph_text(blocks[start])[match.end():].strip()
        tail = blocks[start+1:end]
        require(all(b["type"]=="paragraph" for b in tail), "word_choice_alignment")
        suffix = r"(?:【[\s_＿]*】\s*|[（(][\s_＿]*[）)]\s*)+$"
        native_stem = re.sub(suffix,"",raw["stem"])
        tail_text = " ".join(map(paragraph_text,tail)).rstrip()
        rendered_text = stem if raw["options"] else stem+tail_text
        require(norm(rendered_text)==norm(native_stem), "word_prompt")
        explanation = plain(target["student_explanation"])
        if target["kind"]=="fill_in_the_blank":
            values = expected.split(";")
            require(not tail and len(re.findall(blank,stem))==len(values)==len(target["positions"])
                    and all(re.fullmatch(r"\d+",v) for v in values), "solubility_numeric_positions")
            labels = ["平匙數"] if len(values)==1 else ["食鹽（平匙）","砂糖（平匙）"]
            require(len(labels)==len(values) and (len(values)==1 or stem.index("食鹽")<stem.index("砂糖")), "solubility_numeric_positions")
            fields = [{"id":f"n{index}","label":label,"input":"math"} for index,label in enumerate(labels,1)]
            prompt = plain(re.sub(blank,"幾",stem))
            question = {"type":"fields","prompt":prompt,"fields":fields,"explanation":explanation,
                        "answer":{"format":"fields-v1","fields":{f["id"]:[v] for f,v in zip(fields,values,strict=True)}}}
        else:
            question_layout = compact_layout(tail,media,docx)
            if question_layout["media"]:
                require(mode=="image_choices_per_question" and len(tail)==len(question_layout["media"])==1 and not tail_text
                        and tail[0]["runs"][0]["media_index"]==i-1, "mixed_image_placement")
                codes, labels = ["1","2"],["甲","乙"]
                prompt = compact_layout([{"type":"paragraph","runs":[{"type":"text","text":stem}]},*tail],media,docx)
            else:
                marked = [re.fullmatch(blank+r"\s*([A-Dㄅㄆㄇㄈ①②])\s*(.+)",paragraph_text(b)) for b in tail]
                if marked and all(marked):
                    codes = [norm(m.group(1)) for m in marked]
                    labels = [m.group(2) for m in marked]
                    if raw["options"]:
                        require(list(map(norm,labels))==list(map(norm,raw["options"])), "word_choice_alignment")
                else:
                    pair = re.fullmatch(r"[（(]\s*([^，,）)]+?)\s*[，,]\s*([^，,）)]+?)\s*[）)]",tail_text)
                    require(pair is not None and len(tail)==1 and not raw["options"], "word_choice_alignment")
                    labels = list(pair.groups())
                    codes = list(map(norm,labels))
                prompt = plain(stem)
            chosen = expected.split(";")
            require(len(codes)==len(set(codes))>=2 and chosen==[v for v in codes if v in chosen], "word_choice_alignment")
            kind = "checkbox" if len(chosen)>1 else "single_choice"
            question = output_question(kind,prompt,list(map(plain,labels)),[codes.index(v)+1 for v in chosen],explanation)
        questions.append({"target":target["target_id"],"refs":refs,"question":question})
    return material,questions,assets


def reviewed_merged_image_choices(parent, targets, original, pages, legacy, docx, review):
    require, norm, plain = legacy.require, legacy.normalize, legacy.plain
    word = Path(original["question_docx"])
    teacher = word.with_name("answer.docx.gz")
    evidence = Path(review["word_layout"])
    require(legacy.digest(evidence)==review["layout_sha256"], "word_snapshot_changed")
    recovered = legacy.read(evidence)
    require(legacy.digest(word)==original["question_docx_sha256"]==recovered["word_sha256"]==review["word_sha256"], "original_word_changed")
    require(legacy.digest(teacher)==recovered["teacher_sha256"]==review["teacher_sha256"], "teacher_word_changed")
    key = teacher_printed_answer(teacher,require)
    require(key==review["teacher_key"], "reviewed_teacher_key")
    material, table = recovered["blocks"]
    require(material["type"]=="paragraph" and table["type"]=="word-table", "merged_choice_layout")
    require(all(run["type"]=="text" for run in material["runs"]), "merged_choice_layout")
    stem = "".join(run["text"] for run in material["runs"])
    media = recovered["media"]
    records = review["image_records"]
    require(len(media)==len(records), "original_media_sha")
    checked_media = []
    for item,record in zip(media,records,strict=True):
        require(Path(item["url"]).name==Path(record["path"]).name and record["sha256"]==record["original_sha256"], "original_media_sha")
        checked_media.append({**item,"url":record["path"]})
    assets = verify_assets({"media":checked_media},records,word,legacy)

    # Each printed option is paired with the illustration in the same column below it.
    labels, pictures, pending, image_rows = [], [], {}, []
    for row in table["rows"]:
        col = 0
        row_choices = []
        for cell in row:
            runs = [r for paragraph in cell["paragraphs"] for r in paragraph]
            line = "".join(r["text"] for r in runs if r["type"]=="text")
            images = [r for r in runs if r["type"]=="image"]
            if line:
                marked = re.fullmatch(r"([①-⑧])\s*(.*)",line,re.S)
                require(marked is not None and col not in pending and cell["merge"]!="continue", "merged_choice_order")
                label = marked.group(2)
                if images:
                    glyph = review.get("inline_glyph")
                    require(glyph and label==glyph["prefix"] and len(images)==1 and
                            records[images[0]["media_index"]]["sha256"]==glyph["sha256"], "merged_choice_inline_glyph")
                    label += glyph["text"]
                pending[col] = (norm(marked.group(1)),label)
            elif images:
                require(col in pending and len(runs)==len(images)==1, "merged_choice_image_position")
                number, label = pending.pop(col)
                require(number==str(len(labels)+1), "merged_choice_order")
                labels.append(label)
                pictures.append(images[0])
                row_choices.append((number,label,images[0]))
            col += cell["span"]
        require(col==table["columns"], "merged_choice_layout")
        if row_choices:
            image_rows.append(row_choices)
    require(not pending and len(labels)==len(pictures) and 2<=len(labels)<=8, "merged_choice_order")
    require(labels==review["labels"] and [r["media_index"] for r in pictures]==review["image_order"], "merged_choice_image_position")
    assets = {checked_media[r["media_index"]]["url"]:assets[checked_media[r["media_index"]]["url"]] for r in pictures}
    native, = parent["original_source"]["native_content"]["questions"]
    require(not native["options"] or list(map(norm,native["options"]))==list(map(norm,labels)), "word_choice_alignment")
    native_body = re.sub(r"(?:【[\s_＿]*】\s*)+$", "",native["stem"])
    printed = stem+"".join(chr(0x2460+i)+label for i,label in enumerate(labels))
    if glyph := review.get("inline_glyph"):
        printed = printed.replace(glyph["prefix"]+glyph["text"],glyph["prefix"])
    require(norm(printed)==norm(native_body), "word_prompt")

    def positions(text):
        return [part for part in re.split(r"[;、]",norm(text).strip(";、")) if part]

    def rich(label, picture):
        rows = [{"type":"paragraph","runs":[picture]}]
        if label:
            rows.insert(0,{"type":"paragraph","runs":[{"type":"text","text":label}]})
        return compact_layout(rows,checked_media,docx)

    require(all(t["source_question_indices"]==[1] and len(t["positions"])==1 for t in targets), "source_position")
    publisher = positions(";".join(token for group in native["answers"] for token in group if token.strip()))
    if review["mode"]=="true_false":
        keys = positions(key)
        require(len(keys)==len(targets)==len(labels) and keys==publisher==review["keys"], "reviewed_teacher_key")
        questions = []
        for i,(target,label,picture,value) in enumerate(zip(targets,labels,pictures,keys,strict=True),1):
            position, = target["positions"]
            require(target["kind"]=="true_false" and norm(position["source_part_locator"]).startswith(str(i)+norm(label))
                    and norm(position["reference_value"])==norm(target["reference_answer"])==value
                    and value in (str(i)+"ˇ",str(i)+"╳"), "review_choice_position")
            q = output_question("single_choice",rich(label,picture),[plain("是"),plain("否")],[1 if value.endswith("ˇ") else 2],plain(target["student_explanation"]))
            questions.append({"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages),"question":q})
        return plain(stem),questions,assets

    require(review["mode"]=="choices" and len(targets)==1,"source_position")
    target, = targets
    position, = target["positions"]
    keys = [v.removesuffix("ˇ") for v in positions(key)]
    require(keys==review["keys"]==[v.removesuffix("ˇ") for v in publisher]
            ==[v.removesuffix("ˇ") for v in positions(target["reference_answer"])]
            ==[v.removesuffix("ˇ") for v in positions(position["reference_value"])], "reviewed_teacher_key")
    require(keys and keys==[str(i) for i in range(1,len(labels)+1) if str(i) in keys], "word_choice_alignment")
    if len(keys)>1:
        # The existing private media gate resolves prompt images, while set fields store option IDs.
        width = max(map(len,image_rows))
        rows = []
        for group in image_rows:
            headings = [[{"type":"text","text":chr(0x2460+int(number)-1)+label}] for number,label,_ in group]
            rows.extend([headings+[[] for _ in range(width-len(group))],
                         [[image] for _,_,image in group]+[[] for _ in range(width-len(group))]])
        heading = {"type":"paragraph","runs":material["runs"]}
        prompt = compact_layout([heading,{"type":"table","rows":rows}],checked_media,docx)
        options = [plain(chr(0x2460+i)) for i in range(len(labels))]
        kind = "checkbox"
    else:
        prompt = plain(stem)
        options = [rich(label,picture) for label,picture in zip(labels,pictures,strict=True)]
        kind = "single_choice"
    question = output_question(kind,prompt,options,list(map(int,keys)),plain(target["student_explanation"]))
    return plain(""),[{"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages),"question":question}],assets


def reviewed_associated_images(parent, targets, original, pages, legacy, docx, review):
    require, norm, plain = legacy.require, legacy.normalize, legacy.plain
    word = Path(original["question_docx"])
    teacher = word.with_name("answer.docx.gz")
    asset = parent["question_only_asset"]
    snapshot = Path(asset["local_content"])
    require(legacy.digest(snapshot)==asset["sha256"]==review["snapshot_sha256"], "word_snapshot_changed")
    require(legacy.digest(word)==original["question_docx_sha256"]==review["word_sha256"], "original_word_changed")
    require(legacy.digest(teacher)==review["teacher_sha256"], "teacher_word_changed")
    parsed = legacy.read(snapshot)
    assets = verify_assets(parsed,asset["images"],word,legacy)
    layout, media = parsed["layout"], parsed["media"]
    raw = parent["original_source"]["native_content"]
    teacher_key = teacher_printed_answer(teacher,require)

    def paragraph(block):
        require(block["type"]=="paragraph" and all(r["type"]=="text" for r in block["runs"]), "word_caption")
        return "".join(r["text"] for r in block["runs"]).strip()

    def caption_image(caption, image):
        require(len(image)==1 and image[0]["type"]=="image","word_image_position")
        return compact_layout([{"type":"paragraph","runs":[{"type":"text","text":caption},*image]}],media,docx)

    heading = paragraph(layout[0])
    if review["mode"]=="numbered_caption_checklist":
        require(len(targets)==1 and targets[0]["kind"]=="checkbox" and targets[0]["source_question_indices"]==list(range(1,len(raw["questions"])+1))
                and len(targets[0]["positions"])==1, "source_position")
        questions = raw["questions"]
        require(len(layout)==2*len(questions)+1 and len(assets)==len(questions)
                and norm(heading)==norm(raw["preamble"]), "word_prompt")
        gallery, choices, selected = [layout[0]], [], []
        for i,item in enumerate(questions,1):
            caption = legacy.WORD_ORDINAL.fullmatch(paragraph(layout[2*i-1]))
            image = layout[2*i]
            require(caption and int(norm(caption[1]))==i and image["type"]=="paragraph"
                    and norm(caption[2])==norm(legacy.statement(item["stem"])), "word_choice_alignment")
            label = f"{i}. {caption[2]}"
            gallery.extend([{"type":"paragraph","runs":[{"type":"text","text":label}]},image])
            choices.append(plain(label))
            if item["answers"]:
                require(item["answers"]==[["ˇ"]], "teacher_check_key")
                selected.append(i)
        target, = targets
        key = ";".join(f"({i})ˇ" for i in selected)
        require(key and key==norm(teacher_key)==norm(target["reference_answer"])
                ==norm(target["positions"][0]["reference_value"]), "teacher_check_key")
        explanation = checked_explanation(target,review.get("explanation"),require)
        prompt = compact_layout(gallery,media,docx)
        result = output_question("checkbox",prompt,choices,selected,plain(explanation))
        return plain(""),[{"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages),
                           "question":result}],assets

    if review["mode"]=="figure_printed_choices":
        require(len(assets)==1 and len(raw["questions"])==1 and len(targets)==1 and len(layout)==2
                and layout[1]["type"]=="paragraph" and [r["type"] for r in layout[1]["runs"]]==["image"],
                "word_choice_alignment")
        require(next(iter(assets.values()))["sha256"]==review["image_sha256"], "original_media_sha")
        target, = targets
        item, = raw["questions"]
        require(target["kind"]=="circle" and target["source_question_indices"]==[1] and len(target["positions"])==1
                and not item["options"] and norm(heading)==norm(legacy.statement(item["stem"])), "word_choice_alignment")
        recorded = [v for group in item["answers"] for v in group]
        require(len(recorded)==1 and norm(teacher_key)==norm(recorded[0])==norm(target["reference_answer"])
                ==norm(target["positions"][0]["reference_value"]), "review_selection_key")
        labels = review["labels"]
        require(2<=len(labels)<=8 and len(set(labels))==len(labels), "printed_selection_positions")
        if ordinals:=review.get("ordinals"):
            require(ordinals==list("①②③④⑤⑥⑦⑧"[:len(labels)]), "printed_selection_positions")
            mode,selected = printed_selection_key(teacher_key)
            require(mode=="circle" and all(v in ordinals for v in selected),"review_selection_key")
            keys = [ordinals.index(v)+1 for v in selected]
            choices = [f"{code} {v}" for code,v in zip(ordinals,labels,strict=True)]
        else:
            require(teacher_key.strip().endswith("圈起來"),"review_selection_key")
            selected = teacher_key.strip().removesuffix("圈起來").split("、")
            require(selected==[v for v in labels if v in selected],"review_selection_key")
            keys = [labels.index(v)+1 for v in selected]
            choices = labels
        require(keys and "圈" in heading, "word_selection_action")
        explanation = checked_explanation(target,review.get("explanation"),require)
        q = output_question("checkbox",compact_layout(layout,media,docx),list(map(plain,choices)),keys,plain(explanation))
        return plain(""),[{"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages),"question":q}],assets

    if review["mode"]=="figure_caption_pairs":
        n = len(targets)
        require(len(assets)==1 and len(raw["questions"])==1 and len(layout)==n+2 and layout[-1]["type"]=="paragraph"
                and [r["type"] for r in layout[-1]["runs"]]==["image"], "word_matching_layout")
        require(next(iter(assets.values()))["sha256"]==review["image_sha256"], "original_media_sha")
        labels = list("①②③④⑤⑥"[:n])
        codes = list("ㄅㄆㄇㄈㄉㄊ"[:n])
        names = review["image_choices"]
        keys = re.split(r"[;；]",teacher_key.strip())
        evidence = raw["questions"][0]
        captions = [paragraph(x) for x in layout[1:-1]]
        stem = re.sub(r"(?:【[\s_＿]*】\s*)+$","",evidence["stem"]).strip()
        require(not evidence["options"] and norm(stem)==norm(heading+"".join(captions))
                and len(keys)==len(names)==n and len(set(names))==n
                and keys==[v for group in evidence["answers"] for v in group]
                and all(k.startswith(label) and k[1:] in names for k,label in zip(keys,labels,strict=True)),
                "teacher_matching_key")
        require(heading==review["original_instruction"] and review["display_instruction"].strip(),"matching_instruction_changed")
        material = caption_image(review["display_instruction"],layout[-1]["runs"])
        items = []
        for i,(target,key,caption,code) in enumerate(zip(targets,keys,captions,codes,strict=True)):
            require(target["kind"]=="matching" and target["source_question_indices"]==[1] and len(target["positions"])==1
                    and norm(key)==norm(target["reference_answer"])==norm(target["positions"][0]["reference_value"])
                    and caption.startswith(review["names"][i]+"：") and code in caption
                    and target["positions"][0]["source_part_locator"].startswith(review["names"][i]),"source_position")
            q = output_question("single_choice",plain(caption),list(map(plain,names)),[names.index(key[1:])+1],
                                plain(target["student_explanation"]))
            items.append({"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages),"question":q})
        return material,items,assets

    if review["mode"]=="figure_short_answers":
        require(len(targets)==len(raw["questions"])==len(review["fields"]) and len(assets)==review["image_count"],
                "word_question_position")
        starts = [(i,m) for i,b in enumerate(layout) if b["type"]=="paragraph"
                  and all(run["type"]=="text" for run in b["runs"])
                  and (m:=legacy.WORD_ORDINAL.fullmatch(paragraph(b)))]
        if starts:
            require([int(norm(m[1])) for _,m in starts]==list(range(1,len(targets)+1)), "word_question_position")
            ends = [i for i,_ in starts[1:]]+[len(layout)]
            require(all([paragraph(b) for b in layout[i+1:end]]==["答："]
                        for (i,_),end in zip(starts,ends,strict=True)), "word_answer_area")
            questions = [m[2] for _,m in starts]
            material = compact_layout(layout[:starts[0][0]],media,docx)
            keys = re.split(r"[（(]([1-8１-８])[）)]",teacher_key)
            require(not keys[0].strip() and [int(norm(k)) for k in keys[1::2]]==list(range(1,len(targets)+1)),
                    "teacher_choice_position")
            keys = [v.strip().rstrip("；;") for v in keys[2::2]]
        else:
            require(len(targets)==1 and len(layout)==3 and layout[1]["type"]=="paragraph"
                    and [r["type"] for r in layout[1]["runs"]]==["image"]
                    and norm(paragraph(layout[2]))==norm(review["answer_area"]), "word_answer_area")
            questions,keys = [heading],[teacher_key]
            material = plain("")
        items = []
        for i,(question,key,raw_item,target,fields) in enumerate(zip(questions,keys,raw["questions"],targets,review["fields"],strict=True),1):
            require(target["kind"]=="short_answer" and target["source_question_indices"]==[i], "source_position")
            stem = raw_item["stem"].strip()
            if not starts and review.get("export_answer_area"):
                raw_area = review["export_answer_area"]
                require(stem.endswith(raw_area), "word_answer_area")
                stem = stem.removesuffix(raw_area)
            stem = re.sub(r"答[：:]\s*(?:【[\s_＿]*】\s*)+$","",stem).strip()
            require(norm(question)==norm(stem), "word_prompt")
            field_keys = [v.strip() for v in re.split(r"[;；]",key)]
            publisher_values = [v.strip() for group in raw_item["answers"] for v in group if v.strip()]
            require(not raw_item["options"] and len(fields)==len(field_keys)==len(target["positions"])
                    and list(map(norm,field_keys))==list(map(norm,publisher_values))
                    ==[norm(v["reference_value"]) for v in target["positions"]]
                    and norm(target["reference_answer"])==norm(review["fixed_references"][i-1]), "teacher_open_fields")
            prompt = plain(question) if starts else compact_layout(layout[:2],media,docx)
            inputs,references = [],{}
            for j,(field,reference) in enumerate(zip(fields,field_keys,strict=True),1):
                example = re.sub(r"[（(]答案僅供參考[）)]","",reference).strip()
                if correction:=field.get("correction"):
                    require(correction["original"]==example, "reviewed_reference_changed")
                    example = correction["display"]
                name = f"answer{j}"
                inputs.append({"id":name,"input":"text","label":field["label"]})
                references[name] = {"examples":[example],"criteria":field["criteria"]}
            explanation = checked_explanation(target,review.get("explanations",{}).get(str(i)),require)
            q = {"type":"open","prompt":prompt,"fields":inputs,"explanation":plain(explanation),
                 "answer":{"format":"self-review-v1","fields":references}}
            items.append({"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages,require_auto_grade=False),
                          "question":q})
        return material,items,assets

    require(review["mode"]=="table_pair_columns" and len(layout)==2 and layout[1]["type"]=="table",
            "word_matching_layout")
    rows = layout[1]["rows"]
    n = len(targets)
    labels, codes = list("①②③④⑤⑥"[:n]),list("ㄅㄆㄇㄈㄉㄊ"[:n])
    require(2<=n<=6 and len(rows)==2*n and all(len(r)==5 for r in rows) and len(media)==2*n, "word_matching_layout")
    require(len(raw["questions"])==1 and norm(raw["questions"][0]["stem"]).startswith(norm(heading)), "word_prompt")
    keys = re.split(r"[;；]",teacher_key.strip())
    require(keys==[answer[0] for answer in raw["questions"][0]["answers"]] and len(keys)==n
            and all(len(k)==2 and k[0]==label and k[1] in codes for label,k in zip(labels,keys,strict=True)),
            "teacher_matching_key")
    left, right = [], []
    for i,(label,code) in enumerate(zip(labels,codes,strict=True)):
        captions, pictures = rows[2*i:2*i+2]
        require(captions==[[{"type":"text","text":label}],[],[],[],[{"type":"text","text":code}]]
                and pictures[1:4]==[[{"type":"text","text":"‧"}],[],[{"type":"text","text":"‧"}]],
                "word_matching_layout")
        left.append(caption_image(f"圖 {label}",pictures[0]))
        right.append(caption_image(code,pictures[-1]))
    items = []
    for i,(target,key) in enumerate(zip(targets,keys,strict=True)):
        require(target["kind"]=="matching" and target["source_question_indices"]==[1] and len(target["positions"])==1
                and norm(target["positions"][0]["reference_value"])==norm(target["reference_answer"])==norm(key)
                and target["positions"][0]["source_part_locator"].startswith(f"第{labels[i]}"), "source_position")
        question = output_question("single_choice",left[i],right,[codes.index(key[1])+1],plain(target["student_explanation"]))
        items.append({"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages),"question":question})
    require(review["original_instruction"]==heading, "matching_instruction_changed")
    return plain(review["display_instruction"]),items,assets


def reviewed_reading_slots(text, raw_key, fixed_key, teacher_answer, target, review, explanation, legacy, intro):
    require, norm, plain = legacy.require, legacy.normalize, legacy.plain
    require(len(raw_key)==len(fixed_key)==len(review["labels"]), "teacher_answer_columns")
    printed_key = [v.strip() for v in re.split(r"[;；]",teacher_answer)]
    fixed = [re.sub(r"^\([1-8]\)","",norm(value)) for value in fixed_key]
    require(list(map(norm,printed_key))==list(map(norm,raw_key))==fixed
            and norm(target["reference_answer"])==norm(review["fixed_reference"]), "teacher_finite_key")
    blanks = re.compile(r"[（(][\s_＿]+[）)]")
    pairs = re.compile(r"[（(][\u3000 \t]+([^（）()]+?)[\u3000 \t]+[）)]")
    fields, keys = [], {}
    mode = review["mode"]
    if mode=="local_choices":
        spans = list(pairs.finditer(text))
        choices = [[v.strip() for v in re.split(r"[,，]",m[1])] for m in spans]
        require(len(choices)==len(raw_key) and all(len(v)>1 for v in choices), "word_choice_alignment")
        text = pairs.sub("＿＿",text)
    elif mode=="shared_bank":
        require(intro and len(list(blanks.finditer(text)))==len(raw_key), "word_answer_columns")
        bank = [v.strip() for v in intro[-1].split()]
        require(len(bank)==len(set(bank))>=2, "word_choice_alignment")
        choices = [bank]*len(raw_key)
        text = blanks.sub("＿＿",text)
    elif mode=="printed_binary":
        choice_hint = re.search(r"[（(]填([^（）()]+)或([^（）()]+)[）)]$",text)
        require(choice_hint and len(raw_key)==1, "word_choice_alignment")
        choices = [list(choice_hint.groups())]
        text = re.sub(r"\s*[（(][\s_＿]+[）)]\s*$","",text[:choice_hint.start()]).strip()
    else:
        spans = list(blanks.finditer(text))
        require(mode=="fixed_suffix" and len(raw_key)==1 and len(spans)==1, "word_answer_columns")
        suffix = text[spans[0].end():].strip()
        require(suffix and suffix==review["suffix"], "word_answer_columns")
        text = re.sub(r"答[：:]\s*(?:[（(][\s_＿]+[）)])","＿＿",text)
        fields = [{"id":"slot1","input":"text","label":review["labels"][0]}]
        keys["slot1"] = [printed_key[0],printed_key[0]+suffix]
        choices = []
    for i,(options,answer,label) in enumerate(zip(choices,printed_key,review["labels"]),1):
        require(len(set(map(norm,options)))==len(options) and norm(answer) in list(map(norm,options)),
                "word_choice_alignment")
        position = list(map(norm,options)).index(norm(answer))+1
        if len(choices)==1:
            return output_question("single_choice",plain(text),list(map(plain,options)),[position],plain(explanation))
        field_id = f"slot{i}"
        fields.append({"id":field_id,"input":"single","label":label,
                       "options":[{"id":f"o{j}","content":plain(v)} for j,v in enumerate(options,1)]})
        keys[field_id] = [f"o{position}"]
    return {"type":"fields","prompt":plain(text),"fields":fields,
            "answer":{"format":"fields-v1","fields":keys},"explanation":plain(explanation)}


def reviewed_text_reading(parent, targets, original, pages, legacy, review):
    require, norm, plain = legacy.require, legacy.normalize, legacy.plain
    word = Path(original["question_docx"])
    teacher = word.with_name("answer.docx.gz")
    require(legacy.digest(word)==original["question_docx_sha256"]==review["word_sha256"], "original_word_changed")
    require(legacy.digest(teacher)==review["teacher_sha256"], "teacher_word_changed")

    namespace = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    circled = "①②③④⑤⑥⑦⑧"
    with zipfile.ZipFile(word) as source:
        body = ElementTree.fromstring(source.read("word/document.xml")).find(namespace+"body")
    require(body is not None and all(p.tag in (namespace+"p",namespace+"sectPr") for p in body)
            and all(n.tag not in (namespace+"drawing",namespace+"pict",namespace+"object") for n in body.iter()),
            "original_text_only")
    lines = []
    for paragraph in body.findall(namespace+"p"):
        line = "".join(n.text or "" for n in paragraph.iter() if n.tag in (namespace+"t",namespace+"instrText"))
        line = re.sub(r"eq\s*\\o\(○,([１２３４５６７８1-8])\)", lambda m:circled[int(m[1])-1],line).strip()
        if line:
            lines.append(line)

    native = parent["original_source"]["native_content"]
    items = native["questions"]
    require(len(items)==len(targets) and [t["source_question_indices"] for t in targets]
            ==[[i] for i in range(1,len(items)+1)], "source_position")
    starts = [(i,m) for i,line in enumerate(lines) if (m:=legacy.WORD_ORDINAL.fullmatch(line))]
    teacher_key = teacher_printed_answer(teacher,require)
    finite = review.get("finite_options")
    modes = review["open_fields"]
    if finite:
        require(len(lines)==len(items)==1 and not starts and not modes, "word_finite_layout")
        require(lines[0].endswith(f"（填入{'、'.join(finite[:-1])}或{finite[-1]}）"), "word_choice_alignment")
        intro, parts, answers = [], [(lines[0],[])], [teacher_key]
    elif review.get("unnumbered"):
        require(len(lines)==len(items)==1 and not starts, "word_unnumbered_layout")
        intro, parts, answers = [], [(lines[0],[])], [teacher_key]
    else:
        require([int(norm(m[1])) for _,m in starts]==list(range(1,len(items)+1)), "word_question_position")
        intro = lines[:starts[0][0]]
        ends = [i for i,_ in starts[1:]]+[len(lines)]
        parts = [(m[2],lines[i+1:end]) for (i,m),end in zip(starts,ends,strict=True)]
        keys = re.split(r"[（(]([1-8１-８])[）)]",teacher_key)
        require(not keys[0].strip() and [int(norm(k)) for k in keys[1::2]]==list(range(1,len(items)+1)),
                "teacher_choice_position")
        answers = [v.strip().rstrip("；;") for v in keys[2::2]]
    require(norm("".join(intro))==norm(native.get("preamble") or ""), "source_preamble")

    questions = []
    for i,((text,tail),item,target,teacher_answer) in enumerate(zip(parts,items,targets,answers,strict=True),1):
        groups = [[x.strip() for x in group if x.strip()] for group in item["answers"]]
        raw_key = [value for group in groups for value in group]
        fixed_key = [p["reference_value"] for p in target["positions"]]
        source_stem = re.sub(r"(?:答[：:]\s*)?(?:【[\s_＿]*】\s*)+$","",item["stem"]).strip()
        source_stem = re.sub(r"[（(][\s_＿]*[）)]\s*$","",source_stem).strip()
        explanation = checked_explanation(target,review.get("explanations",{}).get(str(i)),require)
        options = item["options"]
        placement = review.get("slots",{}).get(str(i))
        free = review.get("distinct_examples",{}).get(str(i))
        if placement:
            text = " ".join([text,*tail]).strip()
        elif options:
            printed = " ".join([text,*[re.sub(r"^[（(][\s_＿]*[）)]\s*","",line) for line in tail]])
            segments = re.split(f"([{circled}])",printed)
            text = segments[0].strip()
            require(segments[1::2]==list(circled[:len(options)]) and
                    [norm(v) for v in segments[2::2]]==list(map(norm,options)), "word_choice_alignment")
        else:
            require(all(re.fullmatch(r"答[：:]\s*",line) for line in tail), "word_answer_area")
        require(norm(text)==norm(source_stem), "word_prompt")
        if placement:
            question = reviewed_reading_slots(text, raw_key, fixed_key, teacher_answer, target, placement, explanation, legacy, intro)
        elif options or finite:
            choices = options or finite
            if options:
                printed_keys = [re.fullmatch(f"([{circled}])[ˇ✓√✔]?",value.strip())
                                for value in re.split(r"[;；]",teacher_answer)]
                fixed = re.split(r"[,;、]",norm(target["reference_answer"]))
                selected = [int(value) for value in fixed]
                require(fixed==list(map(norm,raw_key))==re.split(r"[,;、]",norm("；".join(fixed_key)))
                        and all(printed_keys)
                        and selected==[circled.index(k[1])+1 for k in printed_keys]
                        and selected==sorted(set(selected)) and 1<=min(selected)<=max(selected)<=len(choices),
                        "teacher_choice_key")
                require(not re.search(f"[{circled}]",explanation), "ordinal_explanation")
            else:
                require(len(raw_key)==len(fixed_key)==1 and norm(raw_key[0])==norm(fixed_key[0])==norm(target["reference_answer"])
                        and target["kind"]=="fill_in_the_blank" and teacher_answer in choices
                        and norm(teacher_answer)==norm(raw_key[0]), "teacher_finite_key")
                selected = [choices.index(teacher_answer)+1]
                text = re.sub(r"[（(][\s_＿]+[）)]","＿＿",text,count=1)
            kind = "checkbox" if len(selected)>1 else "single_choice"
            question = output_question(kind,plain(text),list(map(plain,choices)),selected,plain(explanation))
        else:
            teacher_fields = [v.strip() for v in re.split(r"[；;]",teacher_answer)]
            labels = modes.get(str(i),[])
            require(target["kind"]=="short_answer" and labels, "teacher_open_fields")
            if free:
                reference = "；".join(teacher_fields)
                cleaned = [re.sub(r"[（(]答案僅供參考[）)]$","",v).strip() for v in teacher_fields]
                require(len(labels)==len(cleaned)==len(fixed_key)==free
                        and len(set(cleaned))==free
                        and norm(reference)==norm("；".join(raw_key))==norm(target["reference_answer"])
                        and all(v=={"examples":cleaned,"non_exhaustive":True} for v in fixed_key), "teacher_open_fields")
            else:
                require(len(labels)==len(raw_key) and
                        list(map(norm,teacher_fields))==list(map(norm,raw_key))==list(map(norm,fixed_key))
                        and norm("；".join(fixed_key))==norm(target["reference_answer"]), "teacher_open_fields")
            fields, examples = [], {}
            for f,(field,example) in enumerate(zip(labels,teacher_fields,strict=True),1):
                field_id = f"answer{f}"
                require(field["label"].strip() and field["criteria"], "open_review_criteria")
                fields.append({"id":field_id,"input":"text","label":field["label"]})
                examples[field_id] = {"examples":[re.sub(r"[（(]答案僅供參考[）)]$","",example).strip()],
                                      "criteria":field["criteria"]}
            question = {"type":"open","prompt":plain(text),"fields":fields,"explanation":plain(explanation),
                        "answer":{"format":"self-review-v1","fields":examples}}
        refs = legacy.refs_for(target,original["unit"],pages,require_auto_grade=question["type"]!="open")
        questions.append({"target":target["target_id"],"refs":refs,"question":question})
    return plain("\n".join(intro)),questions,{}


def reviewed_recovered_word(parent, targets, original, pages, legacy, docx, review):
    require, norm, plain = legacy.require, legacy.normalize, legacy.plain
    word = Path(original["question_docx"])
    teacher_file = word.with_name("answer.docx.gz")
    layout = Path(review["layout"]["path"])
    require(legacy.digest(layout)==review["layout"]["sha256"], "word_snapshot_changed")
    recovered = legacy.read(layout)
    require(legacy.digest(word)==original["question_docx_sha256"]==recovered["word_sha256"], "original_word_changed")
    require(legacy.digest(teacher_file)==recovered["teacher_sha256"], "teacher_word_changed")
    printed_key = teacher_printed_answer(teacher_file,require)
    require(printed_key==review["teacher_key"], "reviewed_teacher_key")
    media, blocks = recovered["media"], recovered["blocks"]
    images = review["images"]
    require(len(images)==len(media), "original_media_sha")
    catalog = []
    for image,item in zip(images,media,strict=True):
        require(Path(item["url"]).stem==image["original_sha256"], "original_media_sha")
        catalog.append({**image,"mime":"image/png"})
    media = [{**m,"url":image["path"]} for m,image in zip(media,images,strict=True)]
    assets = verify_assets({"media":media},catalog,word,legacy)
    mode = review["mode"]

    def key(text):
        return norm(text).replace("、",";").strip(";")

    def text(block):
        return "".join(r["text"] for r in block["runs"] if r["type"]=="text")

    def paragraph(value):
        return {"type":"paragraph","runs":[{"type":"text","text":value}]}

    def add(i,prompt,labels,selected):
        target = targets[i]
        require(labels and selected and selected==sorted(set(selected)) and max(selected)<=len(labels), "word_choice_alignment")
        kind = "checkbox" if len(selected)>1 else "single_choice"
        q = output_question(kind,prompt,list(map(plain,labels)),selected,plain(target["student_explanation"]))
        questions.append({"target":target["target_id"],"refs":legacy.refs_for(target,original["unit"],pages),"question":q})

    def marked_choices(blocks,raw):
        found = [re.fullmatch(r"[（(][\s_＿]*[）)]\s*([①-⑧])\s*(.+)",text(b)) for b in blocks]
        require(found and all(found) and [int(norm(m.group(1))) for m in found]==list(range(1,len(found)+1)), "word_choice_alignment")
        labels = [m.group(2) for m in found]
        if raw["options"]:
            require(list(map(norm,labels))==list(map(norm,raw["options"])), "word_choice_alignment")
        return labels

    def questions_by_ordinal():
        matches = [(i,m) for i,b in enumerate(blocks) if b["type"]=="paragraph"
                   and (m:=re.match(r"[（(]([１-８1-8])[）)]",text(b)))]
        require([int(m.group(1)) for _,m in matches]==list(range(1,len(raw_items)+1)), "word_question_position")
        ends = [i for i,_ in matches[1:]]+[len(blocks)]
        return blocks[:matches[0][0]],[(text(blocks[i])[m.end():].strip(),blocks[i+1:end]) for (i,m),end in zip(matches,ends,strict=True)]

    def numbered_keys():
        parts = re.split(r"\(([1-8])\)", key(printed_key))
        require(not parts[0] and parts[1::2]==[str(i) for i in range(1,len(raw_items)+1)], "teacher_choice_position")
        return [x.strip(";") for x in parts[2::2]]

    def publisher(raw):
        return key(";".join(t for group in raw["answers"] for t in group if t.strip()))

    def numeric_set(choices):
        return [int(v.removesuffix("ˇ")) for v in choices.split(";")]

    def verify_plain_stem(stem,tail,raw):
        without_blanks = re.sub(r"(?:【[\s_＿]*】\s*|[（(][\s_＿]*[）)]\s*)+$","",raw["stem"])
        actual = stem if raw["options"] else stem+"".join(map(text,tail))
        require(norm(actual)==norm(without_blanks), "word_prompt")

    native = parent["original_source"]["native_content"]
    raw_items = native["questions"]
    expected = review["answers"]
    require(expected==[key(t["reference_answer"]) for t in targets]
            ==[key(";".join(p["reference_value"] for p in t["positions"])) for t in targets], "review_choice_position")
    questions = []
    if mode=="inline_reading_glyph":
        require(len(blocks)==len(media)==len(raw_items)==len(targets)==1 and targets[0]["kind"]=="true_false"
                and targets[0]["source_question_indices"]==[1] and norm(text(blocks[0]))==norm(raw_items[0]["stem"]), "word_prompt")
        require(expected==[key(printed_key)]==[publisher(raw_items[0])]==["╳"], "reviewed_teacher_key")
        require(len(recovered["fields"])==1 and recovered["fields"][0]["kept_embedded_image"], "original_media_sha")
        add(0,compact_layout(blocks,media,docx),["是","否"],[2])
        return plain(""),questions,assets

    if mode=="air_property_table":
        table = blocks[-1]
        require(table["type"]=="word-table" and table["columns"]==2 and len(table["rows"])==6 and len(raw_items)==1, "native_table_layout")
        intro = blocks[:-1]
        bank = [text(b).strip() for b in intro[-3:]]
        require([norm(v)[0] for v in bank]==list("ABC"), "word_choice_alignment")
        keys = re.split(r"([1-5])(?=[ABC])",key(printed_key))
        require(not keys[0] and keys[1::2]==list("12345"), "teacher_choice_position")
        require([v.strip(";") for v in keys[2::2]]==expected, "reviewed_teacher_key")
        require(publisher(raw_items[0])==key(printed_key), "reviewed_teacher_key")
        for i,(row,target,answer) in enumerate(zip(table["rows"][1:],targets,expected,strict=True),1):
            a,b = row
            first, = a["paragraphs"]
            second, = b["paragraphs"]
            caption = "".join(run["text"] for run in first)
            slots = re.findall(r"[（(][\s_＿]+[）)]","".join(run["text"] for run in second))
            require(norm(caption).startswith(str(i)) and target["source_question_indices"]==[1]
                    and len(slots)==len(answer.split(";"))==len(target["positions"])
                    and all(norm(p["source_part_locator"]).startswith(f"第{i}列"+norm(caption)) for p in target["positions"]), "source_position")
            add(i-1,plain(caption),bank,["ABC".index(v)+1 for v in answer.split(";")])
        return compact_layout(intro[:-3],media,docx),questions,assets

    intro, parts = questions_by_ordinal()
    actual_keys = numbered_keys()
    indices = [t["source_question_indices"] for t in targets]
    if mode=="step_tables_and_marks":
        require(indices==[[1],[2],[3],[3],[3],[3]] and actual_keys[:2]+actual_keys[2].split(";")==expected, "source_position")
        require(norm("".join(map(text,intro)))==norm(native["preamble"]), "source_preamble")
        stem,tables = parts[0]
        require(len(tables)==2 and all(t["type"]=="word-table" and len(t["rows"])==4 for t in tables), "native_table_layout")
        descriptions, labels, revised = [], [], []
        for letter,table in zip("AB",tables,strict=True):
            title, = table["rows"][0]
            prepend = title["paragraphs"][0][0]["text"]
            require(title["span"]==2 and norm(prepend).startswith(letter), "word_choice_alignment")
            descriptions.append(prepend)
            revised.append(paragraph(prepend))
            rows = []
            for i,row in enumerate(table["rows"][1:],1):
                left,right = ["".join(run["text"] for line in c["paragraphs"] for run in line) for c in row]
                require(norm(left)==f"()步驟{i}" and right, "word_choice_alignment")
                descriptions.extend([left,right])
                label = f"{letter}步驟{'①②③'[i-1]}"
                labels.append(label)
                rows.append([paragraph(label)["runs"],paragraph(right)["runs"]])
            revised.append({"type":"table","rows":rows})
        require(norm(stem+"".join(descriptions))==norm(raw_items[0]["stem"]), "word_prompt")
        require(actual_keys[0]=="A1ˇ;B1ˇ" and publisher(raw_items[0])=="1;1", "reviewed_teacher_key")
        add(0,plain(stem),labels,[1,4])
        stem, tail = parts[1]
        verify_plain_stem(stem,tail,raw_items[1])
        require(numeric_set(actual_keys[1])==numeric_set(publisher(raw_items[1])), "reviewed_teacher_key")
        add(1,plain(stem),marked_choices(tail,raw_items[1]),numeric_set(expected[1]))
        stem, tail = parts[2]
        verify_plain_stem(stem,tail,raw_items[2])
        require(len(tail)==1 and len(media)==1 and publisher(raw_items[2])==actual_keys[2], "reviewed_teacher_key")
        for i,label in enumerate(review["option_captions"],1):
            require(norm(label).startswith(str(i)) and norm(targets[i+1]["positions"][0]["source_part_locator"]).startswith(f"(3)小題{norm(label)}"), "source_position")
            q = compact_layout([paragraph(stem),*tail,paragraph(label)],media,docx)
            value = expected[i+1]
            require(value in (str(i)+"ˇ",str(i)+"╳"), "review_choice_position")
            add(i+1,q,["可以","不行"],[1 if value.endswith("ˇ") else 2])
        return compact_layout([*intro,*revised],media,docx),questions,assets

    require(indices==[[1],[2]] and actual_keys==expected, "source_position")
    if mode=="wind_record_table":
        require(len(intro)==2 and intro[1]["type"]=="word-table" and len(media)==2, "native_table_layout")
        rows = intro[1]["rows"]
        require(len(rows)==2 and [c["span"] for c in rows[0]]==[4] and [c["span"] for c in rows[1]]==[1]*4, "native_table_layout")
        record = [paragraph("".join(run["text"] for run in runs)) for runs in rows[0][0]["paragraphs"]]
        cells = [[run for line in c["paragraphs"] for run in line] for c in rows[1]]
        require([cells[i][0]["text"] for i in (0,2)]==["風力","風向"] and [cells[i][0]["media_index"] for i in (1,3)]==[0,1], "native_table_cells")
        material = compact_layout([intro[0],*record,{"type":"table","rows":[[cells[0],cells[2]],[cells[1],cells[3]]]}],media,docx)
        stem,tail = parts[0]
        verify_plain_stem(stem,tail,raw_items[0])
        require(norm(material["text"])==norm(native["preamble"]) and numeric_set(expected[0])==numeric_set(publisher(raw_items[0])), "word_prompt")
        add(0,plain(stem),marked_choices(tail,raw_items[0]),numeric_set(expected[0]))
        stem,tail = parts[1]
        require(len(tail)==1 and re.fullmatch(r"答：[（(][\s_＿]*[）)]",text(tail[0])) is not None
                and norm(stem+"答:")==norm(re.sub(r"[（(][\s_＿]*[）)]\s*$","",raw_items[1]["stem"]))
                and expected[1]==publisher(raw_items[1])=="不正確", "word_prompt")
        add(1,plain(stem.replace("請填正確或不正確。","")),["正確","不正確"],[2])
        return material,questions,assets

    material = compact_layout(intro,media,docx)
    require(mode=="reading_six_options" and not media and norm(material["text"])==norm(native["preamble"]), "source_preamble")
    for i,((stem,tail),raw,answer) in enumerate(zip(parts,raw_items,expected,strict=True)):
        verify_plain_stem(stem,tail,raw)
        require(answer==publisher(raw), "reviewed_teacher_key")
        add(i,plain(stem),marked_choices(tail,raw),numeric_set(answer))
    return material,questions,assets


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
    parser.add_argument("--numbered-choice-reviews", type=Path)
    parser.add_argument("--text-sequence-reviews", type=Path)
    parser.add_argument("--image-single-reviews", type=Path)
    parser.add_argument("--diagram-reviews", type=Path)
    parser.add_argument("--figure-answer-reviews", type=Path)
    parser.add_argument("--native-table-choice-reviews", type=Path)
    parser.add_argument("--mixed-image-choice-reviews", type=Path)
    parser.add_argument("--wind-strength-reviews", type=Path)
    parser.add_argument("--solubility-result-reviews", type=Path)
    parser.add_argument("--merged-image-choice-reviews", type=Path)
    parser.add_argument("--associated-image-reviews", type=Path)
    parser.add_argument("--text-reading-reviews", type=Path)
    parser.add_argument("--recovered-word-reviews", type=Path)
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
    numbered_reviews = legacy.read(args.numbered_choice_reviews) if args.numbered_choice_reviews else {}
    sequence_reviews = legacy.read(args.text_sequence_reviews) if args.text_sequence_reviews else {}
    image_single_reviews = legacy.read(args.image_single_reviews) if args.image_single_reviews else {}
    diagram_reviews = legacy.read(args.diagram_reviews) if args.diagram_reviews else {}
    figure_reviews = legacy.read(args.figure_answer_reviews) if args.figure_answer_reviews else {}
    native_table_reviews = legacy.read(args.native_table_choice_reviews) if args.native_table_choice_reviews else {}
    mixed_image_reviews = legacy.read(args.mixed_image_choice_reviews) if args.mixed_image_choice_reviews else {}
    wind_strength_reviews = legacy.read(args.wind_strength_reviews) if args.wind_strength_reviews else {}
    solubility_reviews = legacy.read(args.solubility_result_reviews) if args.solubility_result_reviews else {}
    merged_image_reviews = legacy.read(args.merged_image_choice_reviews) if args.merged_image_choice_reviews else {}
    associated_image_reviews = legacy.read(args.associated_image_reviews) if args.associated_image_reviews else {}
    text_reading_reviews = legacy.read(args.text_reading_reviews) if args.text_reading_reviews else {}
    recovered_word_reviews = legacy.read(args.recovered_word_reviews) if args.recovered_word_reviews else {}
    text_modes = (classification_reviews, choice_reviews, boolean_reviews, numbered_reviews, sequence_reviews, native_table_reviews)
    modes = (visual_reviews, grid_reviews, matching_reviews, single_reviews, mixed_reviews, image_single_reviews, diagram_reviews, figure_reviews, mixed_image_reviews, wind_strength_reviews, solubility_reviews, merged_image_reviews, recovered_word_reviews, *text_modes)
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
        if old["reason"]!="original_media" and sid not in merged_image_reviews and sid not in recovered_word_reviews and not any(sid in reviews for reviews in text_modes):
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
            elif sid in numbered_reviews:
                rule = "reviewed_numbered_choices"
                material, qs, assets = reviewed_numbered_choices(parent, group, source, pages, legacy, numbered_reviews[sid])
            elif sid in sequence_reviews:
                rule = "reviewed_text_sequence"
                material, qs, assets = reviewed_text_sequence(parent, group, source, pages, legacy, sequence_reviews[sid])
            elif sid in image_single_reviews:
                rule = "reviewed_image_single_choices"
                material, qs, assets = reviewed_image_single_choices(parent, group, source, pages, legacy, docx, image_single_reviews[sid])
            elif sid in diagram_reviews:
                rule = "reviewed_diagram_choices"
                material, qs, assets = reviewed_diagram_choices(parent, group, source, pages, legacy, docx, diagram_reviews[sid])
            elif sid in figure_reviews:
                rule = "reviewed_figure_answers"
                material, qs, assets = reviewed_figure_answers(parent, group, source, pages, legacy, docx, figure_reviews[sid])
            elif sid in native_table_reviews:
                rule = "reviewed_native_table_choices"
                material, qs, assets = reviewed_native_table_choices(parent, group, source, pages, legacy, docx, native_table_reviews[sid])
            elif sid in mixed_image_reviews:
                rule = "reviewed_mixed_image_choices"
                material, qs, assets = reviewed_mixed_image_choices(parent, group, source, pages, legacy, docx, mixed_image_reviews[sid])
            elif sid in wind_strength_reviews:
                rule = "reviewed_wind_strength"
                material, qs, assets = reviewed_wind_strength(parent, group, source, pages, legacy, docx, wind_strength_reviews[sid])
            elif sid in solubility_reviews:
                rule = "reviewed_solubility_results"
                material, qs, assets = reviewed_solubility_results(parent, group, source, pages, legacy, docx, solubility_reviews[sid])
            elif sid in merged_image_reviews:
                rule = "reviewed_merged_image_choices"
                material, qs, assets = reviewed_merged_image_choices(parent, group, source, pages, legacy, docx, merged_image_reviews[sid])
            elif sid in associated_image_reviews:
                rule = "reviewed_associated_images"
                material, qs, assets = reviewed_associated_images(parent, group, source, pages, legacy, docx, associated_image_reviews[sid])
            elif sid in text_reading_reviews:
                rule = "reviewed_text_reading"
                material, qs, assets = reviewed_text_reading(parent, group, source, pages, legacy, text_reading_reviews[sid])
            elif sid in recovered_word_reviews:
                rule = "reviewed_recovered_word"
                material, qs, assets = reviewed_recovered_word(parent, group, source, pages, legacy, docx, recovered_word_reviews[sid])
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
