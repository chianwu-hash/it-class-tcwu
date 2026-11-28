"""Convert Kang Hsuan Word objective questions with matching publisher answer keys."""
import argparse
import hashlib
import json
import re
import unicodedata
from pathlib import Path, PureWindowsPath
from xml.etree import ElementTree as ET
from zipfile import BadZipFile, ZipFile

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
MARKERS = "①②③④"
TRUE_FALSE = {"○": "a", "Ｏ": "a", "O": "a", "╳": "b", "×": "b", "Ｘ": "b", "X": "b"}
CIRCLED_KEYS = dict(zip(MARKERS, "abcd"))
NUMERIC_KEYS = dict(zip("1234", "abcd"))
SUPPORTED_TYPES = {"11", "55", "56", "57"}
DIFFICULTY = {"A": -3, "B": 0, "C": 3}
SEMANTIC_MARKUP = {"drawing", "pict", "object", "ruby", "oMath", "oMathPara"}
FORMAT_REFERENCES = re.compile(r"畫線|劃線|底線|加線|著色處|粗體|紅色|畫記處")

def local_name(element):
    return element.tag.rsplit("}", 1)[-1]

def rich(text):
    return {"text": text, "media": []}

def cell_text(cell):
    paragraphs = []
    for paragraph in cell.findall(W + "p"):
        pieces = []
        for node in paragraph.iter():
            if node.tag == W + "t":
                pieces.append(node.text or "")
            elif node.tag == W + "tab":
                pieces.append(" ")
            elif node.tag == W + "br":
                pieces.append("\n")
        paragraphs.append("".join(pieces).strip())
    return "\n".join(paragraphs).strip()

def answer_key(value, is_tf):
    normalized = str(value or "").strip()
    if not is_tf and normalized in CIRCLED_KEYS:
        return CIRCLED_KEYS[normalized]
    normalized = unicodedata.normalize("NFKC", normalized)
    return (TRUE_FALSE if is_tf else NUMERIC_KEYS).get(normalized)

def read_original(path):
    with ZipFile(path) as word:
        root = ET.fromstring(word.read("word/document.xml"))
    body = root.find(W + "body")
    if body is None:
        raise ValueError("missing_word_body")
    if any(local_name(node) not in {"tbl", "p", "sectPr"} for node in body):
        raise ValueError("unexpected_word_body")
    if any((node.text or "").strip() for paragraph in body.findall(W + "p") for node in paragraph.iter(W + "t")):
        raise ValueError("unexpected_outer_word_text")
    tables = body.findall(W + "tbl")
    if len(tables) != 1:
        raise ValueError("not_one_word_table")
    rows = [row.findall(W + "tc") for row in tables[0].findall(W + "tr")]
    if len(rows) != 2 or any(len(row) != 3 for row in rows):
        raise ValueError("not_one_three_column_question")
    if [cell_text(c) for c in rows[0]] != ["題目", "答案", "解析"]:
        raise ValueError("unknown_word_column_order")
    if any(local_name(e) in SEMANTIC_MARKUP for cell in rows[1] for e in cell.iter()):
        raise ValueError("word_media_or_ruby")
    return tuple(cell_text(c) for c in rows[1])

def convert(record, source_root):
    qtype = record["type"]
    if qtype not in SUPPORTED_TYPES or record.get("ansNum") != 1:
        raise ValueError("not_one_objective_answer")
    if record.get("difficulty") not in DIFFICULTY:
        raise ValueError("unknown_publisher_difficulty")
    member = PureWindowsPath(record["member"] or "")
    if member.is_absolute() or ".." in member.parts or member.stem != record["id"]:
        raise ValueError("unbound_original_member")
    original = source_root.joinpath(*member.parts)
    if not original.is_file():
        raise ValueError("word_not_extracted")
    prompt, teacher_key, solution = read_original(original)
    fixed_key = re.fullmatch(r"《答案》\s*(\S+)", teacher_key)
    is_tf = qtype == "11"
    key = answer_key(fixed_key.group(1), is_tf) if fixed_key else None
    if not key or key != answer_key(record["rawAnswer"], is_tf):
        raise ValueError("teacher_word_and_catalog_mismatch")
    if not prompt or FORMAT_REFERENCES.search(prompt):
        raise ValueError("stem_needs_visual_review")
    if is_tf:
        if any(marker in prompt for marker in MARKERS):
            raise ValueError("true_false_with_embedded_choices")
        options = ["○", "×"]
    else:
        found = list(re.finditer(f"[{MARKERS}]", prompt))
        if "".join(match.group(0) for match in found) != MARKERS:
            raise ValueError("unmatched_original_option_ordinals")
        options = [prompt[match.end():found[i + 1].start() if i + 1 < len(found) else len(prompt)].strip()
                   for i, match in enumerate(found)]
        prompt = prompt[:found[0].start()].strip()
        if not prompt or not all(options) or len(set(options)) != len(options):
            raise ValueError("empty_or_identical_original_options")
    solution = re.sub(r"^(?:詳解|解析)\s*[：:]\s*", "", solution).strip()
    return {
        "wordSha256": hashlib.sha256(original.read_bytes()).hexdigest(),
        "difficulty": DIFFICULTY[record["difficulty"]],
        "publisherExplanation": solution,
        "question": {
            "type": "single",
            "prompt": rich(prompt),
            "options": [{"id": key, "content": rich(value)} for key, value in zip("abcd", options)],
            "answer": {"option_id": key},
            "explanation": rich(solution),
        }
    }

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--word-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--unit", type=int, choices=range(7, 13), required=True)
    args = parser.parse_args()
    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    results = []
    for row in catalog["rows"]:
        if row["u"] != args.unit or row["type"] not in SUPPORTED_TYPES:
            continue
        result = {"id": row["id"], "type": row["type"], "publisherDifficulty": row["difficulty"], "member": row["member"]}
        try:
            result.update(convert(row, args.word_root), passed=True)
        except (BadZipFile, ET.ParseError, KeyError):
            result.update(passed=False, reason="unreadable_word")
        except ValueError as error:
            result.update(passed=False, reason=str(error))
        results.append(result)
    args.output.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"sources": len(results), "passed": sum(r["passed"] for r in results)}, ensure_ascii=False))

if __name__ == "__main__":
    main()
