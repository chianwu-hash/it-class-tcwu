"""Convert verified rectangular text tables with independently scored science items."""
import argparse
from collections import Counter
import json
from pathlib import Path
import re
import unicodedata


def normalize(text):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", text))


def rich(text):
    return {"text": text, "media": []}


def runs(text):
    return [{"type": "text", "text": text}] if text else []


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def table_material(blocks):
    layout, text = [], []
    for block in blocks:
        if block["type"] == "paragraph":
            layout.append({"type": "paragraph", "runs": runs(block["sourceText"])})
            text.append(block["sourceText"])
        else:
            rows = block["rows"]
            require(len({len(row) for row in rows}) == 1
                    and all(not cell["spans"] for row in rows for cell in row), "table_spans")
            layout.append({"type": "table", "rows": [[runs(c["text"]) for c in row] for row in rows]})
            text.extend("\t".join(c["text"] for c in row) for row in rows)
    require(sum(b["type"] == "table" for b in layout) == 1, "common_table_missing")
    return {**rich("\n".join(text)), "layout": layout}


ORDINAL = re.compile(r"^(?:[（(]\s*[）)]\s*)?[（(]([０-９0-9]+)[）)]\s*(.+)$")
PAREN_LABELS = re.compile(r"([^（）()]+)[（(]\s*[）)]")


def separate(blocks):
    common, items = [], []
    for block in blocks:
        if block["type"] == "paragraph":
            text = block["sourceText"]
            matched = ORDINAL.fullmatch(text)
            if matched:
                number = int(unicodedata.normalize("NFKC", matched[1]))
                require(number == len(items) + 1, "word_ordinals")
                items.append({"number": number, "stem": matched[2], "tails": []})
                continue
        if items:
            require(block["type"] == "paragraph", "table_after_question")
            items[-1]["tails"].append(block["sourceText"])
        else:
            common.append(block)
    return table_material(common), items


def word_options(line):
    if line.startswith("□"):
        opts = [text.strip() for text in re.split(r"\s*□\s*", line) if text.strip()]
    else:
        require(normalize("".join(m.group(0) for m in PAREN_LABELS.finditer(line))) == normalize(line),
                "word_choice_markers")
        opts = [m.group(1).strip() for m in PAREN_LABELS.finditer(line)]
    require(2 <= len(opts) <= 4 and len({normalize(x) for x in opts}) == len(opts), "word_choice_markers")
    return opts


def teacher_values(row):
    require(len(row["teacher"]) == 1, "teacher_answer_count")
    text = normalize(row["teacher"][0]["text"])
    m = re.fullmatch(r"答案:(.+)", text)
    require(m is not None, "teacher_answer_format")
    values = {}
    for item in m[1].split(";"):
        piece = re.fullmatch(r"\((\d+)\)(.+)", item)
        require(piece is not None and int(piece[1]) not in values, "teacher_answer_position")
        values[int(piece[1])] = piece[2]
    return values


def boolean_value(s):
    s = normalize(s)
    require(s in ("╳", "×", "○", "◯"), "teacher_boolean_key")
    return "o1" if s in ("○", "◯") else "o2"


def fixed_by_position(review):
    values = {}
    for target in review:
        indices = target["source_question_indices"]
        require(len(indices) == 1 and indices[0] not in values, "fixed_review_position")
        values[indices[0]] = target
    return values


def option_rows(labels):
    return [{"id": "o" + str(i), "content": rich(label)} for i, label in enumerate(labels, 1)]


def checked_target(target):
    require(target["target_id"] and not target["needs_teacher_manual"] and not target["reference_answer_issue"],
            "fixed_review_unresolved")
    require(target["student_explanation"] and any(e.get("resolved_ref") for e in target["evidence"]),
            "fixed_textbook_reference_missing")
    return target


def source_metadata(row):
    return {"source": row["source"], "unit": row["unit"], "fingerprints": row["original"]}


