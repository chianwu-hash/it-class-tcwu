"""Replay the Kang Hsuan Grade 3 social studies source and teacher-key checks."""
import argparse
from collections import Counter, defaultdict
from hashlib import sha256
import json
from pathlib import Path
import re
import sys
import unicodedata

from lxml import etree

sys.path.insert(0, str(Path(__file__).parent / "lib"))
from quiz_native_docx import Native, ns, split_options


LESSONS = ("0301", "0302", "0401", "0402", "0403")
LAYOUTS = {"37": "true_false", "38": "single"}
SYMBOLS = {"○": True, "×": False, "╳": False}


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def compact(text):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", text))


def sha(path):
    return sha256(path.read_bytes()).hexdigest()


def plain(content):
    return not content["media"] and all(
        p["type"] == "paragraph" and all(run["type"] == "text" for run in p["runs"])
        for p in content.get("layout", [])
    )


def source_row(item, file, publisher_answers, details, output):
    code = item["QUES_TYPE"]
    require(code in LAYOUTS and item["ANS_NUM"] == 1, "other_layout")
    require(len(publisher_answers) == len(details) == 1, "publisher_record_count")
    native = Native(file, output)
    try:
        body = native.root.find("w:body", ns)
        tables = body.findall("w:tbl", ns)
        require(len(tables) == 1 and all(
            child is tables[0] or etree.QName(child).localname in ("p", "sectPr")
            and not child.xpath(".//w:t[normalize-space()]|.//w:drawing|.//w:pict", namespaces=ns)
            for child in body), "word_body_layout")
        rows = tables[0].findall("w:tr", ns)
        require(len(rows) == 2, "word_table_rows")
        headers = ["".join(c.xpath(".//w:t/text()", namespaces=ns)) for c in rows[0].findall("w:tc", ns)]
        require(headers == ["題目", "答案", "解析"], "word_table_headers")
        cells = rows[1].findall("w:tc", ns)
        require(len(cells) == 3, "word_table_columns")
        stem, teacher, explanation = (native.nodes(c) for c in cells)
        require(all(plain(c) for c in (stem, teacher, explanation)), "original_media_or_table")
        require(teacher["text"].startswith("《答案》"), "teacher_key_header")
        teacher_value = compact(teacher["text"].removeprefix("《答案》"))
        key = compact(publisher_answers[0])
        require(key == teacher_value, "teacher_key_mismatch")
        expected = compact(stem["text"] + teacher["text"] + explanation["text"])
        require(expected == compact(details[0]), "publisher_prompt_or_solution_mismatch")
        if code == "37":
            require(key in SYMBOLS, "teacher_boolean_key")
            options = ["○", "╳"]
            position = 1 if SYMBOLS[key] else 2
            prompt = "判斷下面的敘述是否正確。\n" + stem["text"].strip()
            require(not re.search(r"[①②③④]", stem["text"]), "extra_answer_positions")
        else:
            prompt_cell, *options_cells = split_options(stem)
            prompt = prompt_cell["text"].strip()
            options = [c["text"].strip() for c in options_cells]
            require(all(options) and len({compact(x).rstrip("。.!！") for x in options}) == len(options),
                    "duplicate_or_empty_options")
            require(key.isascii() and key.isdigit() and 1 <= int(key) <= len(options), "teacher_choice_key")
            position = int(key)
        require(bool(prompt), "empty_prompt")
    finally:
        native.z.close()
    return {
        "source": item["QUES_NO"],
        "unit": int(item["LESN_NUM"][:2]),
        "lesson": item["LESN_NUM"],
        "knowledge": item["KNOW_SPOT"],
        "difficulty": {"A": -3, "B": 0, "C": 3}[item["DIFC_CODE"]],
        "layout": LAYOUTS[code],
        "prompt": prompt,
        "options": options,
        "answer": position,
        "explanation": explanation["text"].removeprefix("詳解：").strip(),
        "source_sha256": sha(file),
        "source_file": str(file),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("metadata", "baseline-mdb", "archive-mdb", "originals", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    args = parser.parse_args()
    assert sha(args.baseline_mdb) == sha(args.archive_mdb), "archived database differs from export’s source"
    md = json.loads(args.metadata.read_text(encoding="utf8"))
    items = [
        item for item in md["QuesMaster"]
        if item["SUBJ_CODE"] == "SO" and item["CLASS_TERM"] == "1501" and item["LESN_NUM"] in LESSONS
    ]
    ids = {item["QUES_NO"] for item in items}
    assert len(items) == len(ids) == 686
    answers, details = defaultdict(list), defaultdict(list)
    for row in md["QuesAnswer"]:
        if row["QUES_NO"] in ids:
            answers[row["QUES_NO"]].append(row["QUES_ANSW"])
    for row in md["QuesDetail"]:
        if row["QUES_NO"] in ids:
            details[row["QUES_NO"]].append(row["QUES_DETL"])
    originals = defaultdict(list)
    for path in args.originals.rglob("*.docx"):
        if path.stem in ids:
            originals[path.stem].append(path)
    assert set(originals) == ids and all(len(v) == 1 for v in originals.values())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    result = []
    for item in sorted(items, key=lambda row: row["QUES_NO"]):
        sid = item["QUES_NO"]
        file, = originals[sid]
        try:
            row = source_row(item, file, answers[sid], details[sid], args.output.parent)
            result.append({"passed": True, **row})
        except (ValueError, KeyError) as exc:
            result.append({"passed": False, "source": sid, "lesson": item["LESN_NUM"], "type_code": item["QUES_TYPE"],
                           "source_sha256": sha(file), "reason": str(exc)})
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf8")
    print(Counter(row.get("reason",row.get("layout")) for row in result))


if __name__ == "__main__":
    main()
