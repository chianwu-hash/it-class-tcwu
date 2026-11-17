import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from quiz_choice_source_instructions import neutralize_single_choice_instruction as neutralize


class ChoiceSourceInstructionTests(unittest.TestCase):
    def test_area_question_keeps_area_meaning(self):
        text = "誰塗色的面積最小？請打ˇ。"
        self.assertEqual(neutralize(text, source_type="single_choice"), "誰塗色的面積最小？請選擇答案。")

    def test_tape_question_does_not_gain_weight_or_equation(self):
        text = "刻度8公分上方是哪一種紙膠帶？請打ˇ。"
        result = neutralize(text, source_type="single_choice")
        self.assertEqual(result, "刻度8公分上方是哪一種紙膠帶？請選擇答案。")
        self.assertNotIn("比較重", result)
        self.assertNotIn("算式", result)

    def test_existing_weight_question_keeps_original_words(self):
        self.assertEqual(neutralize("哪一樣比較重？在（ ）裡打ˇ。", source_type="single_choice"), "哪一樣比較重？請選擇答案。")

    def test_empty_parentheses_variants(self):
        for instruction in ["在()內打✓。", "請在（　）裡打√。", "請打ˇ"]:
            self.assertEqual(neutralize(instruction, source_type="single_choice"), "請選擇答案。")

    def test_unchanged_content_and_idempotence(self):
        text = "圖案是V形。請選擇答案。"
        self.assertEqual(neutralize(text, source_type="single_choice"), text)
        self.assertEqual(neutralize(neutralize("請打ˇ。", source_type="single_choice"), source_type="single_choice"), "請選擇答案。")

    def test_no_application_to_checkbox_groups_or_other_types(self):
        for kind in ["multi_select", "true_false", "drawing", "unknown"]:
            with self.assertRaisesRegex(ValueError, "confirmed_single"):
                neutralize("正確打ˇ，錯誤打×。", source_type=kind)


if __name__ == "__main__":
    unittest.main()
