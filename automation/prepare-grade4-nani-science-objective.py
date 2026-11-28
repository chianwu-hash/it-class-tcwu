"""Read 南一四上自然 single-choice and true/false items from the publisher's Word bookmarks."""

import argparse
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import re
import unicodedata
from zipfile import BadZipFile, ZipFile

from lxml import etree

WORD = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
MARKS = "①②③④⑤⑥⑦⑧"
NON_TEXT = {"drawing", "object", "pict", "instrText", "fldSimple", "sym", "delText"}
TRUTH = {"○": 0, "╳": 1}


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def compact(text):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", text))


def digest(path):
    return sha256(path.read_bytes()).hexdigest()


def word_bookmarks(path):
    with ZipFile(path) as doc:
        nodes = list(etree.fromstring(doc.read("word/document.xml")).iter())
    ends = {node.get(f"{{{WORD}}}id"): i for i, node in enumerate(nodes) if node.tag == f"{{{WORD}}}bookmarkEnd"}
    spans = {}
    for i, node in enumerate(nodes):
        if node.tag != f"{{{WORD}}}bookmarkStart":
            continue
        name, number = (node.get(f"{{{WORD}}}{attr}") for attr in ("name", "id"))
        if re.fullmatch(r"a[0-9]{6}", name or "") and number in ends:
            require(name not in spans and i < ends[number], "duplicate_bookmark_or_range")
            spans[name] = (i, ends[number])
    return nodes, spans


def text_at(nodes, spans, bookmark):
    name = f"a{bookmark:06d}"
    require(name in spans, "missing_bookmark")
    start, end = spans[name]
    content = nodes[start + 1:end]
    require(not any(isinstance(n.tag, str) and etree.QName(n).localname in NON_TEXT for n in content),
            "nontext_word_content")
    return "".join(n.text or "" for n in content if n.tag == f"{{{WORD}}}t").strip()


def extract(row, word, section):
    nodes, spans, original, converted, original_sha, converted_sha = word
    require(row["Ans_Num"] == 1, "multiple_answer_positions")
    question, answer, explanation = [text_at(nodes, spans, row[f"Bookmarks_{key}"])
                                     for key in ("Question", "Answer", "Solution")]
    require(question and isinstance(row["Preview"], str)
            and compact(question) == compact(row["Preview"]), "word_and_catalog_prompt_differ")
    if row["Type_No"] == 39:
        require(answer in TRUTH and not any(c in MARKS for c in question), "true_false_key")
        return form(row, section, question, ["○", "×"], TRUTH[answer], explanation, original,
                    converted, original_sha, converted_sha)
    parts = re.split(f"([{MARKS}])", question)
    stem = parts[0].strip()
    options = [part.strip() for part in parts[2::2]]
    count = len(options)
    require(stem and 2 <= count <= 8 and parts[1::2] == list(MARKS[:count])
            and all(options) and len(set(map(compact, options))) == count, "choice_order")
    require(len(answer) == 1 and answer in MARKS[:count], "single_choice_key")
    return form(row, section, stem, options, MARKS.index(answer), explanation, original,
                converted, original_sha, converted_sha)


def form(row, section, stem, options, index, explanation, original, converted, original_sha, converted_sha):
    return {"passed": True, "source": str(row["Subject_No"]), "unit": int(section[0]), "section": section,
            "difficulty": row["Level_Name"], "stem": stem, "options": options, "key": index,
            "teacherExplanation": explanation, "sourceFiles": {str(original): original_sha, str(converted): converted_sha},
            "bookmarks": [row[f"Bookmarks_{key}"] for key in ("Question", "Answer", "Solution")]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("metadata", "originals", "converted", "output"):
        parser.add_argument("--" + name, required=True, type=Path)
    args = parser.parse_args()
    md = json.loads(args.metadata.read_text(encoding="utf-8-sig"))
    course = next(row for row in md["Course"] if row["Course_No"] == 1153)
    require(course["Date"] == 115 and course["Eng_WordFile_Name"] == "150703", "publisher_edition")
    sections = {row["Directory_No"]: row["Section12"] for row in md["Directory"]
                if row["Course_No"] == course["Course_No"] and row["Section_1"] in (3, 4)}
    source = [row for row in md["Subject"] if row["Course_No"] == course["Course_No"]
              and row["Directory_No"] in sections and row["Type_No"] in (39, 92)]
    require(len({row["Subject_No"] for row in source}) == len(source), "duplicate_source_key")
    output, documents = [], {}
    for row in source:
        section = sections[row["Directory_No"]]
        name = f"{course['Eng_WordFile_Name']}-{section.replace('-', '')}-{row['Type_No']}"
        try:
            if name not in documents:
                original = args.originals / (name + ".doc")
                converted = args.converted / (name + ".docx")
                documents[name] = (*word_bookmarks(converted), original, converted, digest(original), digest(converted))
            output.append(extract(row, documents[name], section))
        except (BadZipFile, KeyError, OSError, ValueError) as error:
            output.append({"passed": False, "source": str(row["Subject_No"]), "section": section, "reason": str(error)})
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(dict(Counter(row["section"] if row["passed"] else row["reason"] for row in output)))


if __name__ == "__main__":
    main()
