import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from quiz_price_table_projection import project_category_price_header as project, project_final_full_width_note as project_note


def cell(text):
    return [{"type": "text", "text": text}]


def source():
    return {"type": "table", "rows": [[cell("麵類"), [], cell("小菜"), []], [cell("牛肉麵"), cell("230 元"), cell("泡菜"), cell("40 元")]], "source_spans": [{"row": 0, "column": 0, "colspan": 2}, {"row": 0, "column": 2, "colspan": 2}]}


class PriceProjectionTests(unittest.TestCase):
    def note_source(self):
        return {"type": "table", "rows": [[cell("路線"), cell("全票（元）"), cell("學童票（元）")], [cell("臺北－臺南"), cell("480"), cell("265")], [cell("＊18歲以下為學童票"), [], []]], "source_spans": [{"row": 2, "column": 0, "colspan": 3}]}

    def test_note_moves_without_losing_original_rows_or_text(self):
        block = self.note_source(); before = copy.deepcopy(block)
        table, note = project_note(block)
        self.assertEqual(block, before)
        self.assertEqual(table["rows"], before["rows"][:-1])
        self.assertEqual(note["runs"], before["rows"][-1][0])

    def test_total_row_is_not_misclassified_as_note(self):
        block = self.note_source(); block["rows"][-1][0] = cell("合計 745元")
        with self.assertRaisesRegex(ValueError, "explicit_note"):
            project_note(block)

    def test_note_cannot_discard_another_cell(self):
        block = self.note_source(); block["rows"][-1][1] = cell("必要限制")
        with self.assertRaisesRegex(ValueError, "full_width_note"):
            project_note(block)

    def test_header_merge_is_not_note_projection(self):
        with self.assertRaisesRegex(ValueError, "note_table|note_merge"):
            project_note(source())

    def test_source_retained_and_data_cells_exact(self):
        original = source()
        before = copy.deepcopy(original)
        result = project(original)
        self.assertEqual(original, before)
        self.assertEqual(result["rows"][1:], original["rows"][1:])
        self.assertNotIn("source_spans", result)
        self.assertEqual(result["rows"][0], [cell("麵類"), cell("價格"), cell("小菜"), cell("價格")])

    def test_vertical_or_other_merge_rejected(self):
        for span in [{"row": 1, "column": 0, "rowspan": 2}, {"row": 0, "column": 0, "colspan": 4}]:
            value = source(); value["source_spans"] = [span]
            with self.assertRaisesRegex(ValueError, "exact_category"):
                project(value)

    def test_no_missing_amounts_or_inferred_units(self):
        for value in [[], cell("230"), cell("? 元")]:
            block = source(); block["rows"][1][1] = value
            with self.assertRaisesRegex(ValueError, "named_yuan"):
                project(block)

    def test_nonempty_continuation_is_not_discarded(self):
        block = source(); block["rows"][0][1] = cell("注意")
        with self.assertRaisesRegex(ValueError, "continuations"):
            project(block)


if __name__ == "__main__":
    unittest.main()
