"""核對原題最大／最小餘數雙選鍵；紙本V/X不是一般是非答案。"""
import re
import unicodedata


def verify_remainder_extremes(amounts, divisor, teacher_key, reviewed_indices):
    if not isinstance(amounts, list) or not 2 <= len(amounts) <= 8 or any(type(n) is not int or not 0 <= n <= 10**9 for n in amounts):
        raise ValueError('bounded_original_integer_options_required')
    if type(divisor) is not int or not 1 <= divisor <= 10**9:
        raise ValueError('positive_original_divisor_required')
    key = unicodedata.normalize('NFKC', teacher_key).strip()
    key = re.sub(r'^答案\s*[:：]\s*', '', key)
    entries = re.fullmatch(r'\(([1-8])\)\s*([ˇ✓√Vv])\s*[;；]\s*\(([1-8])\)\s*([╳×Xx])', key)
    if not entries:
        raise ValueError('explicit_ordered_maximum_minimum_teacher_marks_required')
    given = [int(entries[1]), int(entries[3])]
    remainders = [n % divisor for n in amounts]
    highest, lowest = max(remainders), min(remainders)
    if highest == lowest or remainders.count(highest) != 1 or remainders.count(lowest) != 1:
        raise ValueError('unique_maximum_and_minimum_required')
    expected = [remainders.index(highest) + 1, remainders.index(lowest) + 1]
    if given != expected or reviewed_indices != expected:
        raise ValueError('teacher_review_independent_remainder_mismatch')
    return {'maximum_index_1based': expected[0], 'minimum_index_1based': expected[1], 'remainders': remainders}
