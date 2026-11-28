"""Compare Hanlin reading blocks and independent answers with their teacher Word export."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import unicodedata


LABELS = {"Reading Comprehension 閱讀測驗": "reading",
          "Fill In 讀短文或對話，填選正確的答案": "cloze"}
ITEM = re.compile(r"(?m)^\([ \t]*\)\s*\((\d+)\)[ \t]*")
EQ_MARK = re.compile(r"eq \\o\(○,([ABC])\)", re.I)
NATIVE_BLANK = re.compile(r"【\s*】")
TF_HEADER = "Read and Write T (True) or F (False)"


def normalize(text):
    return unicodedata.normalize("NFKC", text).replace("’", "'").replace("\r", "\n").replace("\x0b", "\n")


def plain(text):
    return " ".join(normalize(text).split())


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def read_original(part):
    data = Path(part["path"]).read_bytes()
    require(hashlib.sha256(data).hexdigest() == part["sha"], "source_sha256")
    return data


def eq_letters(fields):
    marks = [EQ_MARK.fullmatch(normalize(field["code"])) for field in fields]
    require(all(marks) and all(not field["result"] for field in fields), "unmapped_word_fields")
    return [mark[1].upper() for mark in marks]


def split_options(body, picture_choices):
    parts = [plain(part) for part in body.split("\x15")]
    require(len(parts) == 4 and all(parts[1:])
            and (picture_choices or len(set(parts[1:])) == 3), "option_boundaries")
    return parts[0], parts[1:]


def verified_images(q, key, info, layout):
    require(not any(piece["shapes"] or piece["tables"] for piece in (q, key)) and not key["inline_images"],
            "multimedia_original")
    require(q["inline_images"] == {None: 0, "material": 1, "options": 3}[layout], "multimedia_original")
    if layout is None:
        return []
    require(len(info["images"]) == q["inline_images"], "unmapped_inline_media")
    read_original({"path": info["container"], "sha": info["container_sha"]})
    for image in info["images"]:
        data = read_original({"path": image["path"], "sha": image["sha256"]})
        require(len(data) == image["bytes"], "original_image_size")
    return info["images"]


def adapt(row, kind, media, layout=None):
    require(len(row["units"]) == 1 and row["units"][0] in (3, 4, 5)
            and not row["audioResources"], "source_scope")
    payload = json.loads(read_original({"path": row["payloadPath"], "sha": row["payloadSha"]}))["content"]
    require(payload == row["native"] and payload.get("preamble"), "missing_native_material")
    q, key = (row["original"][section] for section in ("preamble-question", "answer"))
    for piece in (q, key):
        read_original(piece)
    images = verified_images(q, key, media, layout)
    raw = normalize(q["text"])
    matches = list(ITEM.finditer(raw))
    count = len(payload["questions"])
    require(count in (2, 3) and [int(m[1]) for m in matches] == list(range(1, count + 1)), "question_numbering")
    material = raw[:matches[0].start()].strip()
    comparable_material = material
    if layout == "material":
        require(kind == "reading" and material.splitlines().count("/") == 1,
                "unknown_shared_image_position")
        comparable_material = re.sub(r"(?m)^/$", "", material)
        material = re.sub(r"(?m)^/$", "￼", material)
    require(plain(comparable_material) == plain(payload["preamble"]), "material_differs")
    raw_answers = normalize(key["text"]).strip()
    require(raw_answers.startswith("答案:"), "missing_teacher_key")
    answer_tokens = raw_answers.removeprefix("答案:").split(";")
    keys = [re.fullmatch(r"\s*\((\d+)\)\s*([TF\x15])\s*", token) for token in answer_tokens]
    require(all(keys) and [int(match[1]) for match in keys] == list(range(1, count + 1)), "teacher_numbering")
    true_false = all(match[2] in "TF" for match in keys)
    if true_false:
        require(not q["fields"] and not key["fields"] and material.endswith(TF_HEADER), "unknown_true_false_layout")
        marked = [match[2] for match in keys]
        material = material.removesuffix(TF_HEADER).rstrip()
    else:
        require(all(match[2] == "\x15" for match in keys) and eq_letters(q["fields"]) == list("ABC") * count,
                "Word_option_order")
        marked = eq_letters(key["fields"])
        require(len(marked) == count, "Word_teacher_key_count")

    questions = []
    for i, (match, native, answer) in enumerate(zip(matches, payload["questions"], marked)):
        end = matches[i + 1].start() if i + 1 < count else len(raw)
        body = raw[match.end():end].strip()
        native_stem = plain(NATIVE_BLANK.sub("", native["stem"]))
        if true_false:
            require(plain(body) == native_stem and not native["options"] and native["answers"] == [[answer]],
                    "true_false_source_differs")
            stem, options, index = plain(body), ["True（正確）", "False（錯誤）"], int(answer == "F")
        else:
            trailing_notes = ""
            if "\n*" in body:
                body, trailing_notes = body.split("\n*", 1)
                trailing_notes = " *" + trailing_notes
            picture_choices = layout == "options" and i == 1
            stem, options = split_options(body, picture_choices)
            require(plain(re.sub(r"_{2,}", "", stem) + trailing_notes) == native_stem, "choice_stem_differs")
            if layout == "options" and i == 1:
                require(options == ["/"] * 3 and native["options"] == [""] * 3, "unmapped_picture_choices")
            else:
                require(options == [plain(option) for option in native["options"]], "choice_source_differs")
            index = "ABC".index(answer)
            require(native["answers"] == [[str(index + 1)]], "choice_teacher_native_key_differs")
            if kind == "cloze":
                require(not stem and not trailing_notes, "cloze_has_unmapped_stem")
                stem = f"第 {i + 1} 格應填入哪個選項？"
            elif trailing_notes:
                stem += "\n" + trailing_notes.strip()
        result = {"number": i + 1, "prompt": stem, "options": options, "answer_index": index}
        if layout == "options" and i == 1:
            result["option_art"] = images
        questions.append(result)
    if kind == "cloze":
        require([int(num) for num in re.findall(r"\((\d+)\)", material)] == list(range(1, count + 1)),
                "cloze_material_positions")
    return {"unit": row["units"][0], "kind": kind, "material": material, "questions": questions,
            "material_art": images[0] if layout == "material" else None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--originals", type=Path, required=True)
    parser.add_argument("--images", type=Path, required=True)
    parser.add_argument("--reviewed-layouts", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    rows = []
    images = json.loads(args.images.read_text(encoding="utf8"))
    layouts = json.loads(args.reviewed_layouts.read_text(encoding="utf8"))
    for row in json.loads(args.originals.read_text(encoding="utf8")):
        if len(row["types"]) != 1 or row["types"][0] not in LABELS:
            continue
        result = {"source": row["source"]}
        try:
            source = row["source"]
            layout = layouts.get(source)
            media = images.get(source, {})
            if layout:
                require([image["sha256"] for image in media.get("images", [])] == layout["hashes"],
                        "original_image_order_unverified")
            result.update(adapt(row, LABELS[row["types"][0]], media, layout and layout["kind"]), passed=True)
        except (ValueError, OSError) as error:
            result.update(passed=False, reason=str(error))
        rows.append(result)
    args.output.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    print(sum(r["passed"] for r in rows), len(rows), sum(len(r.get("questions", [])) for r in rows))


if __name__ == "__main__":
    main()
