"""Verify the Hanlin word-bank dialogue layout against the original teacher key."""

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import unicodedata


LABEL = "Read and Copy 依提示完成句子"
WORD_SLOTS = re.compile("＿{2,}")
NATIVE_SLOTS = re.compile(r"【\s*】")


def normalized(value):
    return " ".join(unicodedata.normalize("NFKC", value).replace("’", "'").split())


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def original_bytes(path, expected):
    data = Path(path).read_bytes()
    require(hashlib.sha256(data).hexdigest() == expected, "source_sha256")
    return data


def adapt(row):
    require(len(row["units"]) == 1 and row["units"][0] in (3, 4)
            and not row["audioResources"], "source_scope")
    content = json.loads(original_bytes(row["payloadPath"], row["payloadSha"]))["content"]
    require(content == row["native"] and not content.get("preamble")
            and len(content["questions"]) == 1, "native_question_group")
    native = content["questions"][0]
    prompt, key = (row["original"][part] for part in ("preamble-question", "answer"))
    for part in (prompt, key):
        original_bytes(part["path"], part["sha"])
        require(not any(part[item] for item in ("inline_images", "shapes", "fields")), "unexpected_word_markup")
    require(prompt["tables"] == 1 and not key["tables"] and not native["options"],
            "unexpected_word_bank_layout")
    segments = prompt["text"].strip().split("\r\x07\r\x07\r")
    require(len(segments) == 2, "word_bank_boundary")
    original_bank, dialogue = segments
    bank = [normalized(word) for word in original_bank.split("\u3000")]
    teacher = normalized(key["text"])
    require(teacher.startswith("答案:"), "missing_teacher_key")
    answers = [word.strip() for word in teacher.removeprefix("答案:").split(";")]
    require(len(bank) == len(set(bank)) and all(bank)
            and Counter(bank) == Counter(answers)
            and len(answers) == len(WORD_SLOTS.findall(dialogue)) == len(NATIVE_SLOTS.findall(native["stem"])),
            "bank_or_positions_differ")
    require([[normalized(word) for word in group] for group in native["answers"]] == [[word] for word in answers],
            "teacher_and_publisher_differ")
    # The Word export uses fullwidth underscores; the native stem uses ideographic whitespace.
    visible = normalized(original_bank + " " + WORD_SLOTS.sub("", dialogue))
    require(visible == normalized(NATIVE_SLOTS.sub("", native["stem"])), "word_and_native_dialogue_differ")
    slots = iter(range(1, len(answers) + 1))
    marked = WORD_SLOTS.sub(lambda _: f"〔{next(slots)}〕", dialogue).replace("\r", "\n")
    keys = iter(answers)
    completed = WORD_SLOTS.sub(lambda _: next(keys), dialogue).replace("\r", "\n")
    return {"unit": row["units"][0], "answers": answers,
            "prompt": "從詞庫選字，填在對應的答案欄。\n" + "　".join(bank) + "\n" + marked,
            "completed": normalized(completed)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--originals", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    results = []
    for row in json.loads(args.originals.read_text(encoding="utf8")):
        if row["types"] != [LABEL]:
            continue
        result = {"source": row["source"]}
        try:
            result.update(adapt(row), passed=True)
        except (OSError, ValueError) as error:
            result.update(passed=False, reason=str(error))
        results.append(result)
    args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(sum(row["passed"] for row in results), len(results),
          sum(len(row.get("answers", ())) for row in results))


if __name__ == "__main__":
    main()
