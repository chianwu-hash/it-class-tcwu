import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def normalize(text):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", text))


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def plain(text):
    return {"text": text, "media": []}


def statement(text):
    return re.sub(r"[【（(][\s_＿]*[】）)]\s*$", "", text).strip()


WORD_ORDINAL = re.compile(r"^\s*(?:[（(][\s_＿]*[）)]\s*)?[（(]([0-9０-９]+)[）)]\s*(.*)$")
CIRCLE_PAIR = re.compile(r"[（(][\u3000 \t]+([^（）(),，\n]+?)[\u3000 \t]*[，,]"
                         r"[\u3000 \t]*([^（）(),，\n]+?)[\u3000 \t]+[）)]")


def numbered_lines(text):
    preamble, items = [], []
    for line in text.splitlines():
        if not line.strip():
            continue
        match = WORD_ORDINAL.fullmatch(line)
        if match:
            items.append((int(normalize(match[1])), match[2]))
        elif items:
            ordinal, text = items[-1]
            items[-1] = (ordinal, f"{text}\n{line.strip()}")
        else:
            preamble.append(line.strip())
    require(items and [i for i, _ in items] == list(range(1, len(items) + 1)), "numbered_word_items")
    return "\n".join(preamble), [s for _, s in items]


def circle_pair(line, raw_stem, original_key, reviewed_key):
    source = statement(line)
    require(normalize(source) == normalize(statement(raw_stem)), "word_stem_mismatch")
    pairs = list(CIRCLE_PAIR.finditer(source))
    require(len(pairs) == 1, "word_choices_mismatch")
    match = pairs[0]
    texts = [s.strip() for s in match.groups()]
    normalized = list(map(normalize, texts))
    require(all(normalized) and normalized[0] != normalized[1], "word_choices_mismatch")
    answer = normalize(original_key)
    require(answer in normalized and answer == normalize(reviewed_key), "single_review_key")
    before, after = source[:match.start()].rstrip(), source[match.end():].lstrip()
    stem = before if not after else f"{before}＿＿{after}"
    require(stem, "word_stem_mismatch")
    return stem, texts, str(normalized.index(answer) + 1)


def refs_for(target, unit, pages, *, require_auto_grade=True):
    require(not target.get("reference_answer_issue") and not target.get("needs_teacher_manual")
            and not target.get("uncertainties") and target.get("student_explanation")
            and (not require_auto_grade or target.get("auto_grade") is not False) and target.get("include_in_current_practice") is not False,
            "fixed_review_missing")
    refs = []
    for evidence in target.get("evidence", []):
        ref = evidence.get("resolved_ref") or {}
        require(ref.get("printed_pages"), "original_textbook_missing")
        for page in ref["printed_pages"]:
            require((unit, page, ref.get("source_filename"), ref.get("source_sha256"), ref.get("pdf_page_1based")) in pages,
                    "original_textbook_mismatch")
            if page not in refs:
                refs.append(page)
    require(refs, "original_textbook_missing")
    return refs


