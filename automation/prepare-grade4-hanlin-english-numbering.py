"""Compare Hanlin numbered listening rows with original Word, answers, and audio."""
import argparse
import importlib.util
import json
from pathlib import Path
import re


NUMBER = re.compile(r"\b([1-3]|one|two|three)\b\s*[.,;:]?\s*", re.I)
ROW = re.compile(r"\(\s*\)")
NATIVE_SLOTS = re.compile(r"【\s*】")
NUMBER_WORDS = {"one": 1, "two": 2, "three": 3}


def load_helper():
    path = Path(__file__).with_name("prepare-grade4-hanlin-english-listening.py")
    spec = importlib.util.spec_from_file_location("hanlin_audio", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def numbered(transcript):
    marks = list(NUMBER.finditer(transcript))
    if len(marks) != 3 or transcript[:marks[0].start()].strip():
        return []
    sections = [mark[1].lower() for mark in marks]
    if [int(word) if word.isdigit() else NUMBER_WORDS[word] for word in sections] != [1, 2, 3]:
        return []
    return [transcript[mark.end():marks[i+1].start() if i+1 < len(marks) else len(transcript)].strip(" ;")
            for i, mark in enumerate(marks)]


def speech(value, helpers):
    return helpers.spoken(re.sub(r"\btheir\b", "they're", value, flags=re.I))


def adapt(source, original_audio, second_audio, helper, phonics):
    required = helper.require
    original = source["original"]
    prompt, key, notes = (original[k] for k in ("preamble-question", "answer", "solution"))
    for part in (prompt, key, notes):
        helper.read_hashed(part["path"], part["sha"])
        required(not any(part[a] for a in ("inline_images", "shapes", "tables", "fields")), "unmapped_word_layout")
    required(source["units"] == [5] and len(source["audioResources"]) == 1, "unexpected_listening_scope")
    payload = json.loads(helper.read_hashed(source["payloadPath"], source["payloadSha"]))
    native = payload["content"]
    required(native == source["native"] and not native.get("preamble")
             and len(native["questions"]) == 1, "native_question_layout")
    question = native["questions"][0]
    stop = helper.get_script(payload.get("solution") or native.get("solution") or "")
    original_record = original_audio["audio"]
    required(stop == original_audio["script"] == helper.get_script(notes["text"]), "native_and_word_script_differ")
    required(original_record["decoded"] and original_record["name"] == source["audioResources"][0],
             "unverified_original_audio")
    helper.read_hashed(original_record["path"], original_record["sha256"], original_record["bytes"])
    if second_audio:
        required(second_audio["sha256"] == original_record["sha256"] and second_audio["script"] == stop,
                 "second_audio_source_differs")

    before, *printed = ROW.split(helper.text(prompt["text"]))
    native_before, *native_rows = ROW.split(helper.text(NATIVE_SLOTS.sub("", question["stem"])))
    printed = [label.strip() for label in printed]
    required(not before and not native_before and len(printed) == len(set(printed)) == 3
             and printed == [label.strip() for label in native_rows] and not question["options"], "word_row_order")
    text_key = helper.text(key["text"])
    required(text_key.startswith("答案:"), "missing_teacher_key")
    teacher = [n.strip() for n in text_key.removeprefix("答案:").split(";")]
    required(sorted(teacher) == ["1", "2", "3"], "teacher_numbering_invalid")
    native_answers = [[helper.text(value) for value in row] for row in question["answers"]]
    required(native_answers in ([[item] for item in teacher], [[";".join(teacher)]]), "teacher_native_differ")

    expected = [speech(text, helper) for text in numbered(stop)]
    spoken_answers = [speech(printed[teacher.index(str(i))], helper) for i in range(1, 4)]
    required(len(expected) == 3 and all(expected) and spoken_answers == expected, "teacher_script_order_differ")
    candidates = [original_record["transcript"]]
    if second_audio:
        candidates.append(second_audio["transcript"])
    matches = []
    for transcript in candidates:
        observed = [speech(part, helper) for part in numbered(transcript)]
        matches.append(len(observed) == 3 and all(got in (wanted, wanted * 2)
                                                  for got, wanted in zip(observed, expected)))
    required(any(matches), "original_audio_requires_independent_review")
    required(not phonics or (len(matches) == 2 and all(matches)), "phonics_minimal_pair_transcriptions_disagree")
    return {"printed": printed, "answers": teacher, "script": stop,
            "audio": {key: original_record[key] for key in ("path", "sha256", "bytes")}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("originals", "first-asr", "second-asr", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    args = parser.parse_args()
    read = lambda file: json.loads(file.read_text(encoding="utf8"))
    first = {r["source"]: r for r in read(args.first_asr)}
    second = read(args.second_asr)
    helper = load_helper()
    results = []
    for item in read(args.originals):
        if len(item["types"]) != 1 or not item["types"][0].startswith("Listen and Number"):
            continue
        sid = item["source"]
        result = {"source": sid}
        try:
            result.update(adapt(item, first[sid], second.get(sid), helper, "發音例字" in item["types"][0]), passed=True)
        except (OSError, ValueError) as error:
            result.update(passed=False, reason=str(error))
        results.append(result)
    args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(sum(row["passed"] for row in results), len(results))


if __name__ == "__main__":
    main()
