import sys
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from quiz_docx_merged_table import table_model, table_html, project_no_math_weekday_table as project, NS


def cell(text="", prop=""):
    return '<w:tc><w:tcPr>' + prop + '</w:tcPr><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p></w:tc>'


def table(rows, columns=2):
    return ET.fromstring('<w:tbl xmlns:w="' + NS["w"] + '"><w:tblGrid>' + '<w:gridCol/>' * columns + '</w:tblGrid>' + ''.join('<w:tr>' + row + '</w:tr>' for row in rows) + '</w:tbl>')


class MergedTableTests(unittest.TestCase):
    def schedule(self):
        return {"columns": 6, "grid": [["星期", "一", "二", "三", "四", "五"], ["早上", "朝會", "導師時間", "導師時間", "導師時間", "導師時間"], *[[str(n) + "\n8:45", "數學", "國語", "數學", "數學", "數學"] for n in range(1, 8)], ["中午", "午休", "午休", "午休", "午休", "午休"]]}

    def test_readable_projection_preserves_all_period_courses_and_unique_answer(self):
        model = self.schedule()
        result = project(model, "下面是功課表，星期幾沒有數學？")
        self.assertEqual(result["answer_weekday_1based"], 2)
        self.assertEqual([row[1:] for row in result["rows"][1:]], [row[1:] for row in model["grid"][2:9]])
        self.assertEqual(len(result["omitted_context_rows"]), 2)

    def test_projection_does_not_apply_to_time_questions(self):
        with self.assertRaisesRegex(ValueError, "exact_no_math"):
            project(self.schedule(), "數學課幾時開始？")

    def test_projection_rejects_lost_math_or_missing_period(self):
        model = self.schedule(); model["grid"][1][2] = "數學"
        with self.assertRaisesRegex(ValueError, "omit_math"):
            project(model, "星期幾沒有數學？")
        model = self.schedule(); del model["grid"][3]
        with self.assertRaisesRegex(ValueError, "complete_seven"):
            project(model, "星期幾沒有數學？")
    def test_vertical_span_preserves_schedule_and_html(self):
        model = table_model(table([cell("星期三") + cell("星期四"), cell("放學", '<w:vMerge w:val="restart"/>') + cell("數學"), cell(prop='<w:vMerge/>') + cell("英語")]))
        self.assertEqual(model["grid"], [["星期三", "星期四"], ["放學", "數學"], ["放學", "英語"]])
        self.assertEqual(model["rows"][1][0]["rowspan"], 2)
        self.assertIn('rowspan="2"', table_html(model))

    def test_horizontal_and_vertical_merge_together(self):
        span = '<w:gridSpan w:val="2"/>'
        model = table_model(table([cell("午休", span + '<w:vMerge w:val="restart"/>'), cell(prop=span + '<w:vMerge/>')]))
        self.assertEqual(model["grid"], [["午休", "午休"], ["午休", "午休"]])

    def test_nonempty_continuation_not_discarded(self):
        with self.assertRaisesRegex(ValueError, "nonempty_vertical"):
            table_model(table([cell("放學", '<w:vMerge w:val="restart"/>') + cell("甲"), cell("數學", '<w:vMerge/>') + cell("乙")]))

    def test_unmatched_continuation_and_grid_mismatch_rejected(self):
        for source in [table([cell(prop='<w:vMerge/>') + cell("甲")]), table([cell("甲")])]:
            with self.assertRaises(ValueError):
                table_model(source)

    def test_html_escapes_source_text(self):
        model = table_model(table([cell("&lt;script&gt;") + cell("&amp;")]))
        self.assertIn("&lt;script&gt;", table_html(model))
        self.assertNotIn("<script>", table_html(model))

    def test_math_objects_cannot_silently_disappear(self):
        source = table([cell("甲") + cell("乙")])
        source.find("w:tr/w:tc/w:p", NS).append(ET.Element("{http://schemas.openxmlformats.org/officeDocument/2006/math}oMath"))
        with self.assertRaisesRegex(ValueError, "math_object"):
            table_model(source)

    def test_symbols_and_hidden_text_require_review(self):
        for tag in ["sym", "vanish", "vertAlign"]:
            source = table([cell("甲") + cell("乙")])
            source.find("w:tr/w:tc/w:p", NS).append(ET.Element("{" + NS["w"] + "}" + tag))
            with self.assertRaisesRegex(ValueError, "styled_cell"):
                table_model(source)


if __name__ == "__main__":
    unittest.main()
