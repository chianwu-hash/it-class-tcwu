"""Convert Hanlin picture choices only when the original visual key has been verified."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import unicodedata


LABELS = {"Read and Check 勾選出正確的圖片": "choose_picture",
          "Look and Check 看圖勾選正確的句子": "choose_sentence"}


def normalized(value):
    return " ".join(unicodedata.normalize("NFKC", value).replace("’", "'").split())


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def read_hashed(path, sha, bytes_count=None):
    data = Path(path).read_bytes()
    require(hashlib.sha256(data).hexdigest() == sha and (bytes_count is None or bytes_count == len(data)),
            "source_sha256")
    return data


def adapt(row, kind, media, observation):
    require(len(row["units"]) == 1 and row["units"][0] in (3, 4, 5)
            and not row["audioResources"], "unexpected_source_scope")
    data = json.loads(read_hashed(row["payloadPath"], row["payloadSha"]))["content"]
    require(data == row["native"] and not data.get("preamble") and len(data["questions"]) == 1, "native_question")
    native = data["questions"][0]
    q, key = (row["original"][section] for section in ("preamble-question", "answer"))
    for doc in (q, key):
        read_hashed(doc["path"], doc["sha"])
        require(not any(doc[field] for field in ("shapes", "tables", "fields")), "unmapped_word_layout")
    pictures = media["images"]
    require(not key["inline_images"] and not native["options"]
            and len(pictures) == q["inline_images"] == (2 if kind == "choose_picture" else 1),
            "unknown_media_layout")
    require([img["sha256"] for img in pictures] == observation["hashes"], "original_image_order_unverified")
    require(len(set(observation["hashes"])) == len(pictures), "duplicate_images")
    read_hashed(media["container"], media["container_sha"])
    for picture in pictures:
        read_hashed(picture["path"], picture["sha256"], picture["bytes"])
    if observation.get("hold"):
        raise ValueError(observation["hold"])
    raw_key = normalized(key["text"])
    require(raw_key.startswith("答案:"), "missing_teacher_key")
    answer = raw_key.removeprefix("答案:").strip()
    require([[normalized(word) for word in opts] for opts in native["answers"]] == [[answer]],
            "teacher_key_and_native_differ")
    before, *cards = re.split(r"[□☐]", q["text"])
    native_before, *native_cards = re.split(r"[□☐]", native["stem"])
    cards = [normalized(card).replace("\x01", "/") for card in cards]
    require(len(cards) == len(native_cards) == 2, "word_choice_count")
    if kind == "choose_picture":
        native_stem = normalized(native_before)
        require(cards == ["/", "/"] and all(not normalized(card) for card in native_cards)
                and normalized(before) == native_stem and answer in ("左圖", "右圖"),
                "picture_choice_source_differs")
        index = ("左圖", "右圖").index(answer)
        stem = "讀句子，選出符合內容的圖片。\n" + before.strip().replace("\x0b", "\n").replace("\r", "\n")
        options = ["", ""]
    else:
        require(normalized(before).replace("\x01", "/") == "/" and not normalized(native_before)
                and cards == [normalized(card) for card in native_cards]
                and len(set(cards)) == 2 and answer in cards, "sentence_choice_source_differs")
        index = cards.index(answer)
        stem = "看圖，選出符合圖意的句子。"
        options = [re.sub(r"([?!])\.$", r"\1", card) for card in cards]
    require(index == observation["answer_index"], "teacher_key_and_picture_differ")
    return {"prompt": stem, "options": options, "images": pictures, "answer_index": index,
            "reference": observation["pages"], "explanation": observation["explanation"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("originals", "images", "observations", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    args = parser.parse_args()
    read = lambda file: json.loads(file.read_text(encoding="utf8"))
    images, observations = read(args.images), read(args.observations)
    results = []
    for row in read(args.originals):
        if len(row["types"]) != 1 or row["types"][0] not in LABELS:
            continue
        sid, kind = row["source"], LABELS[row["types"][0]]
        result = {"source": sid, "kind": kind, "unit": row["units"][0]}
        try:
            result.update(adapt(row, kind, images[sid], observations[sid]), passed=True)
        except (KeyError, OSError, ValueError) as error:
            result.update(passed=False, reason=str(error))
        results.append(result)
    args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(sum(row["passed"] for row in results), len(results))


if __name__ == "__main__":
    main()
