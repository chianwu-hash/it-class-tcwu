"""Validate Hanlin picture spelling, word writing, and word-bank copying."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import unicodedata

WORD_LAYOUTS = {"Look and Spell 看圖拼出正確的單字": "spell",
                "Look and Write 看圖寫出正確的單字": "write",
                "Look and Copy 看圖抄寫正確的單字": "copy"}
GUIDE = "fbd05b83413f5f01712aa80e8205411a4f0da8429e7533b7c997b0b18625a740"
BOOK_WORDS = {
    **dict.fromkeys(("apples", "bananas", "oranges", "watermelons", "hamburgers", "hot dogs", "sandwiches"), 46),
    **dict.fromkeys(("juice", "milk", "tea", "water", "cake", "ice cream", "pizza", "rice"), 60),
}
ANSWERS = re.compile(r"【\s*】")


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def text(value):
    return " ".join(unicodedata.normalize("NFKC", value).split())


def original_bytes(path, expected, size=None):
    data = Path(path).read_bytes()
    require(hashlib.sha256(data).hexdigest() == expected and (size is None or len(data) == size), "source_sha256")
    return data


def adapt(row, kind, media, observation):
    require(len(row["units"]) == 1 and row["units"][0] in (3, 4) and not row["audioResources"], "source_scope")
    original = json.loads(original_bytes(row["payloadPath"], row["payloadSha"]))["content"]
    require(original == row["native"] and not original.get("preamble")
            and len(original["questions"]) == 1, "native_question_group")
    native = original["questions"][0]
    prompt, key = (row["original"][key] for key in ("preamble-question", "answer"))
    for doc in (prompt, key):
        original_bytes(doc["path"], doc["sha"])
        require(not doc["shapes"] and not doc["fields"], "unmapped_word_markup")
    require(not key["inline_images"] and not key["tables"] and not native["options"], "unmapped_teacher_layout")
    pictures = media.get("images", [])
    require(len(pictures) == prompt["inline_images"] == (1 if kind == "spell" else 2), "original_image_count")
    original_bytes(media["container"], media["container_sha"])
    for picture in pictures:
        original_bytes(picture["path"], picture["sha256"], picture["bytes"])
    art = pictures[0]
    require(art["sha256"] == observation["image"], "visual_evidence_mismatch")
    if observation.get("hold"):
        raise ValueError(observation["hold"])
    seen = observation["word"]
    require(seen in BOOK_WORDS, "illustration_word_outside_textbook")
    if kind != "spell":
        require(pictures[1]["sha256"] == GUIDE, "not_blank_writing_guide")
    raw_key = text(key["text"])
    require(raw_key.startswith("答案:"), "missing_teacher_key")
    answers = [value.strip() for value in raw_key.removeprefix("答案:").split(";")]
    require(native["answers"] == [[part] for part in answers]
            and len(ANSWERS.findall(native["stem"])) == len(answers), "native_teacher_or_blank_mismatch")

    word_stem = prompt["text"].strip()
    native_stem = text(ANSWERS.sub("", native["stem"]))
    if kind == "spell":
        require(word_stem.startswith("/") and not prompt["tables"], "unexpected_spelling_layout")
        raw = text(word_stem.removeprefix("/")).replace(" ", "")
        require(re.fullmatch(r"[a-z_]+", raw) and raw == native_stem.replace(" ", "")
                and all(re.fullmatch("[a-z]", part) for part in answers)
                and raw.count("_") == len(answers), "spelling_blank_positions")
        slots = iter(answers)
        filled = "".join(next(slots) if char == "_" else char for char in raw)
        require(filled == seen.replace(" ", ""), "original_visual_and_teacher_disagree")
        marks = iter(range(1, len(answers) + 1))
        offset = 0
        parts = []
        for word in seen.split():
            part = raw[offset:offset + len(word)]
            parts.append(" ".join(f"〔{next(marks)}〕" if char == "_" else char for char in part))
            offset += len(word)
        instructions = "看圖，依序填入缺少的英文字母。\n" + "　".join(parts)
    elif kind == "copy":
        layout = re.fullmatch(r"/\s*\r(.+?)\r\x07\r\x07/\s*", word_stem)
        require(layout is not None and prompt["tables"] == 1, "unmapped_word_bank")
        bank = [text(word) for word in layout[1].split("\u3000")]
        require(len(bank) == len(set(bank)) == 3 and all(term in BOOK_WORDS for term in bank)
                and " ".join(bank) == native_stem and seen in bank and answers == [seen], "original_word_bank_differs")
        instructions = "看圖，從下面找出正確的英文單字並抄寫。\n" + "　".join(bank)
    else:
        require(word_stem == "//" and not native_stem and not prompt["tables"] and answers == [seen],
                "original_visual_and_teacher_disagree")
        instructions = "看圖，寫出正確的英文單字。"
    return {"prompt": instructions, "answers": answers, "art": art, "seen": seen, "page": BOOK_WORDS[seen]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("originals", "images", "observations", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    args = parser.parse_args()
    originals, images, observations = [json.loads(file.read_text(encoding="utf8"))
                                      for file in (args.originals, args.images, args.observations)]
    results = []
    for row in originals:
        if len(row["types"]) != 1 or row["types"][0] not in WORD_LAYOUTS:
            continue
        sid, kind = row["source"], WORD_LAYOUTS[row["types"][0]]
        result = {"source": sid, "unit": row["units"][0], "kind": kind}
        try:
            result.update(adapt(row, kind, images[sid], observations[sid]), passed=True)
        except (OSError, ValueError) as error:
            result.update(passed=False, reason=str(error))
        results.append(result)
    args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(sum(row["passed"] for row in results), len(results))


if __name__ == "__main__":
    main()
