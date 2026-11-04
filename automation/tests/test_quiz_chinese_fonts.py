import sys
import unittest
from pathlib import Path
from xml.etree import ElementTree as E
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lib'))
from quiz_chinese_fonts import convert_zhuyin_tree, W


class ChineseFontTests(unittest.TestCase):
    def tree(self, font, text):
        root = E.Element(W + 'p');run = E.SubElement(root, W + 'r')
        prop = E.SubElement(run, W + 'rPr')
        E.SubElement(prop, W + 'rFonts', {W + 'eastAsia': font})
        E.SubElement(run, W + 't').text = text
        return root

    def test_phonetic_not_answer_leak_and_punctuation_preserved(self):
        root = self.tree('書法居中（注音一）', '妒／長，為。')
        changes = convert_zhuyin_tree(root)
        self.assertEqual(next(root.iter(W + 't')).text, 'ㄉㄨˋ／ㄓㄤˇ，ㄨㄟˋ。')
        self.assertEqual(len(changes), 1)
        self.assertEqual(convert_zhuyin_tree(root), [])

    def test_reading_variant_and_neutral_tone(self):
        root = self.tree('書法居中（注音三）', '得')
        convert_zhuyin_tree(root)
        self.assertEqual(next(root.iter(W + 't')).text, 'ㄉㄟˇ')
        root = self.tree('書法居中（注音一）', '的')
        convert_zhuyin_tree(root)
        self.assertEqual(next(root.iter(W + 't')).text, '˙ㄉㄜ')

    def test_annotated_and_regular_hanzi_not_converted(self):
        for font in ['書法中楷（注音一）', '書法中楷（破音二）', '書法家中楷體']:
            root = self.tree(font, '妒');self.assertEqual(convert_zhuyin_tree(root), [])
            self.assertEqual(next(root.iter(W + 't')).text, '妒')

    def test_original_wrong_readings_and_second_font_are_preserved(self):
        # 原卷考「導」的讀音；前三個字碼使用注音一，捯使用注音二。
        root = self.tree('書法居中（注音一）', '到、導、刀')
        convert_zhuyin_tree(root)
        self.assertEqual(next(root.iter(W + 't')).text, 'ㄉㄠˋ、ㄉㄠˇ、ㄉㄠ')
        root = self.tree('書法居中（注音二）', '捯了晃')
        convert_zhuyin_tree(root)
        self.assertEqual(next(root.iter(W + 't')).text, 'ㄉㄠˊㄌㄧㄠˇㄏㄨㄤˋ')

    def test_reviewed_font_values_do_not_follow_dictionary_defaults(self):
        root = self.tree('書法居中（注音一）', '趟奮')
        convert_zhuyin_tree(root)
        self.assertEqual(next(root.iter(W + 't')).text, 'ㄊㄤㄈㄣˋ')

    def test_similar_glyphs_and_tones_remain_distinct(self):
        root = self.tree('書法居中（注音一）', '卓桌、嗙綁、貴軌、荒謊、闆扁')
        convert_zhuyin_tree(root)
        self.assertEqual(next(root.iter(W + 't')).text,
                         'ㄓㄨㄛˊㄓㄨㄛ、ㄆㄤˇㄅㄤˇ、ㄍㄨㄟˋㄍㄨㄟˇ、ㄏㄨㄤㄏㄨㄤˇ、ㄅㄢˇㄅㄧㄢˇ')

    def test_unknown_glyph_or_variant_stops_conversion(self):
        for font, text in [('書法居中（注音一）', '龘'), ('書法居中（注音二）', '長')]:
            with self.assertRaises(ValueError):
                convert_zhuyin_tree(self.tree(font, text))


if __name__ == '__main__':
    unittest.main()
