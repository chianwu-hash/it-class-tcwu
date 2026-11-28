"""Prepare single-choice English letter-case questions from independently read Word records."""

import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

import pymupdf


PAGE_MAP = {
    "398850": ("05_HWG1_U3.pdf", 3, ((48, 10, "PQR"), (49, 11, "ST"))),
    "398851": ("06_HWG1_U4.pdf", 4, ((62, 10, "UVWX"), (63, 11, "YZ"))),
}
WORDS = {
    "pair": ("Read and Check 勾選正確的字母配對", "選出正確配對的大小寫字母。"),
    "circle": ("Read and Circle 圈出相對應的大／小寫字母", None),
}


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def normalize(text):
    return unicodedata.normalize("NFKC", text).strip()


def source_choices(text, shape):
    text = re.sub(r"【\s*】\s*$", "", normalize(text))
    if shape == "pair":
        require(re.fullmatch(r"(?:[□☐]\s*[A-Z][a-z]\s*){3}", text), "word_choice_layout")
        return None, re.findall(r"[A-Z][a-z]", text)
    match = re.fullmatch(r"([A-Za-z])\s*→\s*\(\s*([A-Za-z])\s+([A-Za-z])\s+([A-Za-z])\s*\)", text)
    require(match, "word_choice_layout")
    return match[1], list(match.groups()[1:])


def read_pages(directory):
    pages = {}
    for section, (name, unit, selected) in PAGE_MAP.items():
        src = directory / name
        digest = hashlib.sha256(src.read_bytes()).hexdigest()
        with pymupdf.open(src) as pdf:
            for printed, index, letters in selected:
                page = pdf[index - 1]
                content = page.get_text()
                require(str(printed) in (line.strip() for line in content.splitlines()), "printed_page_mismatch")
                for letter in letters:
                    require(re.search(r"(?<![A-Za-z])" + letter + r"\s*" + letter.lower() + r"(?![A-Za-z])", content),
                            "textbook_letter_pair_missing")
                    pages[section, letter] = {
                        "unit": unit, "primary": printed, "book_file": name,
                        "pdf_page": index, "book_sha": digest,
                    }
    return pages


def convert(row, pages):
    shape = next((name for name, (label, _) in WORDS.items() if row["labels"] == [label]), None)
    require(shape, "source_label")
    require(len(row["sections"]) == 1 and not row["audio"] and not row["literacy"], "source_section")
    original = row["original"]
    require(set(original) == {"preamble-question", "answer"}, "original_missing")
    for doc in original.values():
        require(not any(doc[key] for key in ("inline_images", "shapes", "tables", "fields")), "extra_word_content")
        require(hashlib.sha256(Path(doc["path"]).read_bytes()).hexdigest() == doc["sha"], "original_sha_mismatch")
    content = row["content"]["content"]
    require(not content.get("preamble") and len(content["questions"]) == 1, "native_question_group")
    question = content["questions"][0]
    require(not question["options"], "native_choice_layout")
    anchor, options = source_choices(original["preamble-question"]["text"], shape)
    require(source_choices(question["stem"], shape) == (anchor, options), "native_word_mismatch")
    original_options = options
    if shape == "pair":
        valid = [o for o in options if o[0].lower() == o[1]]
        prompt = WORDS[shape][1]
    else:
        require(all(o.isupper() != anchor.isupper() for o in options), "wrong_case_options")
        valid = [o for o in options if o.upper() == anchor.upper()]
        prompt = f"選出與 {anchor} 對應的{'小寫' if anchor.isupper() else '大寫'}字母。"
    require(len(valid) == 1, "ambiguous_letter_pair")
    answer = valid[0]
    key = re.fullmatch(r"答案:\s*([A-Za-z]{1,2})", normalize(original["answer"]["text"]))
    require(key and key[1] == answer and question["answers"] == [[answer]], "teacher_key_mismatch")
    if len(options) != len(set(options)):
        require(shape == "circle" and options.count(answer) == 1, "duplicate_source_choice")
        # Identical distractors represent one choice in the online exercise.
        options = list(dict.fromkeys(options))
        require(len(options) >= 2, "duplicate_source_choice")
    letter = answer[0].upper()
    page = pages.get((row["sections"][0], letter))
    require(page, "no_unit_textbook_pair")
    return {
        "passed": True, "id": row["id"], "section": row["sections"][0], "shape": shape,
        "prompt": prompt, "options": options, "answer": options.index(answer) + 1, "letter": letter,
        **({"original_options": original_options, "duplicate_distractor_merged": True}
           if options is not original_options else {}),
        **page,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--originals", type=Path, required=True)
    parser.add_argument("--textbook-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    pages = read_pages(args.textbook_dir)
    originals = json.loads(args.originals.read_text(encoding="utf-8"))
    report = []
    for row in originals:
        try:
            report.append(convert(row, pages))
        except ValueError as error:
            report.append({"passed": False, "id": row["id"], "reason": str(error)})
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(Counter(row.get("reason", row.get("shape")) for row in report))


if __name__ == "__main__":
    main()