def matching_measurements(row):
    blocks = row["blocks"]
    require([b["type"] for b in blocks] == ["paragraph", "paragraph", "table"], "matching_measurement_layout")
    domain = re.findall(r"([ㄅㄆㄇ])([^ㄅㄆㄇ]+)", blocks[1]["sourceText"])
    require([code for code, _ in domain] == list("ㄅㄆㄇ"), "matching_domain")
    labels = [code + "　" + text.strip() for code, text in domain]
    grid = blocks[2]["rows"]
    require(len(grid) == 3 and all(len(r) == 2 and not r[1]["text"] for r in grid),
            "matching_table_slots")
    native = row["sourceContent"]["questions"]
    require(len(native) == 1 and not native[0]["options"], "matching_source_shape")
    questions, evidence = [], []
    references = row["fixedReview"]
    teacher = teacher_values(row)
    require(len(references) == len(teacher) == len(native[0]["answers"]) == 3, "matching_key_count")
    require(set(teacher.values()) == {"ㄅ", "ㄆ", "ㄇ"}, "matching_key_bijection")
    for i, (cells, publisher, raw_target) in enumerate(zip(grid, native[0]["answers"], references, strict=True), 1):
        target = checked_target(raw_target)
        literal = normalize(target["reference_answer"])
        stem = ORDINAL.fullmatch(cells[0]["text"])
        require(stem and int(normalize(stem[1])) == i and target["source_question_indices"] == [1],
                "matching_source_position")
        require(len(publisher) == 1 and normalize(publisher[0]) == literal == f"({i}){teacher[i]}",
                "matching_teacher_key")
        require(normalize(cells[0]["text"]) in normalize(native[0]["stem"]), "matching_word_cell")
        qid = f'hlg3s_{row["source"][-8:]}_table_{i}'
        questions.append({"id": qid, "type": "single", "prompt": rich(stem[2]), "options": option_rows(labels),
                          "answer": {"option_id": "o" + str("ㄅㄆㄇ".index(teacher[i]) + 1)},
                          "explanation": rich(target["student_explanation"])})
        evidence.append({"question": qid, "fixed_target": target["target_id"], "word_answer": teacher[i],
                         "publisher_answer": publisher[0], "fixed_review_answer": target["reference_answer"],
                         "textbook": target["evidence"]})
    return {**source_metadata(row), "material": table_material(blocks), "questions": questions, "evidence": evidence}


def table_checkbox(row):
    shared, word = separate(row["blocks"])
    require(len(row["fixedReview"]) == 1, "checkbox_fixed_target_count")
    target = checked_target(row["fixedReview"][0])
    teacher = teacher_values(row)
    expected = set(teacher)
    source = row["sourceContent"]["questions"]
    require(len(word) == len(source) >= 2 and target["source_question_indices"] == list(range(1, len(word)+1)),
            "checkbox_source_count")
    require(expected and expected <= set(target["source_question_indices"])
            and all(value == "ˇ" for value in teacher.values()), "checkbox_teacher_key")
    fixed_tokens = normalize(target["reference_answer"]).split(";")
    require(fixed_tokens == [f"({i})ˇ" for i in sorted(expected)], "checkbox_fixed_key")
    labels = []
    for item, original in zip(word, source, strict=True):
        publisher = original["answers"]
        require(publisher == ([["ˇ"]] if item["number"] in expected else []), "checkbox_publisher_key")
        require(not item["tails"] and not original["options"] and
                normalize(re.sub(r"【\s*】", "", original["stem"])) == normalize(item["stem"]),
                "checkbox_word_alignment")
        labels.append(item["stem"])
    qid = f'hlg3s_{row["source"][-8:]}_table_1'
    answers = ["o" + str(i) for i in sorted(expected)]
    question = {"id": qid, "type": "fields", "prompt": rich("勾選正確的敘述。"),
                "fields": [{"id": "selected", "input": "set", "label": "可複選", "options": option_rows(labels)}],
                "answer": {"format": "fields-v1", "fields": {"selected": [answers]}},
                "explanation": rich(target["student_explanation"])}
    evidence = [{"question": qid, "fixed_target": target["target_id"], "word_answer": teacher,
                 "publisher_answer": [p["answers"] for p in source],
                 "fixed_review_answer": target["reference_answer"], "textbook": target["evidence"]}]
    return {**source_metadata(row), "material": shared, "questions": [question], "evidence": evidence}


