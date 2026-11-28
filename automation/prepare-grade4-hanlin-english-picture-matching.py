"""Verify Hanlin English three-picture sentence matching against original Word and teacher keys."""

import argparse
import importlib.util
import json
from pathlib import Path
import re

rules_path = Path(__file__).with_name("prepare-grade4-hanlin-english-picture-words.py")
spec = importlib.util.spec_from_file_location("hanlin_picture_words", rules_path)
picture_words = importlib.util.module_from_spec(spec)
spec.loader.exec_module(picture_words)

exact_bytes, ordinal, require, text = (picture_words.exact_bytes, picture_words.ordinal,
                                       picture_words.require, picture_words.text)

LAYOUT = "Read and Write 將句子代號填入對應的圖片空格中"
EMPTY = r"[（(][\s\u3000]*[）)]"
BLANKS = re.compile(r"(?:\s*" + EMPTY + r"){3}\s*(?:【[\s\u3000]+】\s*){0,3}\Z")


def catalog_options(item):
    """Decode the structured and the inline-circled records from the same edition."""
    if item["options"]:
        require(len(item["options"]) == 3 and not item["stem"].strip(), "catalog_choice_layout")
        options = [text(part) for part in item["options"][:2]]
        options.append(text(BLANKS.sub("", item["options"][2])))
        ids = item["answers"]
        require(len(ids) == 1 and len(ids[0]) == 3 and set(ids[0]) == {"1", "2", "3"}, "catalog_numeric_key")
        return options, [int(value) - 1 for value in ids[0]]

    source = BLANKS.sub("", item["stem"].strip())
    pieces = re.split(r"([ⒶⒷⒸ])", source)
    require(len(pieces) == 7 and not pieces[0].strip()
            and pieces[1::2] == list("ⒶⒷⒸ"), "catalog_inline_choices")
    keys = item["answers"]
    require(len(keys) == 3 and all(len(key) == 1 for key in keys)
            and {key[0] for key in keys} == set("ⒶⒷⒸ"), "catalog_inline_key")
    return [text(part) for part in pieces[2::2]], ["ⒶⒷⒸ".index(key[0]) for key in keys]


def convert(row, media, inspected):
    require(len(row["units"]) == 1 and row["units"][0] in (3, 4) and not row["audioResources"], "source_scope")
    native = json.loads(exact_bytes(row["payloadPath"], row["payloadSha"]))["content"]
    require(native == row["native"] and not native.get("preamble")
            and len(native["questions"]) == 1, "catalog_question_group")
    word, key = [row["original"][part] for part in ("preamble-question", "answer")]
    for doc in (word, key):
        exact_bytes(doc["path"], doc["sha"])
        require(not doc["shapes"] and not doc["tables"], "mapped_inline_layout_required")
    require(word["inline_images"] == 3 and len(word["fields"]) == 3 and not key["inline_images"]
            and len(key["fields"]) == 3, "word_image_and_field_counts")
    require(media["container_sha"] == word["sha"], "image_container_word_mismatch")
    exact_bytes(media["container"], media["container_sha"])

    initial, *parts = word["text"].split("\x15")
    require(not initial.strip() and len(parts) == 3 and [ordinal(mark) for mark in word["fields"]] == [0, 1, 2],
            "word_option_order")
    last, marker, placeholders = parts[-1].partition("\x0b")
    require(marker and re.fullmatch(r"(?:\s*" + EMPTY + r"/){3}\s*", placeholders) is not None,
            "three_ordered_word_blanks")
    parts[-1] = last
    options = [text(part) for part in parts]
    keys = [ordinal(mark) for mark in key["fields"]]
    require(keys == inspected["answers"] and sorted(keys) == [0, 1, 2], "teacher_and_picture_key_mismatch")
    expected, expected_key = catalog_options(native["questions"][0])
    require(options == expected and keys == expected_key and all(options), "word_and_catalog_differ")

    images = media["images"]
    require(len(images) == 3 and [image["sha256"] for image in images] == inspected["images"]
            and len(inspected["alts"]) == 3, "visual_review_order")
    for image in images:
        require(len(exact_bytes(image["path"], image["sha256"])) == image["bytes"], "image_size")
    pages = inspected["pages"]
    require(bool(pages) and len(set(pages)) == len(pages) and all(isinstance(n, int) and 41 <= n <= 72 for n in pages),
            "textbook_review_pages")
    return {"options": options, "keys": keys, "images": images, "alts": inspected["alts"], "pages": pages}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("originals", "images", "review", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    args = parser.parse_args()
    originals = json.loads(args.originals.read_text(encoding="utf-8"))
    images = json.loads(args.images.read_text(encoding="utf-8"))
    review = json.loads(args.review.read_text(encoding="utf-8"))
    results = []
    for row in originals:
        if row["types"] != [LAYOUT]:
            continue
        source = row["source"]
        result = {"source": source, "unit": row["units"][0]}
        try:
            result.update(convert(row, images[source], review[source]), passed=True)
        except (KeyError, OSError, ValueError) as error:
            result.update(passed=False, reason=str(error))
        results.append(result)
    args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(sum(row["passed"] for row in results), len(results))


if __name__ == "__main__":
    main()