def adapt(parent, targets, original, pages):
    asset = parent.get("question_only_asset") or {}
    path = asset.get("local_content")
    require(path and Path(path).is_file() and digest(path) == asset["sha256"], "word_snapshot_missing")
    parsed = read(path)
    require(not parsed.get("media"), "original_media")
    require(all(p["type"] == "paragraph" for p in parsed.get("layout", [])), "original_table")
    native = parent["original_source"]["native_content"]
    raw = native["questions"]
    paragraphs = [line.strip() for line in parsed["text"].splitlines() if line.strip()]
    standalone = (
        len(raw) == len(targets) == 1 and paragraphs and not (native.get("preamble") or "").strip()
        and targets[0]["kind"] in {"single_choice", "multiple_choice", "true_false"}
        and not WORD_ORDINAL.fullmatch(paragraphs[0])
    )
    standalone_choice = standalone and bool(raw[0]["options"])
    if standalone:
        source_preamble, lines = "", ["\n".join(paragraphs)]
    else:
        source_preamble, lines = numbered_lines(parsed["text"])
    require(len(raw) == len(lines), "numbered_word_items")
    require(normalize(source_preamble) == normalize(native.get("preamble") or ""), "shared_material_mismatch")
    require(digest(original["question_docx"]) == original["question_docx_sha256"], "original_word_changed")
    answers = [[str(value).strip() for group in item["answers"] for value in group if str(value).strip()] for item in raw]
    unit = original["unit"]
    targets_by_index = {tuple(t["source_question_indices"]): t for t in targets}
    ids = [(i,) for i in range(1, len(raw) + 1)]
    resolve = lambda t: refs_for(t, unit, pages)
    options = lambda texts: [{"id": f"o{i}", "content": plain(s)} for i, s in enumerate(texts, 1)]

    if not standalone and len(targets) == 1 and targets[0]["kind"] in {"multiple_choice", "checkbox"}:
        t = targets[0]
        require(list(t["source_question_indices"]) == list(range(1, len(raw) + 1)), "whole_group_mapping")
        require(source_preamble and 2 <= len(raw) <= 8 and all(not q["options"] for q in raw), "checkbox_source_format")
        require(all(normalize(statement(q["stem"])) == normalize(s) for q, s in zip(raw, lines)), "statement_mismatch")
        require(all(not a or (len(a) == 1 and a[0] in "ˇ✓√✔") for a in answers), "original_checkbox_key")
        key = [i for i, a in enumerate(answers, 1) if a]
        expected = re.findall(r"\(([0-9]+)\)", normalize(t["reference_answer"]))
        remainder = re.sub(r"\([0-9]+\)[vVˇ✓√✔]?", "", normalize(t["reference_answer"]))
        require(key and sorted(map(int, expected)) == key and not re.sub(r"[;,、]", "", remainder), "checkbox_review_key")
        clean_prompt = re.sub(r"(?:並)?(?:請)?在[（(][\s_＿]*[）)](?:中|裡)?打[ˇ✓√✔]|[，,]?(?:請)?打[ˇ✓√✔]", "", source_preamble)
        clean_prompt = clean_prompt.strip("，, ")
        require(clean_prompt, "checkbox_prompt")
        fields = [{"id": "selected", "label": "勾選所有正確選項", "input": "set", "options": options(lines)}]
        question = {"type": "fields", "prompt": plain(clean_prompt), "fields": fields,
                    "answer": {"format": "fields-v1", "fields": {"selected": [[f"o{i}" for i in key]]}},
                    "explanation": plain(t["student_explanation"])}
        return "", [(t, resolve(t), question)], "checkbox"

    require(len(targets) == len(raw) and set(targets_by_index) == set(ids), "independent_question_mapping")
    symbols = {"○": "1", "◯": "1", "〇": "1", "ˇ": "1", "×": "2", "╳": "2", "X": "2"}
    result = []
    for i, (item, line, answer) in enumerate(zip(raw, lines, answers), 1):
        t = targets_by_index[(i,)]
        require(len(answer) == 1, "original_independent_key")
        if t["kind"] == "single_choice" and not item["options"]:
            stem, texts, key = circle_pair(line, item["stem"], answer[0], t["reference_answer"])
        elif t["kind"] == "single_choice" or standalone_choice:
            markers = list(re.finditer(r"[①②③④⑤⑥⑦⑧]", line))
            texts = [line[m.end():markers[k+1].start() if k+1 < len(markers) else None].strip()
                     for k, m in enumerate(markers)]
            require(len(markers) >= 2 and [m[0] for m in markers] == [chr(0x2460 + j) for j in range(len(markers))]
                    and list(map(normalize, texts)) == list(map(normalize, item["options"])), "word_choices_mismatch")
            stem = line[:markers[0].start()].strip()
            key = normalize(answer[0])
            require(key in {str(j) for j in range(1, len(texts) + 1)} and normalize(t["reference_answer"]) == key,
                    "single_review_key")
        else:
            require(t["kind"] == "true_false" and not item["options"], "original_question_type")
            stem, texts = statement(line), ["○", "×"]
            key = symbols.get(answer[0])
            require(key and key == symbols.get(t["reference_answer"].strip()), "boolean_review_key")
        if item["options"] or t["kind"] != "single_choice":
            require(normalize(stem) == normalize(statement(item["stem"])), "word_stem_mismatch")
        explanation = t["student_explanation"]
        explanation = re.sub(r"[①②③④⑤⑥⑦⑧]", lambda m: "「"+texts[ord(m[0])-0x2460]+"」" if ord(m[0])-0x2460 < len(texts) else m[0], explanation)
        require(not re.search(r"[①②③④⑤⑥⑦⑧]|選項\s*[A-H1-8]", explanation), "explanation_option_key")
        result.append((t, resolve(t), {"type": "single", "prompt": plain(stem), "options": options(texts),
                                      "answer": {"option_id": "o" + key}, "explanation": plain(explanation)}))
    return source_preamble, result, "standalone_choice" if standalone_choice else "independent"


def main():
    parser = argparse.ArgumentParser()
    for key in ["export", "source-catalog", "live-pool", "original-pages", "output"]:
        parser.add_argument("--" + key, required=True)
    args = parser.parse_args()
    export = read(args.export)
    present = {p.get("parent") for p in read(args.live_pool) if p["course_id"] == "115-1-hanlin-g3-science" and p["usable"]}
    catalog = {r["stable_id"]: r for r in read(args.source_catalog)["records"]}
    pages = {tuple(row) for row in read(args.original_pages)}
    by_parent = defaultdict(list)
    for target in export["logical_targets"]:
        by_parent[target["parent_id"]].append(target)
    passed, held = [], []
    for parent in export["parents"]:
        source = parent["id"]
        if parent["source_kind"] != "general_bank" or source in present:
            continue
        targets = by_parent[source]
        original = catalog[source]
        try:
            common, questions, rule = adapt(parent, targets, original, pages)
            passed.append({"parent": source, "source": original["id"], "unit": original["unit"], "rule": rule,
                           "difficulty": original["difficulty"], "material": plain(common),
                           "questions": [{"target": t["target_id"], "refs": refs, "question": question}
                                         for t, refs, question in questions]})
        except ValueError as error:
            held.append({"parent": source, "count": len(targets), "reason": str(error)})
    report = {"passed": passed, "held": held}
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"passed_sources": dict(Counter(p["rule"] for p in passed)),
                      "passed_questions": sum(len(p["questions"]) for p in passed),
                      "held_sources": dict(Counter(p["reason"] for p in held))}))


if __name__ == "__main__":
    main()
