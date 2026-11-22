import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from quiz_choice_source_binding import bind_cropped_choice_key, bind_single_choice, labeled_weight_choice, marked_single_choice


def content(text, digest=None):
    return {
        "text": text,
        "media": [{"kind": "image", "url": f"https://media.invalid/{digest}.png"}] if digest else [],
    }


def single(parts, chosen="o1"):
    return {
        "type": "single",
        "answer": {"option_id": chosen},
        "options": [{"id": f"o{i}", "content": part} for i, part in enumerate(parts, 1)],
    }


class ChoiceSourceBindingTests(unittest.TestCase):
    def test_single_mark_uses_the_fixed_source_position(self):
        raw = {
            "media": [],
            "layout": [
                {"type": "paragraph", "runs": [{"type": "text", "text": "哪一個比較輕？請打ˇ。"}]},
                {"type": "paragraph", "runs": [{"type": "text", "text": "□"}, {"type": "marker", "number": 1},
                                               {"type": "text", "text": "2 公斤"}]},
                {"type": "paragraph", "runs": [{"type": "text", "text": "□② 1500 公克"}]},
            ],
        }
        result = marked_single_choice(raw, "答案：②ˇ", "v", "②方框")
        self.assertEqual(result["type"], "single")
        self.assertEqual(result["source_labels"], ["①", "②"])
        self.assertEqual([o["content"]["text"] for o in result["options"]], ["2 公斤", "1500 公克"])
        self.assertEqual(result["answer"], {"option_id": "o2"})
        for mark, position in [("v", "①方框"), ("X", "②方框"), ("v", "方框")]:
            with self.assertRaisesRegex(ValueError, "teacher_and_fixed_mark_position_mismatch"):
                marked_single_choice(raw, "答案：②ˇ", mark, position)
        with self.assertRaisesRegex(ValueError, "teacher_and_fixed_mark_position_mismatch"):
            marked_single_choice(raw, "答案：①ˇ；②ˇ", "v", "②方框")
        raw["layout"][0]["runs"][0]["text"] = "較重的打ˇ，較輕的打×。"
        with self.assertRaisesRegex(ValueError, "marked_choice_single_comparison_required"):
            marked_single_choice(raw, "答案：②ˇ", "v", "②方框")

    def test_inline_zhuyin_labels_keep_exact_image_order(self):
        media = [content("", "1" * 64)["media"][0], content("", "2" * 64)["media"][0]]
        raw = {
            "media": media,
            "layout": [
                {"type": "paragraph", "runs": [{"type": "text", "text": "比較重的打ˇ。"}]},
                {"type": "paragraph", "runs": [{"type": "text", "text": "ㄅ□"},
                                               {"type": "image", "media_index": 1},
                                               {"type": "text", "text": " ㄆ□ "},
                                               {"type": "image", "media_index": 0}]},
            ],
        }
        result = marked_single_choice(raw, "答案：ㄅˇ", "V", "ㄅ括號")
        self.assertEqual([o["content"]["media"][0] for o in result["options"]], list(reversed(media)))
        self.assertEqual(result["answer"]["option_id"], "o1")
        raw["layout"][1]["runs"][-1]["media_index"] = 1
        with self.assertRaisesRegex(ValueError, "marked_choice_must_preserve_each_source_image"):
            marked_single_choice(raw, "答案：ㄅˇ", "V", "ㄅ括號")

    def test_cropped_choices_require_agreement_and_original_order(self):
        self.assertEqual(bind_cropped_choice_key(["1", "2", "3"], "答案：（２）圈起來", "(2)", ""), "o2")
        self.assertEqual(bind_cropped_choice_key(["A", "B", "C"], "答案：A", "A", ""), "o1")
        self.assertEqual(bind_cropped_choice_key(["1", "2"], "答案：(１)ˇ", "v", "(1)方框"), "o1")
        self.assertEqual(bind_cropped_choice_key(["left", "right"], "答案：圖 4 左（ ）打ˇ", "圖4左( )打v", ""), "o1")
        with self.assertRaisesRegex(ValueError, "complete_original_crop_labels_required"):
            bind_cropped_choice_key(["2", "1"], "答案：(2)", "(2)", "")
        with self.assertRaisesRegex(ValueError, "teacher_and_fixed_cropped_choice_mismatch"):
            bind_cropped_choice_key(["1", "2"], "答案：(1)ˇ", "v", "(2)方框")
        with self.assertRaisesRegex(ValueError, "teacher_and_fixed_cropped_choice_mismatch"):
            bind_cropped_choice_key(["left", "right"], "答案：圖 4 左（ ）打ˇ", "圖5左( )打v", "")
        with self.assertRaisesRegex(ValueError, "teacher_choice_outside_cropped_labels"):
            bind_cropped_choice_key(["1", "2"], "答案：(3)", "(3)", "")

    def test_paper_marks_require_authorized_source_and_do_not_remove_inline_blanks(self):
        parts = [content("□", "a" * 64), content("另一項\n□")]
        question = single([content("", "a" * 64), content("另一項")])
        self.assertEqual(bind_single_choice(question, parts, 0, paper_mark=True), 2)
        with self.assertRaisesRegex(ValueError, "source_option_content_mismatch"):
            bind_single_choice(question, parts, 0)
        with self.assertRaisesRegex(ValueError, "source_option_content_mismatch"):
            bind_single_choice(question, [parts[0], content("另一□項")], 0, paper_mark=True)

    def test_remapped_images_still_preserve_order_and_key(self):
        source = [content("", "a" * 64), content("", "b" * 64)]
        mapped = [content("", "c" * 64), content("", "b" * 64)]
        aliases = {"c" * 64: "a" * 64}
        self.assertEqual(bind_single_choice(single(mapped), source, 0, verified_image_aliases=aliases), 0)
        with self.assertRaisesRegex(ValueError, "source_option_media_order_mismatch"):
            bind_single_choice(single(list(reversed(mapped))), source, 0, verified_image_aliases=aliases)
        with self.assertRaisesRegex(ValueError, "source_option_key_mismatch"):
            bind_single_choice(single(mapped, "o2"), source, 0, verified_image_aliases=aliases)

    def test_weight_extremum_preserves_display_text_and_source_order(self):
        prompt = content("把最輕的圈起來。\nㄅ 2 公斤\nㄆ 1500 g\nㄇ 1 公斤 300 公克")
        question = labeled_weight_choice(prompt, content("答案：ㄇ"), "ㄇ")
        self.assertEqual(question["answer"]["option_id"], "o3")
        self.assertEqual([row["content"]["text"] for row in question["options"]],
                         ["2 公斤", "1500 g", "1 公斤 300 公克"])
        with self.assertRaisesRegex(ValueError, "teacher_review_independent_weight_mismatch"):
            labeled_weight_choice(prompt, content("答案：ㄅ"), "ㄅ")
        with self.assertRaisesRegex(ValueError, "unique_original_weight_extreme_required"):
            labeled_weight_choice(content("把最重的圈起來。\nㄅ 2 公斤\nㄆ 2000 公克"), content("答案：ㄅ"), "ㄅ")


if __name__ == "__main__":
    unittest.main()
