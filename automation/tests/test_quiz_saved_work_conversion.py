import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lib'))
from quiz_work_prompt import attach_source_work


class SavedWorkConversionTests(unittest.TestCase):
    def test_fixed_fields_ids_values_and_original_content_are_preserved(self):
        q = {'id': 'old', 'type': 'fields', 'fields': [{'id': 'original', 'label': '商', 'input': 'math'}],
             'prompt': {'text': '原題文字'}, 'explanation': {'text': '原解析'},
             'answer': {'format': 'fields-v1', 'fields': {'original': ['3', '３']}}}
        before = copy.deepcopy(q)
        for kind, expected in [('equation', 'expression'), ('vertical_work', 'sketch')]:
            result = attach_source_work(q, [{'kind': kind}])
            self.assertEqual(result['work']['input'], expected)
            self.assertEqual({k: v for k, v in result.items() if k != 'work'}, before)
            self.assertEqual(q, before)

    def test_existing_short_math_keeps_every_accepted_value_in_new_candidate(self):
        q = {'type': 'short', 'prompt': {'text': '原算式題'},
             'answer': {'normalizer': 'math-v1', 'accepted': ['3', '6/2']}}
        result = attach_source_work(q, [{'kind': 'equation'}])
        self.assertEqual(result['answer']['fields']['result'], q['answer']['accepted'])
        self.assertEqual(q['type'], 'short')
        self.assertNotIn('work', q)

    def test_unverified_text_choice_or_drawing_contract_is_never_blindly_converted(self):
        for q, req in [({'type': 'short', 'answer': {'accepted': ['甲']}}, [{'kind': 'equation'}]),
                       ({'type': 'fields', 'fields': [{'input': 'single'}]}, [{'kind': 'vertical_work'}]),
                       ({}, [{'kind': 'drawing'}]), ({}, [])]:
            with self.subTest(q=q), self.assertRaises(ValueError): attach_source_work(q, req)


if __name__ == '__main__': unittest.main()
