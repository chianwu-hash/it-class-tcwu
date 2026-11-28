"""Verify word order, vocabulary writing, and word classification against Hanlin originals."""

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import unicodedata
from zipfile import ZipFile

GUIDE_SHA = "f6d34b3aa73e8831cbb38dc66030bd93987b9788a939c9591847a6659f01fedc"
TOKEN = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?|[,.!?]")
BLANK = re.compile(r"【\s*】")
ORDINAL_PLACE = re.compile(r"\(\s*\)")
WORD_LABELS = {"柳橙": "oranges", "香蕉": "bananas", "水": "water", "蛋糕": "cake",
               "蘋果": "apples", "牛奶": "milk", "果汁": "juice", "熱狗": "hot dogs"}
CLASSES = {
    **dict.fromkeys(("apples", "bananas", "oranges"), "fruits"),
    **dict.fromkeys(("juice", "milk", "water", "tea"), "drinks"),
    **dict.fromkeys(("ice cream", "pizza", "cake"), "food"),
}
LAYOUTS = {"Unscramble 句子重組": "words", "Sequence 句子排序": "sentences",
           "Read and Write 看中文寫出單字": "write", "Look and Choose 選出不同主題的單字": "odd"}


def normalized(value):
    return unicodedata.normalize("NFKC", value).replace("’", "'")


def text(value):
    return " ".join(normalized(value).split())


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def verified_bytes(path, digest):
    data = path.read_bytes()
    require(hashlib.sha256(data).hexdigest() == digest, "source_bytes_changed")
    return data


def guide_file(row, legacy_root, count):
    path = Path(row["path"])
    source = path if path.suffix.lower() == ".docx" else legacy_root / (path.stem + ".docx")
    with ZipFile(source) as word:
        assets = [word.read(n) for n in word.namelist() if n.startswith("word/media/") and not n.endswith("/")]
        require(len(assets) == 1 and hashlib.sha256(assets[0]).hexdigest() == GUIDE_SHA, "not_blank_writing_guide")
    require(row["inline_images"] == count and not row["fields"], "unknown_guide_layout")
    return str(source)


def teacher_text(source, native):
    require(not source["fields"], "unexpected_teacher_markup")
    raw = text(source["text"])
    require(raw.startswith("答案:"), "missing_teacher_answer")
    answer = raw.removeprefix("答案:").strip()
    require(native["answers"] and len(native["answers"]) == 1 and len(native["answers"][0]) == 1
            and text(native["answers"][0][0]) == answer, "word_and_native_key_differ")
    return answer


def ordinal(field):
    match = re.fullmatch(r"eq\s+\\o\(○,([A-C])\)", normalized(field["code"]).strip(), re.I)
    require(match is not None, "unknown_word_option_marker")
    return "abc".index(match[1].lower())


def words(prompt, key, native, legacy_root):
    guide = guide_file(prompt, legacy_root, 2)
    first, *after = prompt["text"].strip().split("\x0b")
    require([part.strip() for part in after] == ["/", "", "/"], "unknown_word_guide_placement")
    tiles = [text(piece) for piece in first.split("/")]
    native_tiles = [text(piece) for piece in BLANK.sub("", native["stem"]).split("/")]
    require(tiles == native_tiles and 3 <= len(tiles) <= 8 and len(set(tiles)) == len(tiles), "unknown_word_tiles")
    require(all(TOKEN.fullmatch(tile) for tile in tiles), "nonword_tile")
    answer = teacher_text(key, native)
    target = TOKEN.findall(answer)
    require(Counter(target) == Counter(tiles) and target[-1] in ".!?"
            and not TOKEN.sub("", answer).strip(), "teacher_answer_not_exact_tile_permutation")
    return {"tiles": tiles, "order": [tiles.index(word) for word in target], "answer": answer, "guide": guide}


