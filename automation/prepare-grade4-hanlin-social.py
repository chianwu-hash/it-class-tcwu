"""Check original Grade 4 Hanlin social studies choices and true/false keys."""

import argparse
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import re
import unicodedata


CHAPTERS = {"382307":3, "382310":4, "382314":5, "382318":6}
BOOLEAN = {"○":"a", "◯":"a", "〇":"a", "×":"b", "╳":"b"}
ORDINALS = "①②③④"


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def compact(text):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", text)).rstrip("。")


def plain(text):
    return {"text":text, "media":[]}


def explanation_text(text, answer):
    text = text.strip()
    marker = re.match(r"^\s*(?:解析[：:]\s*|詳解[：:]\s*)?([①②③④])\s*", text)
    if marker:
        require(answer == "abcd"[ORDINALS.index(marker[1])], "word_solution_key_disagrees")
        text = text[marker.end():].strip()
    require(text and not re.search(r"[①②③④]|選項\s*[A-D1-4]|故選\s*[A-D1-4]", text),
            "word_solution_unavailable")
    return text


def adapt(native):
    supported = {type_row["name"] for type_row in native["types"]}
    require(len(supported.intersection({"選擇題","是非題"})) == 1, "other_layout")
    source = native["original_json"]["content"]
    items = source["questions"]
    require(len(items) == 1 and not compact(source.get("preamble") or ""), "other_layout")
    item, = items
    require(len(item["answers"]) == 1 and len(item["answers"][0]) == 1, "publisher_answer_shape")
    raw_answer = str(item["answers"][0][0]).strip()
    docs = native["documents"]
    key = docs["answer.docx.gz"]
    question = docs["preamble-question.docx.gz"]
    require(not key["media"] and not question["media"], "original_media")
    word_key = re.fullmatch(r"答案\s*[：:]\s*(\S)\s*", key["text"])
    require(word_key, "word_answer_shape")

    if "選擇題" in supported:
        require(raw_answer in "1234" and len(raw_answer) == 1
                and word_key[1] == ORDINALS[int(raw_answer)-1], "word_answer_key")
        candidate = native["single_choice"]
        prompt, options, answer = candidate["prompt"], candidate["options"], candidate["answer"]
        require(not prompt["media"] and all(not o["content"]["media"] for o in options)
                and compact(prompt["text"]) == compact(item["stem"])
                and [compact(o["content"]["text"]) for o in options] == list(map(compact, item["options"]))
                and answer["option_id"] == "abcd"[int(raw_answer)-1], "original_choice_alignment")
        options = [{"id":o["id"], "content":plain(o["content"]["text"])} for o in options]
    else:
        require(raw_answer in BOOLEAN and word_key[1] == raw_answer, "word_answer_key")
        prompt = question
        require(not item["options"] and compact(prompt["text"]) == compact(item["stem"]), "original_word_alignment")
        options = [{"id":"a", "content":plain("○")}, {"id":"b", "content":plain("×")}]
        answer = {"option_id":BOOLEAN[raw_answer]}
    require(len({compact(o["content"]["text"]) for o in options}) == len(options), "duplicate_options")
    solution = docs.get("solution.docx.gz", {})
    require(not solution.get("media"), "solution_media")
    explanation = explanation_text(solution.get("text", ""), answer["option_id"])
    return {"type":"single", "prompt":plain(prompt["text"]), "options":options, "answer":answer,
            "explanation":plain(explanation)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for arg in ("native-records","source-records","originals","output"):
        parser.add_argument("--"+arg, required=True, type=Path)
    args = parser.parse_args()
    original = {r["id"]:r for r in read(args.source_records)}
    records = read(args.native_records)
    require(len({r["id"] for r in records}) == len(records) and all(r["id"] in original for r in records),
            "duplicate_or_missing_publisher_source")
    results = []
    for native in records:
        sid = native["id"]
        try:
            units = {CHAPTERS[s] for s in native["sections"] if s in CHAPTERS}
            require(len(units) == 1, "multiple_original_units")
            question = adapt(native)
            sources = {f["name"]:f["sha256"] for f in original[sid]["resources"]}
            selected = ("item.json", "preamble-question.docx.gz", "answer.docx.gz", "solution.docx.gz")
            for name in selected:
                actual = sha256((args.originals/sid/name).read_bytes()).hexdigest()
                require(actual == sources[name], "original_resource_hash")
            results.append({"source":sid,"passed":True,"unit":units.pop(),"sections":native["sections"],
                            "difficulty":native["difficulty"],"question":question,
                            "sha256":{name:sources[name] for name in selected}})
        except (ValueError, KeyError, OSError) as error:
            reason = str(error) if isinstance(error, ValueError) else "original_document_unavailable"
            results.append({"source":sid,"passed":False,"reason":reason})
    args.output.write_text(json.dumps(results,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(Counter(row["unit"] if row["passed"] else row["reason"] for row in results))


if __name__ == "__main__":
    main()
