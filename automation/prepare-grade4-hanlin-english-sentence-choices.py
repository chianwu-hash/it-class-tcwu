"""Verify the Hanlin Word option order and teacher key for text-only sentence choices."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import unicodedata

WORD_FIELD = "\x15"
NUMBER_PLACE = re.compile(r"^[ \t]*[（(][ \t\u3000]*[）)]")
ANSWER_SPACE = re.compile(r"[＿_]{2,}|\u3000{4,}")
LABELS = {
    "Read and Choose 選出正確的對應句",
    "Read and Choose 文法選擇",
    "Read and Choose 依上下文選出正確的答案",
}


def normalized(text):
    return unicodedata.normalize("NFKC", text).translate(str.maketrans("’‘", "''"))


def match_key(field):
    match = re.fullmatch(r"eq\s+\\o\(○,([A-D])\)", normalized(field["code"]).strip(), re.I)
    if not match:
        raise ValueError("unknown_word_option_marker")
    return match[1].lower()


def normalized_stem(text):
    # The native store encodes answer lines as repeated ideographic spaces.
    return " ".join(normalized(ANSWER_SPACE.sub(" ____ ", text)).split())


def verify_source(source, expected_hash):
    data = Path(source).read_bytes()
    if hashlib.sha256(data).hexdigest() != expected_hash:
        raise ValueError("source_bytes_changed")
    return data


def convert(row):
    if (len(row["types"]) != 1 or row["types"][0] not in LABELS
            or len(row["units"]) != 1 or row["audioResources"]):
        raise ValueError("unexpected_source_context")
    native = json.loads(verify_source(row["payloadPath"], row["payloadSha"]))["content"]
    if native != row["native"]:
        raise ValueError("native_payload_metadata_differs")
    if native.get("preamble") or len(native["questions"]) != 1:
        raise ValueError("not_one_question")
    item = native["questions"][0]
    prompt, key = (row["original"][part] for part in ("preamble-question", "answer"))
    for doc in (prompt, key):
        verify_source(doc["path"], doc["sha"])
        if doc["inline_images"] or doc["shapes"] or doc["tables"]:
            raise ValueError("unexpected_word_visual_content")

    stem, *options = normalized(prompt["text"]).split(WORD_FIELD)
    if len(options) != 4 or [match_key(field) for field in prompt["fields"]] != list("abcd"):
        raise ValueError("unknown_word_option_order")
    options = [" ".join(option.split()) for option in options]
    if (not all(options) or len(set(options)) != 4
            or options != [" ".join(normalized(option).split()) for option in item["options"]]):
        raise ValueError("word_and_native_options_differ")

    if len(key["fields"]) != 1 or normalized(key["text"]).strip() != "答案:" + WORD_FIELD:
        raise ValueError("unknown_teacher_key")
    answer = match_key(key["fields"][0])
    if item["answers"] != [[str("abcd".index(answer) + 1)]]:
        raise ValueError("word_and_native_key_differ")

    stem = NUMBER_PLACE.sub("", stem)
    native_stem = NUMBER_PLACE.sub("", item["stem"])
    if normalized_stem(stem) != normalized_stem(native_stem):
        raise ValueError("word_and_native_stem_differ")
    shown = "\n".join(re.sub(r"_{2,}", "____", line.strip())
                      for line in stem.splitlines() if line.strip())
    return {"prompt": shown, "options": options, "answer": answer}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    results = []
    for row in json.loads(args.source.read_text(encoding="utf-8")):
        result = {"source": row["source"], "unit": row["units"][0]}
        try:
            result.update(convert(row), passed=True)
        except (OSError, ValueError) as error:
            result.update(passed=False, reason=str(error))
        results.append(result)
    args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(sum(r["passed"] for r in results), len(results))


if __name__ == "__main__":
    main()
