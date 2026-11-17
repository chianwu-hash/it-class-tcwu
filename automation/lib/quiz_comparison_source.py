"""Strict, source-bound comparison slots; no inference from publisher type names."""
import re
import unicodedata
from fractions import Fraction

SIGNS = {'<': 'lt', '=': 'eq', '>': 'gt'}
LABEL = re.compile(r'^\s*(?:\(([1-9][0-9]*)\)|([①-⑳]))\s*(.*)$')
GAP = re.compile(r'□|[（(][\s\u3000]*[）)]')
INTRO = re.compile(r'^(?:在□裡填入＞、＜或＝：|[^□\n]*(?:先比大小|比較大小)[^□\n]*用[＜＝＞、或]+記錄。?)$')


def quantity(text):
    text = re.sub(r'\s+', '', unicodedata.normalize('NFKC', text))
    frac = re.fullmatch(r'\$\\frac\{([0-9]+)\}\{([0-9]+)\}\$', text)
    if frac:
        if int(frac[2]) == 0:
            raise ValueError('zero_denominator')
        return 'scalar', Fraction(int(frac[1]), int(frac[2]))
    if re.fullmatch(r'[0-9]+', text):
        return 'scalar', Fraction(int(text))
    weight = re.fullmatch(r'(?:(\d+)公斤)?(?:(\d+)公克)?', text)
    if weight and any(v is not None for v in weight.groups()):
        return 'grams', Fraction(int(weight[1] or 0) * 1000 + int(weight[2] or 0))
    raise ValueError('unsupported_comparison_quantity')


def comparison_source(content, teacher_text, references):
    if content.get('media'):
        raise ValueError('comparison_media_requires_mapping')
    paragraphs = []
    for block in content.get('layout', []):
        if block.get('type') != 'paragraph' or set(block) != {'type', 'runs'}:
            raise ValueError('comparison_layout_requires_mapping')
        if any(run.get('type') != 'text' or set(run) != {'type', 'text'} for run in block['runs']):
            raise ValueError('comparison_nontext_run')
        paragraphs.append(''.join(run['text'] for run in block['runs']))
    if '\n'.join(paragraphs).strip() != content['text'].strip():
        raise ValueError('comparison_text_layout_mismatch')
    displayed, slots = [], []
    for paragraph in paragraphs:
        # Keep circled source labels before NFKC, which otherwise erases them.
        source = re.sub('[１-９]', lambda m: str(ord(m[0]) - ord('０')), paragraph)
        match = LABEL.fullmatch(source)
        if not match:
            if slots or not INTRO.fullmatch(paragraph):
                raise ValueError('unsupported_comparison_instruction')
            displayed.append('比較大小，選出每格適當的符號。')
            continue
        index = int(match[1]) if match[1] else ord(match[2]) - ord('①') + 1
        if index != len(slots) + 1:
            raise ValueError('nonsequential_comparison_slots')
        body = match[3]
        if len(GAP.findall(body)) != 1:
            raise ValueError('comparison_slot_count')
        # A recorded expression may follow an explanatory clause; keep all of it
        # for students, and calculate only the explicitly marked expression.
        expression = body.split('記成：')[-1]
        left, right = GAP.split(expression)
        lk, lv = quantity(left)
        rk, rv = quantity(right)
        if lk != rk:
            raise ValueError('comparison_dimension_mismatch')
        value = '<' if lv < rv else '>' if lv > rv else '='
        slots.append({'index': index, 'value': value, 'left': str(lv), 'right': str(rv), 'dimension': lk})
        displayed.append(f'({index}) ' + GAP.sub(f'（第{index}格）', body))
    if len(slots) < 2:
        raise ValueError('comparison_requires_multiple_slots')
    answer = re.sub(r'^\s*答案\s*[:：]\s*', '', teacher_text).strip()
    pieces = re.split('[；;]', answer)
    teacher = []
    for index, piece in enumerate(pieces, 1):
        piece = re.sub('[１-９]', lambda m: str(ord(m[0]) - ord('０')), piece.strip())
        match = LABEL.fullmatch(piece)
        if not match or (int(match[1]) if match[1] else ord(match[2]) - ord('①') + 1) != index:
            raise ValueError('teacher_comparison_position')
        teacher.append(unicodedata.normalize('NFKC', match[3]).strip())
    computed = [slot['value'] for slot in slots]
    refs = [unicodedata.normalize('NFKC', str(value)).strip() for value in references]
    if teacher != computed or refs != computed:
        raise ValueError('comparison_teacher_review_calculation_mismatch')
    fields = [{'id': f'f{s["index"]}', 'label': f'第{s["index"]}格', 'input': 'single',
               'options': [{'id': value, 'content': {'text': sign, 'media': []}} for sign, value in SIGNS.items()]} for s in slots]
    return {'prompt': {'text': '\n'.join(displayed), 'media': [], 'layout': [
        {'type': 'paragraph', 'runs': [{'type': 'text', 'text': text}]} for text in displayed]},
        'fields': fields, 'answer': {'format': 'fields-v1', 'fields': {f'f{s["index"]}': [SIGNS[s['value']]] for s in slots}},
        'binding': slots}
