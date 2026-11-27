"""Replay Grade 3 listening mappings against the publisher audio and Word keys."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import unicodedata

import pymupdf


UNITS = {"398850": 3, "398851": 4, "398852": 5}
PAGE_TERMS = {
    42: ("what's this", "what's that"),
    43: ("good job", "thanks"),
    44: ("book", "pencil", "pen"),
    45: ("marker", "eraser", "ruler"),
    48: ("pig", "pink", "queen", "quiz", "red", "rabbit"),
    49: ("snake", "sun", "turtle", "tiger"),
    58: ("green", "red", "blue", "what color"),
    59: ("yellow", "black", "white"),
    60: ("good morning", "good afternoon"),
    62: ("up", "umbrella", "van", "vest", "watch", "window", "fox", "box"),
    63: ("yo-yo", "yogurt", "zoo", "zebra"),
    67: ("stationery", "colors", "listen"),
}
LETTERS = {"p": 48, "q": 48, "r": 48, "s": 49, "t": 49,
           "u": 62, "v": 62, "w": 62, "x": 62, "y": 63, "z": 63}
LETTER_WORDS = {"q": "cue", "r": "are", "s": "ess", "t": "tea",
                "u": "you", "x": "ex", "y": "why", "z": "zee"}
WORD_ALIASES = {"any racer": "an eraser", "son": "sun"}
TEXT_RULES = (
    ("勾選正確的單字", "check_word"),
    ("選出正確的句子", "choose_sentence"),
    ("勾選正確的發音例字", "check_phonics"),
    ("選出空格中發音不同的字母", "choose_odd_sound"),
    ("依聽到的句子,選出正確的單字", "choose_cloze"),
    ("選出字首發音的字母", "choose_initial"),
    ("圈選正確的字母", "choose_letter"),
    ("錄音內容和題目相符", "judge_letter"),
    ("依聽到的字母順序,寫出正確的號碼", "order_letters"),
    ("將聽到的句子依序編號", "order_sentences"),
)


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def normalize(text):
    return " ".join(unicodedata.normalize("NFKC", text).replace("’", "'").split())


def spoken(text):
    text = normalize(text).lower()
    for heard, preferred in WORD_ALIASES.items():
        text = re.sub(r"\b" + re.escape(heard) + r"\b", preferred, text)
    return re.sub("[^a-z]", "", text)


def script_text(text):
    return normalize(text.split("錄音稿：", 1)[1].split("音軌：", 1)[0])


def ordered_script(script):
    return [part.strip() for part in re.split(r"(?:^|\s)[1-9][.)]\s*", script)[1:]]


def audio_agrees(script, hypothesis, shape):
    if not script or not hypothesis:
        return False
    if shape in ("order_letters", "order_sentences"):
        chunks = ordered_script(script)
        seen = normalize(hypothesis).lower()
        seen = re.sub(r"\b(one|two|three)\b", lambda m: {"one": "1", "two": "2", "three": "3"}[m[0]], seen)
        read = ordered_script(re.sub(r"\b([1-3])(?:\s+(?![.)])|,\s*)", r"\1. ", seen))
        return len(chunks) == len(read) == 3 and all(
            audio_agrees(a, b, "judge_letter" if shape == "order_letters" else "choose_sentence")
            for a, b in zip(chunks, read))
    if shape in ("choose_letter", "judge_letter"):
        label = script.lower()[0]
        if script.lower() in (label, label * 2) and label in LETTERS:
            raw = re.findall(r"[a-z]+", normalize(hypothesis).lower())
            return bool(raw) and len(raw) <= 6 and all(
                word in (label, label * 2, LETTER_WORDS.get(label)) for word in raw)
    if shape == "check_phonics":
        match = re.fullmatch(r"/([a-z])/,\s*/\1/,\s*(.+)", script, re.I)
        if match:
            phoneme, word = match.groups()
            tokens = re.findall(r"[a-z]+", hypothesis.lower())
            if len(tokens) >= 2 and spoken(tokens[-1]) == spoken(word):
                word_count = sum(spoken(t) == spoken(word) for t in tokens)
                return word_count > 0 and all(
                    spoken(t) == spoken(word) or t in (phoneme, phoneme * 2, phoneme + "uh",
                    phoneme + "ah", phoneme + "u", phoneme + "a", LETTER_WORDS.get(phoneme)) for t in tokens)
    # Dialogue labels and printed choice letters are structural markers.
    expected = re.sub(r"\b[A-C][.,:]\s*", "", script)
    actual = re.sub(r"\b[A-C][.,:]\s*", "", hypothesis)
    expectation = spoken(expected)
    return bool(expectation) and spoken(actual) in {expectation * n for n in (1, 2, 3)}


def teacher_text(answer):
    return normalize(answer["text"]).removeprefix("答案:").strip()


def clip_review_agrees(review, script, digest):
    if not review or review["audio_sha256"] != digest or normalize(review["publishable_transcript"]) != script:
        return False
    windows = {(section["start"], section["end"]) for section in review["review"]}
    return len(windows) >= 2 or bool(windows and review["base_model_exact"])


def eq_positions(item):
    out = []
    for field in item["fields"]:
        match = re.fullmatch(r"eq\s+\\o\(○,([A-C])\)", normalize(field["code"]), re.I)
        require(match, "teacher_word_field")
        out.append(ord(match[1].upper()) - ord("A") + 1)
    return out


def unique(values):
    return list(dict.fromkeys(values))


def page_refs(script, shape, stem, draft, unit, textbook):
    words = normalize(script).lower()
    if shape in ("choose_letter", "judge_letter", "order_letters"):
        labels = [w[0] for w in ordered_script(script)] if shape == "order_letters" else [script[0]]
        if shape == "judge_letter":
            labels.append(stem.strip()[0])
        pages = unique(LETTERS[w.lower()] for w in labels if w.lower() in LETTERS)
    elif shape in ("choose_initial", "choose_odd_sound", "check_phonics"):
        pages = [p for p in (48, 49, 62, 63)
                 if any(re.search(r"\b" + re.escape(t) + r"\b", words) for t in PAGE_TERMS[p])]
    else:
        pages = [p for p in (42, 43, 44, 45, 58, 59, 60)
                 if any(re.search(r"\b" + re.escape(t) + r"\b", words) for t in PAGE_TERMS[p])]
        if unit == 5 and any(re.search(r"\b" + re.escape(t) + r"\b", words)
                             for p in (44, 45, 58, 59) for t in PAGE_TERMS[p]):
            pages.insert(0, 67)
    require(pages, "textbook_topic")
    for n in pages:
        origin, filename = ((39, "05_HWG1_U3.pdf") if n < 53 else
                            (53, "06_HWG1_U4.pdf") if n < 67 else (67, "07_HWG1_R2.pdf"))
        path = textbook / filename
        with pymupdf.open(path) as book:
            raw = book[n-origin].get_text()
        normalized = normalize(raw).lower()
        require(str(n) in [line.strip() for line in raw.splitlines()] and all(
            re.search(r"\b" + re.escape(t) + r"\b", normalized) for t in PAGE_TERMS[n]), "textbook_printed_page")
        draft.append({"page": n, "file": filename, "sha": sha(path), "index": n-origin+1})


def convert(row, audio, second, textbook, reviewed_clip=None):
    label = normalize(row["labels"][0].split("，", 1)[-1])
    shape = next((rule for part, rule in TEXT_RULES if label == part or label.startswith(part + "畫")), None)
    require(shape, "other_layout")
    originals = row["original"]
    word, answer, solution = (originals[k] for k in ("preamble-question", "answer", "solution"))
    require(all(sha(a["path"]) == a["sha"] for a in originals.values()), "original_sha")
    require(not any(word[k] or answer[k] for k in ("inline_images", "shapes", "tables")), "word_layout")
    raw = row["content"]["content"]
    require(len(raw["questions"]) == 1 and not raw.get("preamble"), "source_group")
    native = raw["questions"][0]
    stem = normalize(re.sub(r"【\s*】", "", native["stem"]))
    keys = [normalize(a[0]) for a in native["answers"] if len(a) == 1]
    require(len(keys) == len(native["answers"]), "publisher_key_shape")
    script = script_text(row["content"]["solution"])
    require(script and script == script_text(solution["text"]), "publisher_transcript")
    require(audio.get("samples", 0) > 0 and audio.get("peak", 0) > 0 and
            sha(audio["path"]) == audio["sha256"] == row["audio_resource"]["sha256"], "audio_bytes")
    if second:
        require(second["sha256"] == audio["sha256"], "second_audio_sha")
    asr = next((model for model, reading in (("base.en", audio.get("asr")), ("small", second.get("asr")))
                if audio_agrees(script, reading, shape)), None)
    if not asr and clip_review_agrees(reviewed_clip, script, audio["sha256"]):
        asr = "reviewed_clip"
    require(asr, "audio_transcript_review")
    printed = normalize(word["text"])
    options = [normalize(o) for o in native["options"]]
    output = {"type": "single", "options": options}
    if options:
        require(len(keys) == 1 and keys[0] in ("1", "2", "3") and len(options) == len(set(options)) == 3,
                "publisher_choice")
        key = int(keys[0])
        require(eq_positions(answer) == [key], "teacher_key")
        require(eq_positions(word) == [1, 2, 3], "word_option_order")
        printed_parts = printed.split("\x15")
        printed_stem = printed_parts[0].strip()
        comparable = printed_stem.replace("____", "") if shape == "choose_cloze" else printed_stem
        require(comparable == stem and [s.strip() for s in printed_parts[1:]] == options,
                "word_option_text")
        if shape == "choose_sentence":
            require([i for i, o in enumerate(options, 1) if spoken(o) == spoken(script)] == [key], "audio_choice_key")
        elif shape == "choose_cloze":
            require(printed_stem.count("____") == 1, "word_cloze_blank")
            stem = printed_stem
            blank = re.sub(r"^\(\s*\)\s*", "", stem)
            require([i for i, o in enumerate(options, 1) if spoken(blank.replace("____", o)) == spoken(script)] == [key],
                    "audio_cloze_key")
        elif shape == "choose_initial":
            wordlist = [x.strip().lower() for x in script.split(",")]
            require(len(wordlist) == 2 and {w[0] for w in wordlist} == {options[key-1]}, "audio_initial_key")
        elif shape == "choose_odd_sound":
            completions = [x.strip(" ,") for x in re.split(r"\b[A-C]\.\s*", script)[1:]]
            letters = [re.fullmatch(re.escape(o).replace("_", "([a-z])"), v, re.I)
                       for o, v in zip(options, completions)]
            require(len(completions) == 3 and all(letters), "audio_odd_word")
            found = [m[1].lower() for m in letters]
            require([i for i, letter in enumerate(found, 1) if found.count(letter) == 1] == [key] and len(set(found)) == 2,
                    "audio_odd_key")
        else:
            raise ValueError("unsupported_choice")
        output["answer"] = key
    elif shape in ("order_letters", "order_sentences"):
        chunks = re.split(r"\(\s*\)\s*", stem)[1:]
        original = re.split(r"\(\s*\)\s*", printed)[1:]
        hearing = ordered_script(script)
        require(len(chunks) == len(keys) == len(hearing) == 3 and all(chunks), "order_structure")
        require(chunks == original and keys == teacher_text(answer).split(";"), "order_word_key")
        require({spoken(h) for h in hearing} == {spoken(c) for c in chunks}, "audio_order_content")
        require(keys == [str([spoken(h) for h in hearing].index(spoken(c))+1) for c in chunks], "audio_order_key")
        output = {"type": "sequence", "options": chunks, "answer": [int(k) for k in keys]}
    else:
        require(len(keys) == 1 and keys[0] == teacher_text(answer), "teacher_key")
        if shape in ("check_word", "check_phonics"):
            options = re.split(r"\s*☐\s*", stem)[1:]
            word_options = re.split(r"\s*□\s*", printed)[1:]
            expected = script.rsplit("/", 1)[-1].strip(" ,") if shape == "check_phonics" else script
            require(options == word_options and keys[0] == expected, "word_checkbox_key")
        elif shape == "choose_letter":
            options = stem.split()
            require(printed == stem and script.lower() == keys[0].lower(), "word_letter_key")
        else:
            stem = re.sub(r"^\(\s*\)\s*", "", stem)
            options = ["○", "╳"]
            require(re.sub(r"^\(\s*\)\s*", "", printed) == stem, "judge_letter_word")
            require(keys[0] == ("○" if stem.lower() == script.lower() else "╳"), "audio_judge_key")
        require(len(options) == len(set(options)) >= 2 and keys[0] in options, "word_selection_unique")
        output.update(options=options, answer=options.index(keys[0])+1)
    unit = UNITS[row["sections"][0]]
    refs = []
    page_refs(script, shape, stem, refs, unit, textbook)
    return {"passed": True, "id": row["id"], "unit": unit, "shape": shape, "label": row["labels"][0],
            "stem": re.sub(r"^\(\s*\)\s*", "", stem) if shape in ("choose_cloze", "judge_letter") else "",
            "audio": audio["path"], "sha256": audio["sha256"], "bytes": audio["bytes"], "asr": asr,
            "script": script, "refs": refs, **output}


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    for name in ("originals", "audio-review", "second-review", "textbook-dir", "output"):
        cli.add_argument("--" + name, required=True, type=Path)
    args = cli.parse_args()
    def read(path):
        return json.loads(path.read_text(encoding="utf-8"))
    audio = {r["id"]: r for r in read(args.audio_review)}
    second = read(args.second_review) if args.second_review.exists() else {}
    result = []
    for item in read(args.originals):
        sid = item["id"]
        try:
            result.append(convert(item, audio[sid], second.get(sid, {}), args.textbook_dir))
        except ValueError as exc:
            result.append({"id": sid, "passed": False, "label": item["labels"][0], "reason": str(exc)})
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(Counter(r.get("reason", r.get("shape")) for r in result))


if __name__ == "__main__":
    main()
