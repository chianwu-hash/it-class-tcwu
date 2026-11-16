import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from quiz_graphic_teacher_keys import match_teacher_graphic_choice as match


class GraphicTeacherKeysTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for name, color, size in [("teacher", "red", (4, 3)), ("same", "red", (4, 3)), ("other", "blue", (4, 3)), ("resized", "red", (3, 4))]:
            Image.new("RGBA", size, color).save(self.root / (name + ".png"))
        self.teacher = self.content("teacher", "答案：圈起來")

    def content(self, name, text=""):
        return {"text": text, "media": [{"url": name + ".png"}]}

    def resolve(self, media):
        return self.root / media["url"]

    def test_unique_full_pixel_match_and_reordered_options(self):
        options = [self.content("other"), self.content("same", "□")]
        self.assertEqual(match(self.teacher, options, self.resolve)["option_index"], 1)
        self.assertEqual(match(self.teacher, options[::-1], self.resolve)["option_index"], 0)

    def test_duplicate_matching_options_rejected(self):
        with self.assertRaisesRegex(ValueError, "exact_unique"):
            match(self.teacher, [self.content("same"), self.content("teacher")], self.resolve)

    def test_no_resize_or_near_match(self):
        with self.assertRaisesRegex(ValueError, "exact_unique"):
            match(self.teacher, [self.content("resized"), self.content("other")], self.resolve)

    def test_teacher_text_or_multiple_images_rejected(self):
        for teacher in [self.content("teacher", "答案：請比較兩圖"), {"text": "答案：", "media": [{"url": "teacher.png"}] * 2}]:
            with self.assertRaisesRegex(ValueError, "complete_teacher"):
                match(teacher, [self.content("same"), self.content("other")], self.resolve)

    def test_image_does_not_discard_meaningful_option_text(self):
        with self.assertRaisesRegex(ValueError, "exact_unique"):
            match(self.teacher, [self.content("same", "重量是3公斤"), self.content("other")], self.resolve)

    def test_multiple_images_in_option_not_partial_match(self):
        compound = {"text": "", "media": [{"url": "same.png"}, {"url": "other.png"}]}
        with self.assertRaisesRegex(ValueError, "exact_unique"):
            match(self.teacher, [compound, self.content("other")], self.resolve)

    def test_alpha_is_part_of_identity(self):
        Image.new("RGBA", (4, 3), (255, 0, 0, 0)).save(self.root / "transparent.png")
        with self.assertRaisesRegex(ValueError, "exact_unique"):
            match(self.teacher, [self.content("transparent"), self.content("other")], self.resolve)

    def test_one_media_entry_used_twice_is_not_one_graphic(self):
        duplicate = self.content("same")
        duplicate["layout"] = [{"type": "paragraph", "runs": [{"type": "image", "media_index": 0}] * 2}]
        with self.assertRaisesRegex(ValueError, "exact_unique"):
            match(self.teacher, [duplicate, self.content("other")], self.resolve)
        with self.assertRaisesRegex(ValueError, "complete_teacher"):
            match({**duplicate, "text": "答案："}, [self.content("same"), self.content("other")], self.resolve)


if __name__ == "__main__":
    unittest.main()
