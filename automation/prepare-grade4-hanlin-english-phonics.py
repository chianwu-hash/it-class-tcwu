"""Validate Hanlin phonics and syllable counting against the original Word and recorded speech."""

import argparse
import importlib.util
import json
from pathlib import Path
import re


FORM = {"與畫線字母發音相同畫○，不同畫╳": "compare_sound",
        "圈出正確的音節數": "syllable_count",
        "寫出正確的發音字母或音組": "fill_letter"}
SYLLABLES = {"watermelons": 4, "tea": 1, "bananas": 3, "pizza": 2, "pencil": 2, "sandwiches": 3}
# Independently reviewed consonants for the source words, at the compared edge.
CONSONANTS = {
    "initial": {"zero": "z", "sock": "s", "set": "s", "vox": "v", "vote": "v", "five": "f",
                "fat": "f", "vine": "v", "zap": "z"},
    "final": {"bass": "s", "buzz": "z", "give": "v"},
}
EMPTY = re.compile(r"^\s*\(\s*\)\s*")
NATIVE_TOKEN = re.compile(r"【\s*】")
NATIVE_SLOT = re.compile(r"\u3000{4,}")
WORD_SLOT = re.compile(r"_{2,}|＿{2,}")


def load_helper():
    path = Path(__file__).with_name("prepare-grade4-hanlin-english-listening.py")
    spec = importlib.util.spec_from_file_location("hanlin_audio", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def adapt(row, kind, compare, recheck, emphasis, helper):
    require = helper.require
    require(len(row["units"]) == 1 and len(row["audioResources"]) == 1, "unexpected_source_scope")
    question, key, solution = (row["original"][k] for k in ("preamble-question", "answer", "solution"))
    for doc in (question, key, solution):
        helper.read_hashed(doc["path"], doc["sha"])
        require(not any(doc[k] for k in ("shapes", "inline_images", "tables", "fields")), "unmapped_word_layout")
    payload = json.loads(helper.read_hashed(row["payloadPath"], row["payloadSha"]))
    native = payload["content"]
    require(native == row["native"] and not native.get("preamble")
            and len(native["questions"]) == 1, "unexpected_native_structure")
    native = native["questions"][0]
    require(not native["options"], "unexpected_native_options")
    answer = helper.literal_key(key, native)
    sound = compare["audio"]
    require(sound["decoded"] and sound["name"] == row["audioResources"][0], "unverified_original_audio")
    helper.read_hashed(sound["path"], sound["sha256"], sound["bytes"])
    script = helper.get_script(payload.get("solution") or payload["content"].get("solution") or "")
    require(script == compare["script"] == helper.get_script(solution["text"]), "word_native_script_differ")
    expected = helper.spoken(script)
    require(expected and re.fullmatch(r"[a-z]+", script.lower()), "unexpected_recorded_word")
    transcripts = [sound["transcript"]]
    if recheck:
        require(recheck["sha256"] == sound["sha256"] and recheck["script"] == script, "second_asr_source_differs")
        transcripts.append(recheck["transcript"])
    require(any(helper.spoken(t) in (expected, expected * 2) for t in transcripts),
            "original_audio_requires_independent_review")
    if kind == "compare_sound":
        require(emphasis["sha256"] == question["sha"], "source_underline_unverified")
        term = EMPTY.sub("", helper.text(question["text"]))
        require(term == EMPTY.sub("", helper.text(native["stem"])),
                "word_and_native_phonics_stem_differ")
        chars = emphasis["chars"]
        require(term == "".join(char["char"] for char in chars), "word_underline_text_differ")
        marked = [i for i, char in enumerate(chars) if char["underline"] > 0]
        require(bool(marked) and len(marked) < len(chars), "source_underline_missing")
        edge = "initial" if marked == list(range(len(marked))) else "final"
        require(edge == "initial" or marked == list(range(len(chars) - len(marked), len(chars))),
                "unmapped_midword_underline")
        letters = "".join(chars[i]["char"] for i in marked)
        require(letters.lower() in {"v", "f", "s", "z", "zz"}, "unverified_compared_letter")
        matches = letters[0].lower() == CONSONANTS[edge].get(script.lower())
        require(script.lower() in CONSONANTS[edge] and answer in {"○", "◯", "╳"}
                and matches == (answer != "╳"), "teacher_and_recorded_consonants_differ")
        options, index = ["○", "×"], int(not matches)
        prompt = f"聽錄音。比較 {term} 裡的 {letters} 和錄音中單字的{'開頭' if edge == 'initial' else '結尾'}發音。相同選 ○，不同選 ×。"
        explanation = f"錄音念的是 {script}，{'開頭' if edge == 'initial' else '結尾'}發音和 {term} 裡的 {letters}{'相同' if matches else '不同'}。"
    elif kind == "syllable_count":
        options = helper.text(question["text"]).split()
        require(options == helper.text(native["stem"]).split() == ["1", "2", "3", "4"]
                and script.lower() in SYLLABLES and answer == str(SYLLABLES[script.lower()]), "incorrect_syllable_key")
        index = options.index(answer)
        prompt = "聽錄音，選出這個英文單字有幾個音節。"
        explanation = f"錄音念的是 {script}，有 {answer} 個音節。"
    else:
        word_match = re.fullmatch(r"\(([a-z ]+)\)\s*(\S+)", helper.text(question["text"]))
        stem = NATIVE_SLOT.sub("____", NATIVE_TOKEN.sub("", native["stem"]))
        native_match = re.fullmatch(r"\(([a-z ]+)\)\s*(\S+)", helper.text(stem))
        require(word_match and native_match, "unmapped_phonics_blank")
        options = word_match[1].split()
        blank = WORD_SLOT.sub("____", word_match[2])
        require(len(options) == len(set(options)) == 4 and options == native_match[1].split()
                and blank == native_match[2] and blank.count("____") == 1 and answer in options
                and blank.replace("____", answer) == script.lower(), "word_and_native_phonics_key_differ")
        index = options.index(answer)
        prompt = "聽錄音，選出空格缺少的字母。\n" + blank
        explanation = f"錄音念的是 {script}，空格應填 {answer}。"
    return {"prompt": prompt, "options": options, "answer_index": index, "explanation": explanation,
            "script": script, "audio": {key: sound[key] for key in ("path", "sha256", "bytes")}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("originals", "first-asr", "second-asr", "underlining", "output"):
        parser.add_argument("--" + name, type=Path, required=True)
    args = parser.parse_args()
    read = lambda file: json.loads(file.read_text(encoding="utf8"))
    first = {row["source"]: row for row in read(args.first_asr)}
    second, underlining = read(args.second_asr), read(args.underlining)
    helper = load_helper()
    results = []
    for row in read(args.originals):
        label = row["types"][0].split("，", 1)[-1] if len(row["types"]) == 1 else ""
        kind = FORM.get(label)
        if not kind:
            continue
        sid = row["source"]
        result = {"source": sid, "unit": row["units"][0], "kind": kind}
        try:
            result.update(adapt(row, kind, first[sid], second.get(sid), underlining.get(sid), helper), passed=True)
        except (KeyError, ValueError, OSError) as error:
            result.update(passed=False, reason=str(error))
        results.append(result)
    args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(sum(row["passed"] for row in results), len(results))


if __name__ == "__main__":
    main()
