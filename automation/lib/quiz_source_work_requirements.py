"""原出版題型與題文的作答要求，優先於模型的 auto_grade 標籤。"""
import re


def source_work_requirements(catalog, question_text=""):
    if not isinstance(catalog, dict) or not isinstance(catalog.get("item_types"), list) or not catalog["item_types"]:
        raise ValueError("original_publisher_item_types_required")
    names = []
    for item in catalog["item_types"]:
        if not isinstance(item, dict) or not isinstance(item.get("name"), str) or not item["name"].strip():
            raise ValueError("original_publisher_item_types_required")
        names.append(item["name"])
    result = []
    patterns = [
        ("equation", r"寫出算式|列式|把做法和答案記下來"),
        ("vertical_work", r"寫出直式|用直式|直式計算"),
        ("drawing", r"畫畫看|畫一畫|畫出|畫線"),
        ("coloring", r"塗塗看|塗一塗|塗滿|塗出|塗上顏色"),
        ("matching", r"連連看|連一連|連線"),
    ]
    for kind, pattern in patterns:
        for name in names:
            if re.search(pattern, name):
                result.append({"kind": kind, "origin": "publisher_item_type", "evidence": name})
        instruction = re.search(r"(?:^|[。！？\n])\s*(?:(?:請|試著|你|再|並|先|把|將)[^。！？\n]{0,24})?(?:" + pattern + r")", question_text)
        if instruction:
            result.append({"kind": kind, "origin": "question_text", "evidence": instruction.group(0).strip()})
    return result


def assert_result_only_source_allowed(catalog, question_text=""):
    requirements = source_work_requirements(catalog, question_text)
    if requirements:
        raise ValueError("source_work_response_storage_required:" + ",".join(sorted({r["kind"] for r in requirements})))
    return True
