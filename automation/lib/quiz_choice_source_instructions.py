"""只改已確認單選來源的紙本操作提示，不增加題意。"""
import re

_PAPER_MARK = re.compile(r"(?:請)?(?:在[（(]\s*[）)](?:裡|內))?打[ˇ✓√](?:[。．]|(?=$))")


def neutralize_single_choice_instruction(text, *, source_type):
    if source_type != "single_choice":
        raise ValueError("confirmed_single_choice_source_required")
    if not isinstance(text, str):
        raise ValueError("source_text_required")
    return _PAPER_MARK.sub("請選擇答案。", text)
