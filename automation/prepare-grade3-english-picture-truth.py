"""Convert verified Grade 3 English picture judgments into one shared rule."""

import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

import pymupdf


UNITS = {"398850": 3, "398851": 4}
LABELS = {
    "Look and Mark O or X 圖文相符畫○，不符畫╳": "sentence",
    "Look and Mark O or X 圖與字相符畫○，不符畫╳": "word",
}
ANSWERS = {"○": True, "◯": True, "╳": False, "×": False}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def normalize(text):
    return " ".join(unicodedata.normalize("NFKC", text).replace("’", "'").replace("��", "'").split())


def actual_text(text):
    normalized = unicodedata.normalize("NFKC", text).replace("\x01", "").replace("/", "")
    match = re.fullmatch(r"\s*\(\s*\)\s*([\s\S]+?)\s*", normalized)
    require(match and match[1].strip(), "word_prompt_layout")
    return "\n".join(line.strip() for line in match[1].splitlines() if line.strip())


def textbook_evidence(number, terms, directory):
    require(39 <= number <= 66 and terms, "textbook_scope")
    filename, first = ("05_HWG1_U3.pdf", 39) if number < 53 else ("06_HWG1_U4.pdf", 53)
    path = directory / filename
    index = number - first
    with pymupdf.open(path) as pdf:
        text = pdf[index].get_text()
    require(str(number) in (line.strip() for line in text.splitlines()), "printed_page_missing")
    require(all(re.search(r"\b" + re.escape(normalize(term)) + r"\b", normalize(text), re.I) for term in terms),
            "textbook_evidence_missing")
    return {"printed": number, "index": index + 1, "filename": filename, "source_sha256": digest(path)}


def adapt(source, image, review, textbooks):
    label = source["labels"]
    require(len(label) == 1 and label[0] in LABELS and not source["audio"], "source_kind")
    require(len(source["sections"]) == 1 and source["sections"][0] in UNITS, "source_section")
    original = source["original"]
    require(set(original) == {"answer", "preamble-question"}, "original_missing")
    word, key = (original[name] for name in ("preamble-question", "answer"))
    require(all(digest(doc["path"]) == doc["sha"] for doc in original.values()), "original_sha_mismatch")
    require(digest(word["media_docx"]) == word["media_docx_sha"], "word_image_container_mismatch")
    require(word["inline_images"] == 1 and not any(word[k] for k in ("shapes", "tables", "fields")), "word_image_shape")
    require(not any(key[k] for k in ("inline_images", "shapes", "tables", "fields")), "teacher_key_shape")
    require(digest(image["path"]) == image["sha256"] == review["sha256"], "image_sha_mismatch")
    require(type(review["matches"]) is bool and review["observation"].strip(), "image_observation_missing")
    content = source["content"]["content"]
    require(not content.get("preamble") and len(content["questions"]) == 1, "question_group")
    native = content["questions"][0]
    text = actual_text(word["text"])
    require(not native["options"] and normalize(text) == normalize(actual_text(native["stem"])), "word_prompt_mismatch")
    if LABELS[label[0]] == "word":
        require(re.fullmatch(r"[A-Za-z]+", text), "single_word_expected")
    teacher = re.fullmatch(r"答案:\s*([○◯╳×])", normalize(key["text"]))
    require(teacher and len(native["answers"]) == 1 and len(native["answers"][0]) == 1
            and native["answers"][0][0] in ANSWERS and ANSWERS[teacher[1]] == ANSWERS[native["answers"][0][0]] == review["matches"],
            "teacher_image_key_conflict")
    refs = [textbook_evidence(number, terms, textbooks) for number, terms in review["references"]]
    require(refs and len({r["printed"] for r in refs}) == len(refs), "textbook_references_missing")
    return {"id": source["id"], "passed": True, "shape": LABELS[label[0]], "unit": UNITS[source["sections"][0]],
            "text": text, "matches": review["matches"], "observation": review["observation"], "image": image, "references": refs}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("originals", "images", "observations", "textbook-dir", "output"):
        parser.add_argument("--" + name, required=True, type=Path)
    args = parser.parse_args()
    read = lambda path: json.loads(path.read_text(encoding="utf-8"))
    images = {item["id"]: item for item in read(args.images)}
    reviews = read(args.observations)
    output = []
    for source in read(args.originals):
        id = source["id"]
        try:
            output.append(adapt(source, images[id], reviews[id], args.textbook_dir))
        except ValueError as error:
            output.append({"id": id, "passed": False, "reason": str(error)})
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(Counter(row.get("reason", row.get("shape")) for row in output))


if __name__ == "__main__":
    main()
