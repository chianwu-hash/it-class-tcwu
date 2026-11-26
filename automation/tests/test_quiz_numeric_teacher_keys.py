import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from quiz_numeric_teacher_keys import parse_teacher_numeric_key as parse, compare_teacher_numeric_key as compare, match_teacher_table_keys
from quiz_numeric_teacher_keys import parse_teacher_number_units_key as parse_units


class NumericTeacherKeysTests(unittest.TestCase):
    def test_original_symbol_labels_with_colon_keep_all_values(self):
        key = parse("答案：ㄅ：1；100；ㄆ：1；950", question_text="ㄅ：（ ）公斤（ ）公克；ㄆ：（ ）公斤（ ）公克")
        self.assertEqual(key["values"], ["1", "100", "1", "950"])
        self.assertTrue(compare(key, [1, 100, 1, 950]))
        with self.assertRaisesRegex(ValueError, "not_visible"):
            parse("答案：ㄅ：1；100", question_text="只有一張未標號的圖")

    def test_original_labels_before_nfkc(self):
        key = parse("答案：①2/8；②3/8", question_text="①（ ）②（ ）")
        self.assertEqual(key["values"], ["2/8", "3/8"])
        self.assertTrue(compare(key, ["1/4", "3/8"]))

    def test_compound_units_keep_position_order(self):
        key = parse("答案：ㄅ 600；ㄆ 900；ㄇ 1；700", question_text="ㄅ（ ）ㄆ（ ）ㄇ（ ）公斤（ ）公克")
        self.assertEqual(key["values"], ["600", "900", "1", "700"])
        with self.assertRaisesRegex(ValueError, "values_mismatch"):
            compare(key, [600, 900, 700, 1])

    def test_visible_fraction_and_fullwidth_values(self):
        self.assertEqual(parse(r"答案：(１)$\frac{1}{3}$；(２) ８")["values"], ["1/3", "8"])

    def test_only_explicit_final_line_not_working(self):
        key = parse("答案：54÷6＝(9)…(0)\n答：9 個，剩下 0 個人")
        self.assertEqual(key["values"], ["9", "0"])
        self.assertEqual(key["method"], "explicit_final_answer_line")
        with self.assertRaises(ValueError):
            parse("答案：54÷6＝(9)…(0)")

    def test_working_requirement_can_block_final_line(self):
        with self.assertRaisesRegex(ValueError, "not_allowed"):
            parse("答案：\n答：9個", allow_final_line=False)

    def test_nonconsecutive_or_missing_original_symbol_labels_rejected(self):
        for text, question in [("答案：①2；③3", "①③"), ("答案：ㄅ2；ㄇ3", "ㄅㄇ"), ("答案：①2；②3", "僅有圖片")]:
            with self.subTest(text=text), self.assertRaises(ValueError):
                parse(text, question_text=question)

    def test_mixed_number_not_concatenated(self):
        with self.assertRaisesRegex(ValueError, "mixed_number"):
            parse(r"答案：2$\frac{3}{5}$")

    def test_no_implicit_multiple_or_incomplete_keys(self):
        for text in ["答案：", "答案：(1)5；(3)9", "答案：\n答：1\n答：2", "答案：1/0"]:
            with self.subTest(text=text), self.assertRaises(ValueError):
                parse(text)

    def test_unequal_count_and_boolean_references_rejected(self):
        key = parse("答案：1；2")
        with self.assertRaisesRegex(ValueError, "position_count"):
            compare(key, [1])
        with self.assertRaisesRegex(ValueError, "not_scalar"):
            compare(key, [True, 2])

    def test_equation_after_final_answer_is_not_silently_stripped(self):
        with self.assertRaisesRegex(ValueError, "equation"):
            parse("答案：\n答：5+3=8")

    def test_missing_middle_key_is_not_dropped(self):
        with self.assertRaises(ValueError):
            parse("答案：1；；2")
        self.assertEqual(parse("答案：1；2；")["values"], ["1", "2"])

    def test_thousands_and_following_analysis_require_mapping(self):
        for text in ["答案：\n答：1,500公克", "答案：\n答：5\n解析：6"]:
            with self.subTest(text=text), self.assertRaises(ValueError):
                parse(text)


def table(rows):
    return {"type": "table", "rows": [[[{"type": "text", "text": str(value)}] if value is not None else [] for value in row] for row in rows]}


