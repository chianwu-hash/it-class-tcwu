import argparse
import hashlib
import json
import re
import string
import unicodedata
from collections import Counter
from pathlib import Path

import pymupdf


SOURCES = {
    "398850": (3, 48, "05_HWG1_U3.pdf"),
    "398851": (4, 62, "06_HWG1_U4.pdf"),
}
LETTER_CHART = re.compile(r"\b" + r"\s+".join(string.ascii_uppercase) + r"\b")
SIGNS = {"○": True, "◯": True, "╳": False, "×": False}


def normalized(text):
    return unicodedata.normalize("NFKC", text).strip()


def word_letters(text):
    match = re.fullmatch(r"\(\s*\)\s*([A-Za-z])\s+([A-Za-z])\s+([A-Za-z])", normalized(text))
    if not match:
        raise ValueError("unknown_letter_layout")
    return match.groups()


def read_chart(directory, printed, filename):
    source = directory / filename
    with pymupdf.open(source) as pdf:
        candidates = [
            index
            for index, page in enumerate(pdf, 1)
            if str(printed) in (line.strip() for line in page.get_text().splitlines())
            and LETTER_CHART.search(page.get_text())
        ]
    if len(candidates) != 1:
        raise ValueError("chart_page_missing")
    return {
        "primary": printed,
        "pdf_page": candidates[0],
        "book_file": filename,
        "book_sha": hashlib.sha256(source.read_bytes()).hexdigest(),
    }


def check(original, charts):
    content = original["native"]["content"]
    if content.get("preamble") or len(content["questions"]) != 1:
        raise ValueError("unexpected_question_group")
    question = content["questions"][0]
    if question["options"] or len(question["answers"]) != 1 or len(question["answers"][0]) != 1:
        raise ValueError("unknown_answer_shape")
    if set(original["original"]) != {"preamble-question", "answer"}:
        raise ValueError("missing_original")
    prompt, key = (original["original"][name] for name in ("preamble-question", "answer"))
    if any(doc[field] for doc in (prompt, key) for field in ("inline_images", "shapes", "tables", "fields")):
        raise ValueError("original_has_extra_content")
    letters = word_letters(prompt["text"])
    if word_letters(question["stem"]) != letters:
        raise ValueError("word_stem_mismatch")
    match = re.fullmatch(r"答案:\s*([○◯╳×])", normalized(key["text"]))
    if not match or question["answers"][0][0] not in SIGNS:
        raise ValueError("unknown_teacher_key")
    a, b, c = (ord(letter.upper()) for letter in letters)
    if len({a, b, c}) != 3 or max(a, b, c) - min(a, b, c) != 2:
        raise ValueError("letters_are_not_three_consecutive_positions")
    ascending = a < b < c
    if SIGNS[match[1]] != ascending or SIGNS[question["answers"][0][0]] != ascending:
        raise ValueError("letter_order_key_conflict")
    unit, printed, _ = SOURCES[original["section"]]
    return {
        "passed": True,
        "id": original["id"],
        "section": original["section"],
        "unit": unit,
        "letters": list(letters),
        "answer": ascending,
        **charts[printed],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--originals", required=True, type=Path)
    parser.add_argument("--textbook-dir", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    originals = json.loads(args.originals.read_text(encoding="utf-8"))
    charts = {printed: read_chart(args.textbook_dir, printed, name) for _, printed, name in SOURCES.values()}
    report = []
    for original in originals:
        try:
            report.append(check(original, charts))
        except ValueError as error:
            report.append({"passed": False, "id": original["id"], "reason": str(error)})
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(Counter(row.get("reason", "pass") for row in report))


if __name__ == "__main__":
    main()