def build(row):
    if row["originType"] == ["配合題"]:
        return matching_measurements(row)
    if {t["kind"] for t in row["fixedReview"]} == {"multiple_choice"}:
        return table_checkbox(row)
    if row["originType"] not in (["閱讀測驗"], ["實驗題組"], ["勾選題"]):
        raise ValueError("separate_answer_layout")
    native = row["sourceContent"]
    if not native or not native["questions"]:
        raise ValueError("source_question_missing")
    kinds = {t["kind"] for t in row["fixedReview"]}
    is_boolean = kinds == {"true_false"}
    require(is_boolean or kinds <= {"single_choice", "single_choice_code"}, "separate_answer_layout")
    shared, word = separate(row["blocks"])
    fixed = fixed_by_position(row["fixedReview"])
    teacher = teacher_values(row)
    require(len(native["questions"]) == len(word) == len(fixed) == len(teacher) > 1, "source_count")
    questions, evidence = [], []
    for item, original in zip(word, native["questions"], strict=True):
        number = item["number"]
        reference = checked_target(fixed[number])
        prompt = item["stem"]
        raw_stem = re.sub(r"【\s*】", "", original["stem"])
        require(len(original["answers"]) == 1 and len(original["answers"][0]) == 1, "publisher_key")
        source_answer = original["answers"][0][0]
        if is_boolean:
            require(not item["tails"] and not original["options"] and normalize(raw_stem) == normalize(prompt),
                    "word_stem")
            answer = boolean_value(teacher[number])
            require(answer == boolean_value(source_answer) == boolean_value(reference["reference_answer"]),
                    "teacher_boolean_key")
            labels = ["○", "×"]
        else:
            require(len(item["tails"]) == 1, "word_choice_line")
            labels = word_options(item["tails"][0])
            word_key = teacher[number]
            require(word_key.endswith("ˇ") and len(word_key) > 1, "teacher_explicit_choice_missing")
            normalized_labels = [normalize(x) for x in labels]
            require(word_key[:-1] in normalized_labels and normalize(source_answer) == word_key
                    and normalize(reference["reference_answer"]) == word_key, "teacher_choice_key")
            require(normalize(raw_stem).replace("☐", "□") == normalize(prompt + item["tails"][0]),
                    "word_choice_alignment")
            answer = "o" + str(normalized_labels.index(word_key[:-1]) + 1)
        qid = "hlg3s_" + row["source"][-8:] + "_table_" + str(number)
        questions.append({"id": qid, "type": "single", "prompt": rich(prompt),
                          "options": option_rows(labels), "answer": {"option_id": answer},
                          "explanation": rich(reference["student_explanation"])})
        evidence.append({"question": qid, "position": number, "fixed_target": reference["target_id"],
                         "word_answer": teacher[number], "publisher_answer": source_answer,
                         "fixed_review_answer": reference["reference_answer"], "textbook": reference["evidence"]})
    return {**source_metadata(row), "material": shared, "questions": questions, "evidence": evidence}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_audit", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    source = json.loads(args.source_audit.read_text(encoding="utf8"))["records"]
    results, passed = [], []
    for row in source:
        try:
            candidate = build(row)
        except (KeyError, ValueError) as error:
            results.append({"source": row["source"], "passed": False, "reason": str(error)})
        else:
            passed.append(candidate)
            results.append({"source": row["source"], "passed": True, "fields": len(candidate["questions"])})
    report = {"results": results, "candidates": passed}
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(json.dumps({"checked": len(source), "passed": len(passed),
                      "fields": sum(len(r["questions"]) for r in passed),
                      "held": Counter(r["reason"] for r in results if not r["passed"])}))


if __name__ == "__main__":
    main()
