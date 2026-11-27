import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

import pymupdf


CONCEPT_PAGE = {
    "this": (3, 42), "that": (3, 42), "good job": (3, 43),
    "ruler": (3, 45), "pencil": (3, 47), "black": (4, 55),
    "blue": (4, 58), "green": (4, 58), "red": (4, 58), "yellow": (4, 64),
}
COURSE_UNIT = {"398850": 3, "398851": 4, "398852": 5}
TEXTBOOK = {3: ("05_HWG1_U3.pdf", 39), 4: ("06_HWG1_U4.pdf", 53)}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def normalized(text):
    return " ".join(unicodedata.normalize("NFKC", text).replace("’", "'").split())


def choices(text, original=False):
    if original:
        require(text.lstrip().startswith("/"), "word_inline_image_position")
        text = text.lstrip()[1:]
    text = re.sub(r"【\s*】\s*$", "", text.strip())
    require(re.match(r"^\s*[□☐]", text), "checkbox_layout")
    options = [x.strip() for x in re.split("[□☐]", text)[1:]]
    require(len(options) == 2 and all(options) and len(set(map(normalized, options))) == 2, "checkbox_options")
    return options


def check(row, image, visual, textbook_dir):
    require(COURSE_UNIT.get(row["sections"][0]) and len(row["sections"]) == 1, "source_section")
    require(not row["audio"] and row["labels"] == ["Look and Check 看圖勾選正確的句子"], "source_layout")
    require(set(row["original"]) == {"preamble-question", "answer"}, "missing_word")
    word, key = (row["original"][part] for part in ("preamble-question", "answer"))
    require(digest(word["path"]) == word["sha"] and digest(key["path"]) == key["sha"], "word_sha_mismatch")
    require(word["inline_images"] == 1 and not any(word[k] for k in ("shapes", "fields", "tables")), "word_image_shape")
    require(not any(key[k] for k in ("inline_images", "shapes", "fields", "tables")), "answer_layout")
    require(digest(image["path"]) == image["sha256"] == visual["sha256"], "image_sha_mismatch")
    source = row["content"]["content"]
    require(not source.get("preamble") and len(source["questions"]) == 1, "native_question_group")
    native = source["questions"][0]
    options = choices(word["text"], original=True)
    require(not native["options"] and list(map(normalized, options)) == list(map(normalized, choices(native["stem"]))), "word_option_order")
    teacher = re.fullmatch(r"答案:\s*(.+)", normalized(key["text"]))
    require(teacher and len(native["answers"]) == 1 and len(native["answers"][0]) == 1
            and normalized(native["answers"][0][0]) == teacher[1], "teacher_answer_mismatch")
    concept = visual["concept"].lower()
    matching = [i for i, option in enumerate(options, 1) if re.search(r"\b" + re.escape(concept) + r"\b", normalized(option), re.I)]
    require(len(matching) == 1 and normalized(options[matching[0] - 1]) == teacher[1], "image_teacher_mismatch")
    unit, page = CONCEPT_PAGE[concept]
    name, first = TEXTBOOK[unit]
    pdf_file = textbook_dir / name
    index = page - first
    with pymupdf.open(pdf_file) as pdf:
        text = pdf[index].get_text()
    require(str(page) in (line.strip() for line in text.splitlines())
            and re.search(r"\b" + re.escape(concept) + r"\b", normalized(text), re.I), "textbook_concept_missing")
    return {"id": row["id"], "passed": True, "unit": COURSE_UNIT[row["sections"][0]], "options": options,
            "answer": matching[0], "observation": visual["observation"], "image": image,
            "primary": page, "book_file": name, "book_sha": digest(pdf_file), "pdf_page": index + 1}


def main():
    parser = argparse.ArgumentParser(description="Verify English picture sentences against Word, teacher keys and textbook pages.")
    for arg in ("originals", "images", "observations", "textbook-dir", "output"):
        parser.add_argument("--" + arg, required=True, type=Path)
    args = parser.parse_args()
    read = lambda path: json.loads(path.read_text(encoding="utf-8"))
    images = {item["id"]: item for item in read(args.images)}
    observations = read(args.observations)
    output = []
    for original in read(args.originals):
        source = original["id"]
        try:
            output.append(check(original, images[source], observations[source], args.textbook_dir))
        except ValueError as error:
            output.append({"id": source, "passed": False, "reason": str(error)})
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(Counter(row.get("reason", "pass") for row in output))


if __name__ == "__main__":
    main()
