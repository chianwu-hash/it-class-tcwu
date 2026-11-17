"""Replace a known importer hint only after the required work is saved natively."""
from copy import deepcopy
from quiz_source_work_requirements import source_work_input

RESULT_ONLY_HINT = '請依答案欄標示填答，只填數值。'


def attach_source_work(question, requirements):
    """Create a new candidate only; never mutate a released question or attempt."""
    mode = source_work_input(requirements)
    if mode is None or 'work' in question:
        raise ValueError('explicit_unadapted_work_required')
    result = deepcopy(question)
    if result.get('type') == 'short' and result.get('answer', {}).get('normalizer') == 'math-v1':
        accepted = result['answer']['accepted']
        result['type'] = 'fields'
        result['fields'] = [{'id': 'result', 'label': '答案', 'input': 'math'}]
        result['answer'] = {'format': 'fields-v1', 'fields': {'result': accepted}}
    elif result.get('type') != 'fields' or not result.get('fields') or any(f.get('input') != 'math' for f in result['fields']) or result.get('answer', {}).get('format') != 'fields-v1':
        raise ValueError('verified_fixed_math_fields_required')
    result['work'] = {'input': mode, 'label': '算式' if mode == 'expression' else '直式作答'}
    if RESULT_ONLY_HINT in result['prompt']['text']:
        result, _ = replace_result_only_work_hint(result, requirements)
    return result


def replace_result_only_work_hint(question, requirements):
    kinds = {r['kind'] for r in requirements}
    if not kinds or not kinds <= {'equation', 'vertical_work'}:
        raise ValueError('explicit_equation_or_vertical_requirement_required')
    mode = source_work_input(requirements)
    if question.get('type') != 'fields' or question.get('work', {}).get('input') != mode:
        raise ValueError('source_matched_native_saved_work_required')
    if question.get('answer', {}).get('format') != 'fields-v1':
        raise ValueError('fixed_answer_contract_required')
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
    hint = ('請輸入算式並填寫答案，再一起送出。' if mode == 'expression'
            else '請在直式作答區寫出計算過程，填寫答案後一起送出。')
    result = deepcopy(question)
    result['prompt']['text'] = prompt['text'].replace(RESULT_ONLY_HINT, hint)
    for block in result['prompt']['layout']:
        if block.get('type') == 'paragraph':
            for run in block['runs']:
                if run.get('type') == 'text' and run.get('text') == RESULT_ONLY_HINT:
                    run['text'] = hint
    return result, {'old': RESULT_ONLY_HINT, 'new': hint, 'source_requirement_kinds': sorted(kinds), 'work_input': mode,
                    'fields_and_reference_unchanged': result['fields'] == question['fields'] and result['answer'] == question['answer']}
