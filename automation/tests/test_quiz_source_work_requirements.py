import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from quiz_source_work_requirements import source_work_requirements as requirements, assert_result_only_source_allowed as allow


def catalog(name):
    return {"item_types": [{"name": name}]}


class SourceWorkRequirementsTests(unittest.TestCase):
    def test_header_requires_equation_even_when_docx_body_omits_it(self):
        with self.assertRaisesRegex(ValueError, "equation"):
            allow(catalog("寫出算式做做看"), "一條繩子長17公分，每5公分剪一段，最多幾段？")

    def test_preprinted_vertical_table_is_not_an_automatic_exception(self):
        with self.assertRaisesRegex(ValueError, "vertical_work"):
            allow(catalog("寫出直式算算看"), "公斤 公克 8 750 － 2 125")

    def test_required_method_record(self):
        with self.assertRaisesRegex(ValueError, "equation"):
            allow(catalog("把做法和答案記下來"))

    def test_drawing_coloring_and_matching(self):
        for name, kind in [("畫畫看", "drawing"), ("塗塗看", "coloring"), ("連連看", "matching")]:
            self.assertEqual(requirements(catalog(name))[0]["kind"], kind)

    def test_boolean_circle_and_graphic_choices_do_not_require_free_drawing(self):
        for name in ["對的畫○，錯的打×（是非題）", "圈圈看", "勾選題"]:
            self.assertTrue(allow(catalog(name), "選出正確答案。"))

    def test_colored_picture_description_is_not_a_coloring_instruction(self):
        self.assertTrue(allow(catalog("填填看"), "下面塗色部分是幾分之幾？"))
        self.assertTrue(allow(catalog("勾選題"), "老師讓大家塗滿4等分的顏色，誰塗色的面積最小？"))

    def test_question_body_instruction_also_counts(self):
        with self.assertRaisesRegex(ValueError, "vertical_work"):
            allow(catalog("回答問題"), "請用直式計算。")

    def test_missing_source_type_is_not_pass(self):
        for value in [{}, {"item_types": []}, {"item_types": [{}]}]:
            with self.assertRaisesRegex(ValueError, "publisher_item_types"):
                allow(value)


if __name__ == "__main__":
    unittest.main()
