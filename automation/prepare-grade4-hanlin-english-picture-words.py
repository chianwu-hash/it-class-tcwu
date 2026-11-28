"""Check Hanlin single-image vocabulary prompts, option order, and teacher answers."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import unicodedata

LAYOUTS = {"Look and Mark O or X 圖與字相符畫○，不符畫╳": "truth",
           "Look and Choose 看圖選出句中的單字": "sentence",
           "Look and Choose 看圖選出正確的單字": "word"}
BOOK_WORDS = {
    **dict.fromkeys(("apples", "bananas", "oranges", "watermelons", "hamburgers", "hot dogs", "sandwiches"), 46),
    **dict.fromkeys(("juice", "milk", "tea", "water", "cake", "ice cream", "pizza", "rice"), 60),
}
PREFIX = re.compile(r"^\s*[（(][ \u3000]*[）)]")
TRUE_FALSE = {"○": "a", "╳": "b"}


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def exact_bytes(path, expected):
    data = Path(path).read_bytes()
    require(hashlib.sha256(data).hexdigest() == expected, "sha256_changed")
    return data


def normalized(value):
    return unicodedata.normalize("NFKC", value).replace("’", "'")


def text(value):
    return " ".join(normalized(value).split())


def word_stem(value):
    value = PREFIX.sub("", value).strip()
    value = re.sub(r"_{2,}|＿{2,}|\u3000{4,}", " ____ ", value)
    return "\n".join(text(line) for line in value.replace("\x0b", "\n").splitlines() if line.strip())


def ordinal(field):
    mark = re.fullmatch(r"eq\s+\\o\(○,([A-C])\)", normalized(field["code"]).strip(), re.I)
    require(mark is not None, "unmapped_word_option_marker")
    return "abc".index(mark[1].lower())


def convert(row, kind, media, observation):
    require(len(row["units"]) == 1 and row["units"][0] in (3, 4) and not row["audioResources"], "source_scope")
    native = json.loads(exact_bytes(row["payloadPath"], row["payloadSha"]))["content"]
    require(native == row["native"] and not native.get("preamble") and len(native["questions"]) == 1, "original_question_group")
    question = native["questions"][0]
    word, answer = [row["original"][part] for part in ("preamble-question", "answer")]
    for doc in (word, answer):
        exact_bytes(doc["path"], doc["sha"])
        require(not doc["shapes"] and not doc["tables"], "original_layout")
    require(word["inline_images"] == 1 and not answer["inline_images"] and len(media.get("images", [])) == 1, "one_original_image")
    exact_bytes(media["container"], media["container_sha"])
    art = media["images"][0]
    require(len(exact_bytes(art["path"], art["sha256"])) == art["bytes"], "image_size")
    require(observation["image"] == art["sha256"], "visual_evidence_mismatch")
    if observation.get("hold"):
        raise ValueError(observation["hold"])
    seen = observation["word"]
    require(seen in BOOK_WORDS, "identified_word_outside_textbook")

    initial, *options = word["text"].split("\x15")
    stem = PREFIX.sub("", initial).strip()
    require(stem.startswith("/"), "image_order")
    stem = word_stem(stem.removeprefix("/"))
    require(text(stem) == text(word_stem(question["stem"])), "word_and_catalog_stem_differ")
    raw_key = text(answer["text"])
    if kind == "truth":
        require(not options and not question["options"] and not word["fields"] and not answer["fields"]
                and stem in BOOK_WORDS, "invalid_matching_statement")
        symbol = raw_key.removeprefix("答案:")
        require(raw_key.startswith("答案:") and symbol in TRUE_FALSE
                and question["answers"] == [[symbol]], "original_matching_key")
        key = TRUE_FALSE[symbol]
        require((seen == stem) == (key == "a"), "illustration_conflicts_with_teacher")
        options = ["○", "×"]
        instruction = "看圖，判斷英文單字和圖片是否相符。"
        page = BOOK_WORDS[stem]
    else:
        options = [text(item) for item in options]
        require(len(options) == 3 and len(set(options)) == 3 and all(option in BOOK_WORDS for option in options)
                and [ordinal(field) for field in word["fields"]] == [0, 1, 2], "invalid_image_choices")
        require(options == [text(option) for option in question["options"]]
                and raw_key == "答案:\x15" and len(answer["fields"]) == 1, "original_picture_key")
        position = ordinal(answer["fields"][0])
        require(question["answers"] == [[str(position + 1)]] and options[position] == seen, "illustration_conflicts_with_teacher")
        key = "abc"[position]
        instruction = "看圖，選出正確的單字。"
        page = BOOK_WORDS[seen]
    require((kind == "word") == (not stem), "unexpected_prompt_layout")
    return {"prompt": instruction + ("\n" + stem if stem else ""), "options": options, "answer": key,
            "art": art, "seen": seen, "pages": sorted({page, BOOK_WORDS[seen], *((page + 1,) if kind == "sentence" else ())})}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("originals", "images", "observations", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    args = parser.parse_args()
    originals, images, observations = [json.loads(file.read_text(encoding="utf-8"))
                                      for file in (args.originals, args.images, args.observations)]
    results = []
    for row in originals:
        if len(row["types"]) != 1 or row["types"][0] not in LAYOUTS:
            continue
        ident = row["source"]
        kind = LAYOUTS[row["types"][0]]
        result = {"source": ident, "kind": kind, "unit": row["units"][0]}
        try:
            result.update(convert(row, kind, images[ident], observations[ident]), passed=True)
        except (OSError, ValueError) as error:
            result.update(passed=False, reason=str(error))
        results.append(result)
    args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(sum(row["passed"] for row in results), len(results))


if __name__ == "__main__":
    main()
