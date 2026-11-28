"""Verify Hanlin English text-only listening tasks against original source records."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import unicodedata
from zipfile import BadZipFile, ZipFile

WRITING_GUIDE = "f6d34b3aa73e8831cbb38dc66030bd93987b9788a939c9591847a6659f01fedc"
LAYOUTS = {
    "寫出正確的單字": "write_word", "勾選正確的單字": "check_word",
    "選出正確的句子": "choose_sentence", "選出適當的回應句": "choose_response",
    "依聽到的句子，選出正確的單字": "choose_cloze",
    "勾選正確的發音例字": "check_phonics", "選出正確的發音字母": "choose_phonics",
}
EMPTY_MARKER = re.compile(r"^\s*[（(][ \u3000]*[）)]")
SCRIPT = re.compile(r"錄音稿[:：]\s*(.*?)\s*音軌[:：]", re.S)
SLOT = re.compile(r"＿{2,}|_{2,}|\u3000{4,}")
PHONICS_SLOT = re.compile(r"＿{2,}|_{2,}|\u3000{2,}")
FOOD = {
    **dict.fromkeys(("apples", "bananas", "oranges", "watermelons", "hamburgers", "hot dogs", "sandwiches"), 46),
    **dict.fromkeys(("juice", "milk", "tea", "water", "cake", "ice cream", "pizza", "rice"), 60),
}


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def text(value):
    return " ".join(unicodedata.normalize("NFKC", value).replace("’", "'").split())


def spoken(value):
    return re.sub(r"[^a-z]", "", re.sub(r"\b[A-C][.:]\s*", "", text(value)).lower())


def read_hashed(path, expected, size=None):
    data = Path(path).read_bytes()
    require(hashlib.sha256(data).hexdigest() == expected and (size is None or len(data) == size), "source_sha256")
    return data


def get_script(value):
    match = SCRIPT.search(value)
    require(match is not None, "missing_publisher_script")
    return text(match[1])


def ordinal(field):
    match = re.fullmatch(r"eq\s+\\o\(○,([A-D])\)", text(field["code"]), re.I)
    require(match is not None, "invalid_word_ordinals")
    return "abcd".index(match[1].lower())


def literal_key(key, native):
    raw = text(key["text"])
    require(raw.startswith("答案:") and not key["fields"], "unknown_teacher_key")
    answer = raw.removeprefix("答案:").strip()
    require(len(native["answers"]) == 1 and len(native["answers"][0]) == 1
            and text(native["answers"][0][0]) == answer, "word_and_native_key_differ")
    return answer


def clean_stem(stem, slot):
    return text(slot.sub(" ____ ", EMPTY_MARKER.sub("", stem)))


def word_guide(prompt, legacy_root):
    require(prompt["inline_images"] == 1 and text(prompt["text"]) in {"/", "\x01"}, "unknown_answer_guide")
    path = Path(prompt["path"])
    path = path if path.suffix == ".docx" else legacy_root / (path.stem + ".docx")
    with ZipFile(path) as word:
        assets = [word.read(name) for name in word.namelist() if name.startswith("word/media/") and not name.endswith("/")]
    require(len(assets) == 1 and hashlib.sha256(assets[0]).hexdigest() == WRITING_GUIDE, "not_blank_writing_guide")
    return str(path)


def convert(row, kind, comparison, legacy_root):
    original = row["original"]
    prompt, key, solution = (original[part] for part in ("preamble-question", "answer", "solution"))
    require(len(row["units"]) == 1 and len(row["audioResources"]) == 1, "scope_or_audio_count")
    for doc in (prompt, key, solution):
        read_hashed(doc["path"], doc["sha"])
        require(not doc["shapes"] and not doc["tables"], "unmapped_word_layout")
    require(not key["inline_images"] and not solution["inline_images"], "unmapped_teacher_media")
    sound = comparison["audio"]
    require(sound["decoded"] and sound["name"] == row["audioResources"][0], "invalid_original_audio")
    read_hashed(sound["path"], sound["sha256"], sound["bytes"])
    payload = json.loads(read_hashed(row["payloadPath"], row["payloadSha"]))
    data = payload["content"]
    require(data == row["native"] and not data.get("preamble") and len(data["questions"]) == 1, "unexpected_native_structure")
    native = data["questions"][0]
    script = get_script(payload.get("solution") or data.get("solution") or "")
    expected = spoken(script)
    require(script == comparison["script"] == get_script(solution["text"]) and bool(expected), "word_and_native_script_differ")
    require(spoken(sound["transcript"]) in {expected, expected * 2, expected * 3}, "audio_requires_independent_review")
    result = {"audio": sound["path"], "sha256": sound["sha256"], "bytes": sound["bytes"], "script": script}

    if kind == "write_word":
        require(not native["options"] and not prompt["fields"], "unexpected_writing_choices")
        guide = word_guide(prompt, legacy_root)
        answer = literal_key(key, native)
        require(answer in FOOD and spoken(answer) == expected, "script_and_teacher_key_differ")
        return {**result, "guide": guide, "answer": answer, "stem": ""}

    require(not prompt["inline_images"], "unmapped_stem_image")
    if kind in {"check_word", "check_phonics"}:
        require(not prompt["fields"] and not native["options"], "unmapped_checkbox_choices")
        layout = re.split(r"[☐□]", prompt["text"])
        native_layout = re.split(r"[☐□]", native["stem"])
        options = [text(part) for part in layout[1:]]
        require(not layout[0].strip() and not native_layout[0].strip()
                and options == [text(part) for part in native_layout[1:]], "word_and_native_options_differ")
        answer = literal_key(key, native)
        require(answer in options and spoken(answer) == expected, "script_and_teacher_key_differ")
        index, stem = options.index(answer), ""
    else:
        before, *options = prompt["text"].split("\x15")
        options = [text(option) for option in options]
        require(options == [text(option) for option in native["options"]]
                and [ordinal(f) for f in prompt["fields"]] == list(range(len(options))), "word_and_native_options_differ")
        require(text(key["text"]) == "答案:\x15" and len(key["fields"]) == 1, "unknown_teacher_key")
        index = ordinal(key["fields"][0])
        require(index < len(options) and native["answers"] == [[str(index + 1)]], "word_and_native_key_differ")
        slot = PHONICS_SLOT if kind == "choose_phonics" else SLOT
        stem = clean_stem(before, slot)
        require(stem == clean_stem(native["stem"], slot), "word_and_native_stem_differ")
        if kind in {"choose_cloze", "choose_phonics"}:
            require(stem.count("____") == 1 and spoken(stem.replace("____", options[index])) == expected,
                    "completed_sentence_and_script_differ")
        if kind == "choose_sentence":
            require(spoken(options[index]) == expected, "spoken_option_differs")
    require(2 <= len(options) <= 4 and all(options) and len(set(options)) == len(options), "invalid_choice_count")
    return {**result, "options": options, "answer": "abcd"[index], "stem": stem}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("originals", "comparison", "legacy-guides", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    args = parser.parse_args()
    originals = json.loads(args.originals.read_text(encoding="utf8"))
    comparisons = {row["source"]: row for row in json.loads(args.comparison.read_text(encoding="utf8"))}
    results = []
    for row in originals:
        label = row["types"][0].split("，", 1)[-1] if len(row["types"]) == 1 else ""
        kind = LAYOUTS.get(label)
        if not kind:
            continue
        ident = row["source"]
        result = {"source": ident, "unit": row["units"][0], "kind": kind}
        try:
            result.update(convert(row, kind, comparisons[ident], args.legacy_guides), passed=True)
        except (OSError, BadZipFile, KeyError, ValueError) as error:
            result.update(passed=False, reason=str(error))
        results.append(result)
    args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(sum(r["passed"] for r in results), len(results))


if __name__ == "__main__":
    main()
