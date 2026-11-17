"""確定性保留Word表格的水平／垂直合併；不讀教師鍵、不猜缺格。"""
from html import escape
import re
from xml.etree import ElementTree as ET

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
W = "{" + NS["w"] + "}"


def table_model(table):
    columns = len(table.findall("w:tblGrid/w:gridCol", NS))
    if not 1 <= columns <= 16:
        raise ValueError("declared_table_grid_required")
    rows, cells, active, original_text = [], [], {}, []
    for row_index, row in enumerate(table.findall("w:tr", NS)):
        if row.find("w:trPr/w:gridBefore", NS) is not None or row.find("w:trPr/w:gridAfter", NS) is not None:
            raise ValueError("offset_table_row_requires_review")
        output, next_active, column = [], {}, 0
        continued = set()
        for cell in row.findall("w:tc", NS):
            if any(cell.find(".//" + tag, NS) is not None for tag in ["w:drawing", "w:pict", "w:tbl", "w:object", "w:sym", "w:vanish", "w:webHidden", "w:vertAlign"]):
                raise ValueError("nested_graphic_symbol_or_styled_cell_requires_review")
            math_namespace = "{http://schemas.openxmlformats.org/officeDocument/2006/math}"
            if any(node.tag in (math_namespace + "oMath", math_namespace + "oMathPara") for node in cell.iter()):
                raise ValueError("math_object_requires_review")
            span_node = cell.find("w:tcPr/w:gridSpan", NS)
            span = int(span_node.get(W + "val")) if span_node is not None else 1
            if span < 1 or column + span > columns:
                raise ValueError("table_cell_outside_grid")
            paragraphs = []
            for p in cell.findall("w:p", NS):
                paragraphs.append("".join(node.text or "" if node.tag == W + "t" else "\n" if node.tag in (W + "br", W + "cr") else "\t" for node in p.iter() if node.tag in (W + "t", W + "br", W + "cr", W + "tab")))
            text = "\n".join(paragraphs).strip()
            if text:
                original_text.append(text)
            merge = cell.find("w:tcPr/w:vMerge", NS)
            continuation = merge is not None and merge.get(W + "val", "continue") == "continue"
            if continuation:
                master = active.get(column)
                if text or master is None or master["column"] != column or master["colspan"] != span or any(active.get(c) is not master for c in range(column, column + span)):
                    raise ValueError("unmatched_or_nonempty_vertical_continuation")
                if id(master) not in continued:
                    master["rowspan"] += 1
                    continued.add(id(master))
                for c in range(column, column + span):
                    next_active[c] = master
            else:
                if merge is not None and merge.get(W + "val") != "restart":
                    raise ValueError("unknown_vertical_merge")
                master = {"row": row_index, "column": column, "rowspan": 1, "colspan": span, "text": text}
                output.append(master); cells.append(master)
                if merge is not None:
                    for c in range(column, column + span):
                        next_active[c] = master
            column += span
        if column != columns:
            raise ValueError("incomplete_table_grid_row")
        rows.append(output); active = next_active
    if not rows or len(rows) > 80:
        raise ValueError("bounded_table_required")
    grid = [[None] * columns for _ in rows]
    for cell in cells:
        for r in range(cell["row"], cell["row"] + cell["rowspan"]):
            for c in range(cell["column"], cell["column"] + cell["colspan"]):
                if r >= len(grid) or grid[r][c] is not None:
                    raise ValueError("overlapping_or_outside_table_merge")
                grid[r][c] = cell["text"]
    if any(value is None for row in grid for value in row):
        raise ValueError("uncovered_table_grid")
    if [cell["text"] for cell in cells if cell["text"]] != original_text:
        raise ValueError("source_table_text_changed")
    return {"columns": columns, "rows": rows, "grid": grid, "source_text": original_text}


def table_html(model):
    return '<table lang="zh-Hant">' + "".join("<tr>" + "".join('<td rowspan="' + str(cell["rowspan"]) + '" colspan="' + str(cell["colspan"]) + '">' + escape(cell["text"]).replace("\n", "<br>") + "</td>" for cell in row) + "</tr>" for row in model["rows"]) + "</table>"


def project_no_math_weekday_table(model, question_stem):
    """限單一『星期幾沒有數學』題；保留每節所有課程，原完整課表另存。

    非上課的時段列不能藏有數學，星期欄不得重排；只省略此題不問的
    時間／休息列。其他功課表問題不可使用此投影。
    """
    if not re.fullmatch(r"[^？?]*星期幾沒有數學[？?]", question_stem.strip()):
        raise ValueError("exact_no_math_weekday_question_required")
    grid = model["grid"]
    if model["columns"] != 6 or grid[0] != ["星期", "一", "二", "三", "四", "五"]:
        raise ValueError("ordered_weekday_columns_required")
    periods, omitted = [], []
    for row in grid[1:]:
        match = re.match(r"^([1-7])\s*\n", row[0])
        if match:
            periods.append((int(match[1]), row))
        else:
            omitted.append(row)
            if any("數學" in value for value in row[1:]):
                raise ValueError("cannot_omit_math_course")
    if [n for n, _ in periods] != list(range(1, 8)):
        raise ValueError("complete_seven_periods_required")
    compact = lambda text: "".join(text.split())
    original_math = [any(compact(row[c]) == "數學" for row in grid[1:]) for c in range(1, 6)]
    retained_math = [any(compact(row[c]) == "數學" for _, row in periods) for c in range(1, 6)]
    if original_math != retained_math or original_math.count(False) != 1:
        raise ValueError("unique_source_weekday_answer_required")
    rows = [["節次\n星期", "一", "二", "三", "四", "五"]] + [[str(n), *row[1:]] for n, row in periods]
    return {"rows": rows, "omitted_context_rows": omitted, "math_days": original_math, "answer_weekday_1based": original_math.index(False) + 1}
