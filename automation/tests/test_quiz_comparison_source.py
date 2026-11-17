import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lib'))
from quiz_comparison_source import comparison_source


def content(*lines):
    return {'text': '\n'.join(lines), 'media': [], 'layout': [
        {'type': 'paragraph', 'runs': [{'type': 'text', 'text': line}]} for line in lines]}


class ComparisonSourceTest(unittest.TestCase):
    def test_grams_calculation_and_original_retention(self):
        source = content('(１) 2 公斤 5 公克□2500 公克', '(２) 3000 公克□3 公斤')
        original = copy.deepcopy(source)
        result = comparison_source(source, '答案：(１)＜；(２)＝', ['<', '='])
        self.assertEqual(source, original)
        self.assertEqual([r['value'] for r in result['binding']], ['<', '='])
        self.assertEqual(result['answer']['fields'], {'f1': ['lt'], 'f2': ['eq']})
        self.assertIn('（第2格）', result['prompt']['text'])

    def test_fraction_circled_positions(self):
        source = content('①$\\frac{2}{4}$ □ $\\frac{1}{4}$', '②$\\frac{1}{3}$ □ $\\frac{2}{6}$')
        result = comparison_source(source, '答案：①＞；②＝', ['>', '='])
        self.assertEqual([s['dimension'] for s in result['binding']], ['scalar', 'scalar'])
        self.assertIn('$\\frac{2}{4}$', result['prompt']['text'])

    def test_refuses_wrong_key_instead_of_trusting_two_agreeing_sources(self):
        with self.assertRaisesRegex(ValueError, 'calculation_mismatch'):
            comparison_source(content('(1) 8□2', '(2) 1□3'), '答案：(1)＜；(2)＜', ['<', '<'])

    def test_generic_instruction_and_recorded_expression(self):
        source = content('小組先比大小，再用＜、＝或＞記錄。',
                         '(1)拿到兩個分數，記成：$\\frac{1}{3}$（ ）$\\frac{2}{3}$',
                         '(2)拿到兩個分數，記成：$\\frac{4}{5}$（ ）$\\frac{1}{5}$')
        result = comparison_source(source, '答案：(1)＜；(2)＞', ['<', '>'])
        self.assertIn('拿到兩個分數，記成：', result['prompt']['text'])

    def test_refuses_missing_or_reordered_positions(self):
        for text, key in [('(2) 1□3', '答案：(1)＜'), ('(1) 1□3', '答案：(2)＜')]:
            with self.subTest(text=text, key=key), self.assertRaises(ValueError):
                comparison_source(content(text, '(3) 2□3'), key, ['<', '<'])

    def test_refuses_images_unknown_units_instructions_and_dimension_conflicts(self):
        for source in [content('(1) 3公分□2公分', '(2) 1□2'),
                       content('(1) 3公斤□2', '(2) 1□2'),
                       content('任意新說明', '(1) 1□2', '(2) 2□3'),
                       {**content('(1) 1□2', '(2) 2□3'), 'media': [{}]}]:
            with self.subTest(source=source), self.assertRaises(ValueError):
                comparison_source(source, '答案：(1)＜；(2)＜', ['<', '<'])

    def test_refuses_text_layout_mismatch(self):
        source = content('(1) 1□2', '(2) 2□3')
        source['text'] += 'extra'
        with self.assertRaisesRegex(ValueError, 'layout_mismatch'):
            comparison_source(source, '答案：(1)＜；(2)＜', ['<', '<'])
        styled = content('(1) 1□2', '(2) 2□3')
        styled['layout'][0]['runs'][0]['style'] = 'meaningful-emphasis'
        with self.assertRaisesRegex(ValueError, 'nontext_run'):
            comparison_source(styled, '答案：(1)＜；(2)＜', ['<', '<'])


if __name__ == '__main__':
    unittest.main()
