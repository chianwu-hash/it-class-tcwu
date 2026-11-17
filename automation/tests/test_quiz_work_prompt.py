import copy
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'lib'))
from quiz_work_prompt import RESULT_ONLY_HINT, replace_result_only_work_hint


def question():
    return {'id': 'synthetic', 'type': 'open', 'prompt': {'text': '合成題\n' + RESULT_ONLY_HINT,
        'media': [], 'layout': [{'type': 'paragraph', 'runs': [{'type': 'text', 'text': '合成題'}]},
                               {'type': 'paragraph', 'runs': [{'type': 'text', 'text': RESULT_ONLY_HINT}]}]},
        'fields': [{'id': 'work', 'input': 'sketch'}], 'answer': {'format': 'self-review-v1'}}


class WorkPromptTest(unittest.TestCase):
    def test_preserves_original_fields_reference_and_specific_requirement(self):
        for kind, word in [('equation', '算式'), ('vertical_work', '直式')]:
            q = question();before = copy.deepcopy(q)
            result, receipt = replace_result_only_work_hint(q, [{'kind': kind}])
            self.assertEqual(q, before)
            self.assertEqual(result['fields'], q['fields'])
            self.assertEqual(result['answer'], q['answer'])
            self.assertIn(word, result['prompt']['text'])
            self.assertNotIn('只填數值', result['prompt']['text'])
            self.assertTrue(receipt['fields_and_reference_unchanged'])

    def test_refuses_missing_native_storage_or_unrelated_work(self):
        for q, requirements in [(dict(question(), type='fields'), [{'kind': 'equation'}]),
                                (dict(question(), fields=[]), [{'kind': 'vertical_work'}]),
                                (question(), [{'kind': 'drawing'}]), (question(), [])]:
            with self.subTest(q=q, requirements=requirements), self.assertRaises(ValueError):
                replace_result_only_work_hint(q, requirements)

    def test_refuses_unknown_or_duplicate_or_split_hint(self):
        for mode in ['unknown', 'duplicate', 'split', 'middle']:
            q = question()
            if mode == 'unknown':q['prompt']['text'] = '只要填數值。'
            elif mode == 'duplicate':q['prompt']['text'] += RESULT_ONLY_HINT
            elif mode == 'split':q['prompt']['layout'][-1]['runs'][0]['text'] = RESULT_ONLY_HINT[:4]
            else:
                q['prompt']['text'] += '\n其他題文'
                q['prompt']['layout'].append({'type': 'paragraph', 'runs': [{'type': 'text', 'text': '其他題文'}]})
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                replace_result_only_work_hint(q, [{'kind': 'equation'}])


if __name__ == '__main__':unittest.main()
