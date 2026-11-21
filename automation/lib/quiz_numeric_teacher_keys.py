"""確定性核對原 Word 數值鍵；不從解題過程猜答案，不決定題型或圖位。"""
from fractions import Fraction
import re
import unicodedata

NUMBER = r"[+-]?[0-9０-９]+(?:\.[0-9０-９]+)?(?:/[0-9０-９]+)?"
ALPHABETS = ("①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳", "ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩ")


def scalar(value):
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise ValueError("not_scalar_number")
    text = unicodedata.normalize("NFKC", str(value)).strip()
    if not re.fullmatch(r"[+-]?\d+(?:\.\d+)?(?:/\d+)?", text, re.ASCII):
        raise ValueError("not_scalar_number")
    try:
        Fraction(text)
    except (ValueError, ZeroDivisionError) as error:
        raise ValueError("invalid_scalar_number") from error
    return text


def parse_teacher_numeric_key(text, *, question_text="", allow_final_line=True):
    """回傳完整鍵或明示「答：」行的數值及來源方式；任何未解結構均拒絕。

    呼叫端仍須核原件 SHA、無教師圖像、全部複核位置、題型／過程要求、
    實體格位及答案順序。此函式通過不代表題目已適合上線。
    """
    if not isinstance(text, str):
        raise ValueError("teacher_text_required")
    value = re.sub(r"^\s*答案\s*[:：]\s*", "", text).strip()
    # 先保留符號邊界，禁止將帶分數 2 + 3/5 合併為 23/5。
    if re.search(r"[0-9０-９]\s*\$\\frac", value) or re.search(r"\$\\frac\{\d+\}\{\d+\}\$\s*[0-9０-９]", value):
        raise ValueError("mixed_number_requires_mapping")
    finals = list(re.finditer(r"(?:^|\n)答[：:]", value))
    if len(finals) > 1:
        raise ValueError("multiple_final_answers_require_mapping")
    method = "entire_teacher_key"
    if finals:
        if not allow_final_line:
            raise ValueError("final_answer_line_not_allowed")
        value = value[finals[0].end():].strip()
        method = "explicit_final_answer_line"
    value = re.sub(r"\$\\frac\{(\d+)\}\{(\d+)\}\$", r"\1/\2", value)
    labels = []
    # 只移除鍵的段首標號，不能刪算式裡的括號數值。
    label_pattern = r"(?:^|[；;\n])\s*[（(]\s*([０-９0-9]+)\s*[）)]"
    numbers = re.findall(label_pattern, value)
    if numbers:
        if [int(unicodedata.normalize("NFKC", v)) for v in numbers] != list(range(1, len(numbers) + 1)):
            raise ValueError("teacher_nonsequential_labels")
        value = re.sub(label_pattern, lambda m: ";" if m.start() else "", value)
        labels.extend(numbers)
    for alphabet in ALPHABETS:
        pattern = r"(?:^|[；;])\s*([" + alphabet + r"])\s*[:：]?\s*"
        found = re.findall(pattern, value)
        if not found:
            continue
        if found != list(alphabet[:len(found)]):
            raise ValueError("teacher_symbol_labels_not_sequential")
        if any(label not in question_text for label in found):
            raise ValueError("teacher_symbol_label_not_visible_in_question")
        value = re.sub(pattern, lambda m: ";" if m.start() else "", value)
        labels.extend(found)
        method += " + original_symbol_labels"
    if any(character in value for alphabet in ALPHABETS for character in alphabet):
        raise ValueError("teacher_label_requires_mapping")
    if method == "explicit_final_answer_line":
        if re.search(r"[0-9０-９][,，][0-9０-９]{3}(?![0-9０-９])", value):
            raise ValueError("thousands_separator_requires_mapping")
        if re.search(r"解析|解法|說明|算式|答案", value):
            raise ValueError("final_answer_contains_other_sections")
        values = re.findall(NUMBER, value)
        residue = re.sub(NUMBER, "", value)
        if re.search(r"[+＋\-－×÷=＝/／<>＜＞()（）]", residue):
            raise ValueError("final_answer_still_contains_equation")
    else:
        value = value.strip().rstrip("；;").strip()
        values = [part.strip() for part in re.split("[；;]", value)] if value else []
    if not values:
        raise ValueError("empty_teacher_key")
    return {"values": [scalar(v) for v in values], "method": method, "removed_labels": labels}


def compare_teacher_numeric_key(parsed, reviewed_values):
    values = parsed["values"]
    if len(values) != len(reviewed_values):
        raise ValueError("teacher_position_count")
    if [Fraction(v) for v in values] != [Fraction(scalar(v)) for v in reviewed_values]:
        raise ValueError("teacher_values_mismatch")
    return True


