"""只將已核對的分類／價格表合併表頭投影為明確四欄；保留所有資料格。"""
from copy import deepcopy
import re


def project_category_price_header(block):
    expected = [{"row": 0, "column": 0, "colspan": 2}, {"row": 0, "column": 2, "colspan": 2}]
    if block.get("type") != "table" or block.get("source_spans") != expected:
        raise ValueError("exact_category_price_header_required")
    rows = block.get("rows")
    if not isinstance(rows, list) or not 2 <= len(rows) <= 30 or any(not isinstance(row, list) or len(row) != 4 for row in rows):
        raise ValueError("complete_four_column_price_rows_required")

    def text(cell):
        if not isinstance(cell, list) or any(not isinstance(run, dict) or run.get("type") != "text" or not isinstance(run.get("text"), str) for run in cell):
            raise ValueError("text_only_price_table_required")
        return "".join(run["text"] for run in cell).strip()

    if not text(rows[0][0]) or not text(rows[0][2]) or rows[0][1] or rows[0][3]:
        raise ValueError("empty_merged_header_continuations_required")
    for row in rows[1:]:
        if not text(row[0]) or not text(row[2]) or any(not re.fullmatch(r"[0-9]+\s*元", text(row[i])) for i in (1, 3)):
            raise ValueError("complete_named_yuan_prices_required")
    projected = deepcopy(block)
    del projected["source_spans"]
    projected["rows"][0][1] = [{"type": "text", "text": "價格"}]
    projected["rows"][0][3] = [{"type": "text", "text": "價格"}]
    assert projected["rows"][1:] == rows[1:]
    return projected


def project_final_full_width_note(block):
    rows = block.get("rows")
    if block.get("type") != "table" or not isinstance(rows, list) or len(rows) < 3:
        raise ValueError("complete_note_table_required")
    columns = len(rows[0])
    expected = [{"row": len(rows) - 1, "column": 0, "colspan": columns}]
    if not 2 <= columns <= 12 or block.get("source_spans") != expected or any(len(row) != columns for row in rows):
        raise ValueError("exact_final_note_merge_required")
    note = rows[-1][0]
    if not note or any(run.get("type") != "text" or not isinstance(run.get("text"), str) for run in note) or any(rows[-1][1:]):
        raise ValueError("text_only_full_width_note_required")
    text = "".join(run["text"] for run in note).strip()
    if not re.match(r"^(?:[＊*]|備註[：:]|注[：:])", text):
        raise ValueError("explicit_note_marker_required")
    projected = deepcopy(block)
    del projected["source_spans"]
    projected["rows"] = projected["rows"][:-1]
    return [projected, {"type": "paragraph", "runs": deepcopy(note)}]