def sentences(prompt, key, native):
    require(not prompt["inline_images"] and not prompt["fields"], "unmapped_sentence_decoration")
    lines = [text(line) for line in normalized(prompt["text"]).strip().splitlines()]
    require(3 <= len(lines) <= 6 and all(ORDINAL_PLACE.match(line) for line in lines), "unknown_sentence_ordinal")
    tiles = [ORDINAL_PLACE.sub("", line, count=1).strip() for line in lines]
    require(all(tiles) and len(set(tiles)) == len(tiles)
            and text(prompt["text"]) == text(native["stem"]), "word_and_native_sentences_differ")
    key_order = teacher_text(key, native).split(";")
    require(sorted(key_order) == [str(i) for i in range(1, len(tiles) + 1)], "not_a_unique_sentence_order")
    order = [key_order.index(str(i)) for i in range(1, len(tiles) + 1)]
    return {"tiles": tiles, "order": order, "answer": " ".join(tiles[i] for i in order)}


def write_word(prompt, key, native, legacy_root):
    guide = guide_file(prompt, legacy_root, 1)
    label = text(prompt["text"]).removesuffix("/").removesuffix("\x01").strip()
    require(label == text(BLANK.sub("", native["stem"])), "word_and_native_label_differ")
    answer = teacher_text(key, native)
    require(WORD_LABELS.get(label.removesuffix("(複數)")) == answer, "unmapped_or_inconsistent_vocabulary")
    return {"prompt": label.replace("(複數)", "（複數）"), "answer": answer, "guide": guide}


def odd_word(prompt, key, native):
    stem, *options = normalized(prompt["text"]).split("\x15")
    options = [text(option) for option in options]
    require(not prompt["inline_images"] and ORDINAL_PLACE.fullmatch(stem.strip())
            and len(options) == 3 and len(set(options)) == 3 and all(option in CLASSES for option in options)
            and [ordinal(field) for field in prompt["fields"]] == [0, 1, 2], "invalid_original_word_choices")
    require(options == [text(option) for option in native["options"]]
            and len(key["fields"]) == 1 and text(key["text"]) == "答案:\x15", "invalid_teacher_choice")
    answer = ordinal(key["fields"][0])
    counts = Counter(CLASSES[option] for option in options)
    require(native["answers"] == [[str(answer + 1)]] and sorted(counts.values()) == [1, 2]
            and counts[CLASSES[options[answer]]] == 1, "word_and_native_category_key_differ")
    return {"options": options, "answer": answer}


def convert(row, kind, legacy_root):
    data = json.loads(verified_bytes(Path(row["payloadPath"]), row["payloadSha"]))["content"]
    require(data == row["native"] and not data.get("preamble") and len(data["questions"]) == 1
            and not row["audioResources"] and len(row["units"]) == 1, "unexpected_group_or_native_metadata")
    native = data["questions"][0]
    prompt, key = (row["original"][part] for part in ("preamble-question", "answer"))
    for doc in (prompt, key):
        verified_bytes(Path(doc["path"]), doc["sha"])
        require(not doc["shapes"] and not doc["tables"], "unexpected_word_layout")
    require(not key["inline_images"], "unexpected_teacher_media")
    if kind == "words":
        return words(prompt, key, native, legacy_root)
    if kind == "sentences":
        return sentences(prompt, key, native)
    if kind == "write":
        return write_word(prompt, key, native, legacy_root)
    return odd_word(prompt, key, native)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("legacy_docx", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    results = []
    for row in json.loads(args.source.read_text(encoding="utf-8")):
        if len(row["types"]) != 1 or row["types"][0] not in LAYOUTS:
            continue
        kind = LAYOUTS[row["types"][0]]
        result = {"source": row["source"], "unit": row["units"][0], "kind": kind}
        try:
            result.update(convert(row, kind, args.legacy_docx), passed=True)
        except (OSError, ValueError) as error:
            result.update(passed=False, reason=str(error))
        results.append(result)
    args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(Counter(r.get("reason", "passed") for r in results))


if __name__ == "__main__":
    main()
