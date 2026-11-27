"""Map the three publisher vocabulary layouts to one single-choice contract."""
import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

import pymupdf

COLORS = {"black", "blue", "green", "red", "white", "yellow"}
OBJECTS = {"book", "eraser", "marker", "pen", "pencil", "ruler"}
TOPIC = {**dict.fromkeys(COLORS, "color"), **dict.fromkeys(OBJECTS, "object")}
PAGE = {**dict.fromkeys(COLORS, 61), "marker": 45, "ruler": 45, "book": 45, "eraser": 45, "pencil": 47, "pen": 44}
UNIT = {"398850": 3, "398851": 4, "398852": 5}


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def text(value):
    return " ".join(unicodedata.normalize("NFKC", value).replace("’", "'").split())


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def references(word_set, nearby, book):
    expected = {}
    for word in word_set:
        expected.setdefault(PAGE[word], set()).add(word)
    if nearby:
        expected[42] = {"what"}
    refs = []
    for page, words in sorted(expected.items()):
        name, start = ("05_HWG1_U3.pdf", 39) if page < 53 else ("06_HWG1_U4.pdf", 53)
        src = book / name
        with pymupdf.open(src) as pdf:
            raw = pdf[page - start].get_text()
        require(str(page) in (l.strip() for l in raw.splitlines()), "textbook_page")
        require(all(re.search(r"\b" + re.escape(w) + r"\b", raw, re.I) for w in words), "textbook_word")
        refs.append({"page": page, "file": name, "sha": sha(src), "index": page - start + 1})
    return refs


def convert(row, media, observation, book):
    label = row["labels"][0]
    kind = "picture" if label.startswith("Look and Choose 看圖") else "odd" if label.startswith("Look and Choose 選出") else "images"
    require(len(row["sections"]) == 1 and not row["audio"], "source_context")
    original = row["original"]
    require(set(original) == {"preamble-question", "answer"}, "missing_word")
    word, key = (original[k] for k in ("preamble-question", "answer"))
    require(all(sha(d["path"]) == d["sha"] for d in original.values()), "word_hash")
    require(not any(word[k] for k in ("shapes", "tables")), "unknown_word_layout")
    require(not any(key[k] for k in ("shapes", "tables", "inline_images")), "unknown_answer_layout")
    data = row["content"]["content"]
    require(not data.get("preamble") and len(data["questions"]) == 1, "question_group")
    native = data["questions"][0]
    require(len(native["answers"]) == 1 and len(native["answers"][0]) == 1, "native_answer")
    images = media.get("images")
    require(images is not None and len(images) == word["inline_images"], "word_images")
    require(not images or sha(media["container"]) == media["container_sha"], "image_container")
    require(all(sha(x["path"]) == x["sha256"] for x in images), "image_sha")
    key_value = text(key["text"]).removeprefix("答案:").strip()
    if kind == "images":
        match = re.fullmatch(r"([\s\S]+?)\x0b\s*□\s*/\s*□\s*/\s*\x0b\s*□\s*/\s*", word["text"])
        require(match and len(images) == 3 and not key["fields"], "picture_position")
        stem = match[1].strip()
        native_stem = re.split(r"[□☐]", native["stem"])[0].strip()
        require(text(stem) == text(native_stem), "word_prompt")
        positions = {"左上圖": 1, "右上圖": 2, "左下圖": 3}
        require(key_value in positions and key_value == native["answers"][0][0], "teacher_position")
        require(observation["images"] == [a["sha256"] for a in images], "observed_images")
        keys = observation["words"]
        target, nearby = observation["target"], observation.get("nearby", False)
        require(re.search(r"\b" + re.escape(target) + r"\b", stem, re.I), "image_key_text")
        if nearby:
            require(re.search(r"\bthis\b", stem, re.I), "pointing_direction")
        expected = [i for i, value in enumerate(keys, 1) if value == target]
        require(expected == [positions[key_value]], "visual_key_conflict")
        prompt = "讀句子，選出符合的圖片。\n" + stem
        return kind, prompt, [], images, expected[0], references({w.split()[0] for w in keys}, nearby, book), observation["note"]
    options = [text(c) for c in word["text"].strip().split("\x15")[1:]]
    require(len(options) == 3 and len(set(options)) == 3 and all(o in TOPIC for o in options), "word_options")
    require(len(key["fields"]) == 1 and key_value == "\x15", "teacher_position")
    result = re.fullmatch(r"eq\s+\\o\(○,([ABC])\)", text(key["fields"][0]["code"]), re.I)
    require(result, "teacher_field")
    answer = ord(result[1].upper()) - ord("A") + 1
    if kind == "picture":
        require(len(images) == 1 and word["text"].lstrip().startswith("（　）/"), "word_image_position")
        require(native["options"] == options and native["answers"] == [[str(answer)]], "native_choice")
        require(observation["images"] == [images[0]["sha256"]] and observation["target"] == options[answer-1], "visual_key_conflict")
        return kind, "看圖，選出正確的單字。", options, images, answer, references({options[answer-1]}, False, book), observation["note"]
    circled = re.findall(r"[ⒶⒷⒸ]\s*([a-z]+)", native["stem"])
    require(not images and options == circled and native["answers"] == [["\x15"]], "native_odd_choice")
    counts = Counter(TOPIC[x] for x in options)
    require(sorted(counts.values()) == [1, 2] and counts[TOPIC[options[answer-1]]] == 1, "odd_word_key")
    return kind, "選出和另外兩個單字不同類的一個。", options, [], answer, references(set(options), False, book), f"「{options[answer-1]}」和另外兩個單字不同類。"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("originals", "images", "observations", "textbook-dir", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    a = parser.parse_args()
    read = lambda p: json.loads(p.read_text(encoding="utf-8"))
    observed, media = read(a.observations), read(a.images)
    out = []
    for row in read(a.originals):
        if not row["labels"][0].startswith(("Look and Choose", "Read and Check 勾選出正確的圖片")):
            continue
        id = row["id"]
        try:
            kind, prompt, options, used, answer, refs, note = convert(row, media[id], observed.get(id), a.textbook_dir)
            out.append({"id": id, "passed": True, "unit": UNIT[row["sections"][0]], "kind": kind,
                        "prompt": prompt, "options": options, "images": used, "answer": answer, "references": refs, "note": note})
        except ValueError as error:
            out.append({"id": id, "passed": False, "reason": str(error)})
    a.output.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(Counter(r.get("reason", r.get("kind")) for r in out))


if __name__ == "__main__":
    main()