class NumericTeacherTableTests(unittest.TestCase):
    def test_only_empty_answer_cells_and_original_coordinates(self):
        q = {"layout": [table([[None, "甲", "乙"], ["餘數", None, None]])]}
        a = {"layout": [table([[None, "甲", "乙"], ["餘數", "0", "2"]])]}
        result = match_teacher_table_keys(q, a)
        self.assertEqual([(c["row"], c["column"], c["value"]) for c in result], [(1, 1, "0"), (1, 2, "2")])

    def test_fragmented_labels_match_only_when_the_visible_text_is_the_same(self):
        original = table([["正方形個數（個）", None]])
        original["rows"][0][0] = [
            {"type": "text", "text": "正方形個數"},
            {"type": "text", "text": "\n"},
            {"type": "text", "text": "（個）"},
        ]
        q = {"layout": [original]}
        a = {"layout": [table([["正方形個數（個）", 5]])]}
        self.assertEqual([c["value"] for c in match_teacher_table_keys(q, a)], ["5"])
        a = {"layout": [table([["正方形個數（枝）", 5]])]}
        self.assertEqual(match_teacher_table_keys(q, a), [])

    def test_changed_printed_value_cannot_be_paired(self):
        q = {"layout": [table([["被除數", 7], ["餘數", None]])]}
        a = {"layout": [table([["被除數", 8], ["餘數", 1]])]}
        self.assertEqual(match_teacher_table_keys(q, a), [])

    def test_identical_teacher_tables_are_ambiguous(self):
        q = {"layout": [table([["數量", None]])]}
        a = {"layout": [table([["數量", 1]]), table([["數量", 2]])]}
        with self.assertRaisesRegex(ValueError, "ambiguous"):
            match_teacher_table_keys(q, a)

    def test_one_teacher_table_cannot_serve_two_questions(self):
        q = {"layout": [table([["數量", None]]), table([["數量", None]])]}
        a = {"layout": [table([["數量", 2]])]}
        self.assertEqual(len(match_teacher_table_keys(q, a)), 1)

    def test_merged_or_reshaped_table_requires_mapping(self):
        source = table([["數量", None]])
        source["source_spans"] = [{"row": 0, "column": 0, "colspan": 2}]
        with self.assertRaisesRegex(ValueError, "merged"):
            match_teacher_table_keys({"layout": [source]}, {"layout": [table([["數量", 2]])]})
        self.assertEqual(match_teacher_table_keys({"layout": [table([[None]])]}, {"layout": [table([[1, 2]])]}), [])

    def test_verified_native_fraction_and_empty_corner(self):
        q = {"layout": [table([[None, "分數"], ["甲", None]])]}
        a = {"layout": [table([[None, "分數"], ["甲", r"$\frac{2}{8}$"]])]}
        self.assertEqual([c["value"] for c in match_teacher_table_keys(q, a)], ["2/8"])

    def test_teacher_image_is_not_a_numeric_key(self):
        answer = table([[None]])
        answer["rows"][0][0] = [{"type": "image", "media_index": 0}]
        self.assertEqual(match_teacher_table_keys({"layout": [table([[None]])]}, {"layout": [answer], "media": [{"url": "https://example.invalid/picture"}]}), [])


class NumberUnitsTests(unittest.TestCase):
    def test_numbered_final_answers_remain_bound_to_original_subquestions(self):
        key = parse_units("答案：(１) 64 元；\n(２) 40＋80＝120\n答：120 元", question_text="(1) 第一小題\n(2) 第二小題")
        self.assertTrue(compare(key, [64, 120]))
        self.assertEqual(key["units"], ["元", "元"])

    def test_compound_units_preserve_order_and_units(self):
        key = parse_units("答案：7 公斤 275 公克；1 時 30 分", question_text="")
        self.assertEqual(key["units"], ["公斤", "公克", "時", "分"])
        self.assertTrue(compare(key, [7, 275, 1, 30]))

    def test_fraction_aliases_require_exact_equality_in_the_same_unit(self):
        key = parse_units(r"答案：$\frac{4}{4}$（或 1）", question_text="")
        self.assertEqual(key["alternatives"], [["1"]])
        self.assertTrue(compare(key, [1]))
        for text in ["1000 公克或 1 公斤", "4/4（或 2）"]:
            with self.subTest(text=text), self.assertRaisesRegex(ValueError, "alternative_requires_mapping"):
                parse_units(text, question_text="")

    def test_reject_ambiguous_positions_and_non_results(self):
        for text in ["① 10 公克；② 30 公克", "(1) 1；(3) 3", "2 公斤 5 分", "3+5", "1；；2", "答：2"]:
            with self.subTest(text=text), self.assertRaises(ValueError):
                parse_units(text, question_text="(1) (3)")


if __name__ == "__main__":
    unittest.main()
