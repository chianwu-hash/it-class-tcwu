"""Replace a known importer hint only after the required work is saved natively."""
from copy import deepcopy

RESULT_ONLY_HINT = '請依答案欄標示填答，只填數值。'


def replace_result_only_work_hint(question, requirements):
    kinds = {r['kind'] for r in requirements}
    if not kinds or not kinds <= {'equation', 'vertical_work'}:
        raise ValueError('explicit_equation_or_vertical_requirement_required')
    if question.get('type') != 'open' or not any(f.get('input') == 'sketch' for f in question.get('fields', [])):
        raise ValueError('native_saved_handwriting_required')
    if question.get('answer', {}).get('format') != 'self-review-v1':
        raise ValueError('manual_reference_contract_required')
    prompt = question['prompt']
    if prompt['text'].count(RESULT_ONLY_HINT) != 1:
        raise ValueError('known_result_only_hint_required')
    matches = [run for block in prompt.get('layout', []) if block.get('type') == 'paragraph'
               for run in block['runs'] if run.get('type') == 'text' and run.get('text') == RESULT_ONLY_HINT]
    if len(matches) != 1:
        raise ValueError('exact_importer_hint_run_required')
    if not prompt['text'].rstrip().endswith(RESULT_ONLY_HINT) or prompt['layout'][-1] != {
            'type': 'paragraph', 'runs': [{'type': 'text', 'text': RESULT_ONLY_HINT}]}:
        raise ValueError('trailing_importer_hint_required')
    work = '、'.join(v for kind, v in [('equation', '算式'), ('vertical_work', '直式')] if kind in kinds)
    hint = f'請填寫答案，並在手寫區保留原題要求的{work}與計算過程，再一起送出。'
    result = deepcopy(question)
    result['prompt']['text'] = prompt['text'].replace(RESULT_ONLY_HINT, hint)
    for block in result['prompt']['layout']:
        if block.get('type') == 'paragraph':
            for run in block['runs']:
                if run.get('type') == 'text' and run.get('text') == RESULT_ONLY_HINT:
                    run['text'] = hint
    return result, {'old': RESULT_ONLY_HINT, 'new': hint, 'source_requirement_kinds': sorted(kinds),
                    'fields_and_reference_unchanged': result['fields'] == question['fields'] and result['answer'] == question['answer']}
