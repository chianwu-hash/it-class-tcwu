"""Verify source spelling and writing blanks without publishing the paper writing guides."""
import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

import pymupdf

PAGE = {
    "book": 45, "eraser": 45, "marker": 45, "pen": 44, "pencil": 47, "ruler": 45,
    **dict.fromkeys(("black", "blue", "green", "red", "white", "yellow"), 61),
    **dict.fromkeys(("pig", "queen", "rabbit"), 48),
    **dict.fromkeys(("sun", "turtle"), 49),
    **dict.fromkeys(("fox", "watch", "vest"), 62),
    **dict.fromkeys(("yo-yo", "zebra"), 63),
}
UNITS = {"398850": 3, "398851": 4}


def norm(text):
    return " ".join(unicodedata.normalize("NFKC", text).split())


def hash_file(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def reference(word, path):
    page = PAGE[word]
    file, offset = ("05_HWG1_U3.pdf", 39) if page < 53 else ("06_HWG1_U4.pdf", 53)
    local = path / file
    index = page - offset
    with pymupdf.open(local) as pdf:
        text = pdf[index].get_text()
    require(str(page) in [line.strip() for line in text.splitlines()] and re.search(r"\b" + re.escape(word) + r"\b", norm(text), re.I), "textbook_concept")
    return {"printed": page, "source": file, "index": index + 1, "sha": hash_file(local)}


def adapt(row, assets, observed, textbooks):
    label = row["labels"][0]
    shape = "copy" if label.startswith("Look and Copy") else "spell" if label.startswith("Look and Spell") else "phonics"
    original = row["original"]
    require(set(original) == {"preamble-question", "answer"}, "word_original")
    word, key = original["preamble-question"], original["answer"]
    require(all(hash_file(doc["path"]) == doc["sha"] for doc in original.values()), "source_sha")
    require(hash_file(assets["container"]) == assets["container_sha"], "image_container")
    require(not any(key[k] for k in ("tables", "fields", "inline_images", "shapes")), "teacher_layout")
    images = assets["images"]
    require(len(images) == word["inline_images"] and all(hash_file(a["path"]) == a["sha256"] for a in images), "image_sha")
    require(observed["sha256"] == images[0]["sha256"] and observed["guides"] == [m["sha256"] for m in images[1:]], "image_review")
    require(len(row["sections"]) == 1 and not row["audio"], "source_section")
    content = row["content"]["content"]
    require(len(content["questions"]) == 1 and not content.get("preamble"), "group")
    native = content["questions"][0]
    require(not native["options"], "unexpected_option_bank")
    text = word["text"].strip()
    native_text = re.sub(r"【\s*】", "", native["stem"]).strip()
    key_match = re.fullmatch(r"答案:\s*([a-z]+(?:\s*;\s*[a-z]+)*)", norm(key["text"]))
    require(key_match, "teacher_literal")
    answers = [s.strip() for s in key_match[1].split(";")]
    require(native["answers"] == [[s] for s in answers], "teacher_key")
    full = observed["word"]
    if shape == "copy":
        require(len(images) == 2 and word["tables"] == 1 and len(answers) == 1, "copy_word_layout")
        match = re.fullmatch(r"/\s*\r([a-z\s]+?)\r\x07\r\x07/\s*", text)
        require(match and norm(match[1]) == norm(native_text), "copy_word_bank")
        bank = norm(match[1]).split()
        require(len(bank) == 3 and len(set(bank)) == 3 and full in bank and answers == [full], "copy_word_answer")
        prompt = "看圖，從下面三個單字中找出正確的單字，並寫在答案欄。\n" + "　".join(bank)
    else:
        require(not word["tables"] and all(len(s) == 1 for s in answers), "letter_slots")
        require(text.startswith("/"), "word_image_position")
        raw = norm(text[1:]).replace(" ", "")
        if shape == "phonics":
            require(raw.replace("/", "") == norm(native_text).replace(" ", "") and len(images) == 1 + len(answers), "original_phonics_layout")
            pattern = raw.replace("/", "_")
        else:
            require(len(images) == 1 and raw == norm(native_text).replace(" ", ""), "original_spelling_layout")
            pattern = raw
        require(len(answers) == pattern.count("_") and re.fullmatch(r"[a-z_\-]+", pattern), "blank_positions")
        fill = iter(answers)
        require("".join(next(fill) if c == "_" else c for c in pattern) == full, "illustration_spelling_conflict")
        index = iter(range(1, len(answers)+1))
        prompt = "看圖，填入缺少的小寫字母。\n" + " ".join(f"〔{next(index)}〕" if c == "_" else c for c in pattern)
    return {"id": row["id"], "passed": True, "unit": UNITS[row["sections"][0]], "shape": shape, "image": images[0],
            "answers": answers, "prompt": prompt, "word": full, "reference": reference(full, textbooks)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for n in ("originals", "images", "observations", "textbook-dir", "output"):
        parser.add_argument("--"+n, type=Path, required=True)
    a = parser.parse_args()
    read = lambda p: json.loads(p.read_text(encoding="utf-8"))
    media, observed = read(a.images),read(a.observations)
    output = []
    for row in read(a.originals):
        id = row["id"]
        if id not in observed:
            continue
        try:
            output.append(adapt(row, media[id], observed[id], a.textbook_dir))
        except ValueError as error:
            output.append({"id": id, "passed": False, "reason": str(error)})
    a.output.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(Counter(row.get("shape", row.get("reason")) for row in output))


if __name__ == "__main__":
    main()
