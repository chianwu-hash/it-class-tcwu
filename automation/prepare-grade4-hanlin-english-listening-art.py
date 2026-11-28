"""Verify Hanlin listening pictures, original audio and independently reviewed illustration keys."""
import argparse
import importlib.util
import json
from pathlib import Path
import re


KINDS = {
    "錄音內容和圖片相符畫○，不符畫╳": "matches",
    "選出正確的圖片": "pictures",
    "勾選正確的單字圖片": "word_picture",
    "選出正確的句子代號": "codes",
}
PICTURE_COUNT = {"matches": 1, "pictures": 2, "word_picture": 2, "codes": 1}
MARK = re.compile(r"^\(\s*\)\s*")
CODED_SCRIPT = re.compile(r"\(([ABC])\)")
AUDIO_CODES = re.compile(r"(?<!\w)([ABC])[.:]\s*|\b(See),?\s+(?=[A-Z])", re.I)


def load_helper(path):
    spec = importlib.util.spec_from_file_location("hanlin_audio", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def coded_audio(value, helper):
    marks = list(AUDIO_CODES.finditer(value))
    if not marks or value[:marks[0].start()].strip():
        return []
    return [(mark[1].upper() if mark[1] else "C",
             speech(value[mark.end():marks[i + 1].start()] if i + 1 < len(marks) else value[mark.end():], helper))
            for i, mark in enumerate(marks)]


def speech(value, helper):
    words = re.sub(r"\btheir\b", "they're", value, flags=re.I)
    return helper.spoken(words)


def proof_audio(row, helper, original, comparison, second, kind):
    sound = comparison["audio"]
    helper.require(sound["decoded"] and len(row["audioResources"]) == 1
                   and sound["name"] == row["audioResources"][0], "unverified_audio_source")
    helper.read_hashed(sound["path"], sound["sha256"], sound["bytes"])
    solution = helper.get_script(original.get("solution") or original["content"].get("solution") or "")
    helper.require(solution == comparison["script"] == helper.get_script(row["original"]["solution"]["text"]),
                   "word_and_publisher_transcripts_differ")
    if second:
        helper.require(second["sha256"] == sound["sha256"] and second["script"] == solution, "second_asr_source_differs")
    alternatives = [sound["transcript"], *([second["transcript"]] if second else [])]
    if kind == "codes":
        labels = list(CODED_SCRIPT.finditer(solution))
        helper.require([m[1] for m in labels] == list("ABC") and not solution[:labels[0].start()].strip(),
                       "unknown_publisher_code_layout")
        expected = [(m[1], speech(solution[m.end():labels[i+1].start()] if i+1 < len(labels)
                                  else solution[m.end():], helper)) for i, m in enumerate(labels)]
        helper.require(all(word for _, word in expected)
                       and any(coded_audio(raw, helper) in (expected, expected * 2) for raw in alternatives),
                       "audio_letter_or_script_differs")
    else:
        expected = speech(solution, helper)
        helper.require(bool(expected) and any(speech(raw, helper) in (expected, expected * 2) for raw in alternatives),
                       "audio_requires_independent_review")
    return {**{key: sound[key] for key in ("path", "sha256", "bytes")}, "script": solution}


def adapt(row, kind, helper, asset, visual, comparison, second):
    helper.require(len(row["units"]) == 1 and row["units"][0] in (3, 4), "unexpected_source_unit")
    payload = json.loads(helper.read_hashed(row["payloadPath"], row["payloadSha"]))
    native = payload["content"]
    helper.require(native == row["native"] and not native.get("preamble") and len(native["questions"]) == 1,
                   "unexpected_native_structure")
    native = native["questions"][0]
    q, key, solution = (row["original"][part] for part in ("preamble-question", "answer", "solution"))
    for part in (q, key, solution):
        helper.read_hashed(part["path"], part["sha"])
        helper.require(not part["shapes"] and not part["tables"], "unmapped_word_layout")
    count = PICTURE_COUNT[kind]
    images = asset["images"]
    helper.require(len(images) == q["inline_images"] == count and not key["inline_images"]
                   and not solution["inline_images"], "original_image_count")
    helper.read_hashed(asset["container"], asset["container_sha"])
    for image in images:
        helper.read_hashed(image["path"], image["sha256"], image["bytes"])
    helper.require([asset["sha256"] for asset in images] == visual["hashes"], "original_image_order_unverified")
    if visual.get("hold"):
        raise ValueError(visual["hold"])
    audio = proof_audio(row, helper, payload, comparison, second, kind)
    txt = helper.text(q["text"]).replace("\x01", "/")
    required = helper.require
    if kind == "pictures":
        required(native["options"] == ["", ""] and MARK.sub("", txt) == "\x15/ \x15/"
                 and [helper.ordinal(f) for f in q["fields"]] == [0, 1], "unknown_image_option_layout")
        required(helper.text(key["text"]) == "答案:\x15" and len(key["fields"]) == 1, "unknown_teacher_key")
        index = helper.ordinal(key["fields"][0])
        required(index < count and native["answers"] == [[str(index+1)]], "word_and_native_key_differ")
    else:
        required(not q["fields"] and not native["options"], "unexpected_option_layout")
        literal = helper.literal_key(key, native)
        if kind == "word_picture":
            required(txt == "□ / □ /" and literal in ("左圖", "右圖"), "unknown_picture_checkbox_layout")
            index = ["左圖", "右圖"].index(literal)
        elif kind == "codes":
            required(MARK.sub("", txt) == "/" and literal in ("A", "B", "C"), "unknown_audio_choice_codes")
            index = "ABC".index(literal)
        else:
            required(MARK.sub("", txt) == "/" and literal in ("○", "◯", "╳"), "unknown_true_false_layout")
            index = int(literal == "╳")
    required(index == visual["answer_index"], "teacher_answer_and_original_image_differ")
    if kind == "word_picture":
        required(helper.text(audio["script"]).lower() == visual["word"], "audio_word_and_picture_differ")
    return {"audio": audio, "images": images, "answer_index": index, "reference": visual["pages"],
            "explanation": visual["explanation"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("helper", "originals", "images", "observations", "first-asr", "second-asr", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    args = parser.parse_args()
    helper = load_helper(args.helper)
    read = lambda file: json.loads(file.read_text(encoding="utf8"))
    originals, media, observations = (read(path) for path in (args.originals, args.images, args.observations))
    first = {row["source"]: row for row in read(args.first_asr)}
    second = read(args.second_asr)
    results = []
    for row in originals:
        label = row["types"][0].split("，", 1)[-1] if len(row["types"]) == 1 else ""
        kind = KINDS.get(label)
        if kind is None:
            continue
        sid = row["source"]
        result = {"source": sid, "kind": kind, "unit": row["units"][0]}
        try:
            result.update(adapt(row, kind, helper, media[sid], observations[sid], first[sid], second.get(sid)),
                          passed=True)
        except (KeyError, OSError, ValueError) as error:
            result.update(passed=False, reason=str(error))
        results.append(result)
    args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(sum(row["passed"] for row in results), len(results))


if __name__ == "__main__":
    main()