def parse_teacher_number_units_key(text, *, question_text):
    """Read a result-only key without inferring graphic positions or unit conversions."""
    unit_number = r"(?P<value>" + NUMBER + r")"
    units = r"公斤|公克|時|分|元|人|個|張|片|格|杯|枝|顆|塊"
    bare = re.compile(r"^" + unit_number + r"\s*(?P<unit>" + units + r")?$")
    compound = re.compile(
        r"^(?P<major>" + NUMBER + r")\s*(?P<major_unit>公斤|時)\s*"
        r"(?P<minor>" + NUMBER + r")\s*(?P<minor_unit>公克|分)$"
    )
    labels = r"([" + "".join(ALPHABETS) + r"]|[（(][0-9０-９]+[）)])"
    value = re.sub(r"^\s*答案\s*[:：]\s*", "", text).strip()
    if not value:
        raise ValueError("empty_teacher_key")
    parts = re.split(r"[；;]", re.sub(r"[；;]$", "", value))
    output, slot_units, alternatives, seen = [], [], [], []
    for part in parts:
        part = part.strip()
        label = re.match(r"^" + labels + r"\s*[:：]?\s*", part)
        if label:
            raw_label = label[1]
            if len(raw_label) == 1:
                if raw_label not in question_text:
                    raise ValueError("teacher_symbol_label_not_visible_in_question")
                sequence = next(a for a in ALPHABETS if raw_label in a)
                label_key = (sequence, sequence.index(raw_label) + 1)
            else:
                normalized = unicodedata.normalize("NFKC", raw_label)
                if normalized not in unicodedata.normalize("NFKC", question_text):
                    raise ValueError("teacher_number_label_not_visible_in_question")
                label_key = ("numbered", int(normalized[1:-1]))
            if (seen and label_key[0] != seen[0][0]) or label_key[1] != len(seen) + 1:
                raise ValueError("teacher_labels_require_mapping")
            seen.append(label_key)
            part = part[label.end():].strip()
        finals = list(re.finditer(r"(?:^|\n)\s*答[：:]\s*", part))
        if finals:
            # Printed subquestion labels bind each key segment to its own final-answer line.
            if not label or len(finals) != 1:
                raise ValueError("final_answer_requires_subquestion_mapping")
            part = part[finals[0].end():].strip()
        if re.search(r"[0-9０-９]\s*\$\\frac|\$\\frac\{\d+\}\{\d+\}\$\s*[0-9０-９]", part):
            raise ValueError("mixed_number_requires_mapping")
        part = re.sub(r"\$\\frac\{(\d+)\}\{(\d+)\}\$", r"\1/\2", part)
        part = unicodedata.normalize("NFKC", part).strip()
        pair = compound.fullmatch(part)
        if pair:
            unit_pair = (pair["major_unit"], pair["minor_unit"])
            if unit_pair not in (("公斤", "公克"), ("時", "分")):
                raise ValueError("compound_unit_requires_mapping")
            output.extend([scalar(pair["major"]), scalar(pair["minor"])])
            slot_units.extend(unit_pair)
            alternatives.extend([[], []])
            continue
        variants = re.fullmatch(r"(.+?)\s*(?:\(\s*或\s*([^()]+)\)|或\s*([^()]+))", part)
        primary = bare.fullmatch(variants[1].strip() if variants else part)
        if not primary:
            raise ValueError("number_units_key_requires_mapping")
        result = scalar(primary["value"])
        aliases = []
        if variants:
            alternative = bare.fullmatch((variants[2] or variants[3]).strip())
            if not alternative or alternative["unit"] != primary["unit"] or Fraction(scalar(alternative["value"])) != Fraction(result):
                raise ValueError("teacher_alternative_requires_mapping")
            aliases.append(scalar(alternative["value"]))
        output.append(result)
        slot_units.append(primary["unit"])
        alternatives.append(aliases)
    return {"values": output, "units": slot_units, "alternatives": alternatives, "method": "original_result_segments"}


def match_teacher_table_keys(question, teacher):
    """只取同形原表中「題目空白、教師填值」的數值格，保留原表座標。

    所有已印字／圖必須保持一致，教師表只能唯一配對；不支援合併表格。
    呼叫端須另外核完整位置數及順序，不能把部分配到的格當整題完成。
    """
    def identity(cell, media):
        return [
            (run["type"], re.sub(r"\s+", "", run["text"]) if run["type"] == "text"
             else media[run["media_index"]]["url"].rsplit("/", 1)[-1])
            for run in cell if run["type"] != "text" or run["text"].strip()
        ]

    teachers = [(i, block) for i, block in enumerate(teacher.get("layout", [])) if block["type"] == "table"]
    result, used = [], set()
    for qi, source in enumerate(question.get("layout", [])):
        if source["type"] != "table":
            continue
        if source.get("source_spans"):
            raise ValueError("merged_source_table")
        matches = []
        for ti, answer in teachers:
            if ti in used or answer.get("source_spans") or len(source["rows"]) != len(answer["rows"]):
                continue
            if any(len(qr) != len(ar) for qr, ar in zip(source["rows"], answer["rows"])):
                continue
            cells, valid = [], True
            for ri, (qr, ar) in enumerate(zip(source["rows"], answer["rows"])):
                for ci, (qc, ac) in enumerate(zip(qr, ar)):
                    if identity(qc, question.get("media", [])):
                        if identity(qc, question.get("media", [])) != identity(ac, teacher.get("media", [])):
                            valid = False
                            break
                    elif identity(ac, teacher.get("media", [])):
                        if any(run["type"] != "text" for run in ac):
                            valid = False
                            break
                        text = "".join(run.get("text", "") for run in ac).strip()
                        text = re.sub(r"^\$\\frac\{(\d+)\}\{(\d+)\}\$$", r"\1/\2", text)
                        try:
                            value = scalar(text)
                        except ValueError:
                            valid = False
                            break
                        cells.append({"question_layout_index": qi, "teacher_layout_index": ti,
                                      "row": ri, "column": ci, "value": value})
                if not valid:
                    break
            if valid and cells:
                matches.append((ti, cells))
        if len(matches) > 1:
            raise ValueError("ambiguous_teacher_table")
        if matches:
            ti, cells = matches[0]
            used.add(ti)
            result.extend(cells)
    return result
