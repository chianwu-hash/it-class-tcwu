"""Verify an existing single-choice candidate against source-order choices."""

import re
import unicodedata
from urllib.parse import urlsplit
from quiz_comparison_source import quantity


def _text(value):
    return re.sub(r"\s+", "", value).rstrip("\u3002")


def _image_digests(content):
    digests = []
    for item in content["media"]:
        name = urlsplit(item["url"]).path.rsplit("/", 1)[-1]
        match = re.fullmatch(r"([0-9a-f]{64})(?:\.(?:png|webp|jpg|jpeg|gif))?", name)
        if item["kind"] != "image" or not match:
            raise ValueError("source_option_media_not_content_addressed")
        digests.append(match[1])
    return digests


def bind_single_choice(question, parts, key_index, *, paper_mark=False, verified_image_aliases=None):
    """Require matching option order, complete option content and answer ID.

    Callers may enable paper-mark tolerance after verifying labeled paper
    choices and a printed marking instruction. Only a standalone empty square
    beside a complete image, or on its own option line, can be omitted.
    An image alias must be proven by the caller from the exact served bytes
    and the full source image before its digest can be substituted.
    """
    options = question.get("options", [])
    if question.get("type") != "single" or len(options) != len(parts) or not 0 <= key_index < len(options):
        raise ValueError("source_option_count_or_type")
    if options[key_index]["id"] != question.get("answer", {}).get("option_id"):
        raise ValueError("source_option_key_mismatch")
    omitted_paper_marks = 0
    for source, candidate in zip(parts, options, strict=True):
        shown = candidate["content"]
        source_images = _image_digests(source)
        shown_images = _image_digests(shown)
        if verified_image_aliases:
            shown_images = [verified_image_aliases.get(digest, digest) for digest in shown_images]
        if source_images != shown_images:
            raise ValueError("source_option_media_order_mismatch")
        if _text(source["text"]) == _text(shown["text"]):
            continue
        lines = source["text"].splitlines()
        without_mark = "\n".join(line for line in lines if line.strip() != "\u25a1")
        separated_mark = len(lines) > 1 and len(lines) - len(without_mark.splitlines()) == 1
        image_mark = len(source_images) == 1 and source["text"].strip() == "\u25a1"
        if paper_mark and (separated_mark or image_mark) and _text(without_mark) == _text(shown["text"]):
            omitted_paper_marks += 1
            continue
        raise ValueError("source_option_content_mismatch")
    return omitted_paper_marks


def labeled_weight_choice(content, teacher, reference):
    """Convert explicit labeled weights when the original key and arithmetic agree."""
    if content.get("media") or teacher.get("media"):
        raise ValueError("weight_choice_media_requires_mapping")
    lines = content["text"].strip().splitlines()
    layout = content.get("layout")
    if layout is not None and (
        any(block["type"] != "paragraph" or set(block) != {"type", "runs"}
            or any(run["type"] != "text" or set(run) != {"type", "text"} for run in block["runs"])
            for block in layout)
        or "\n".join("".join(run["text"] for run in block["runs"]) for block in layout).strip().splitlines() != lines
    ):
        raise ValueError("weight_choice_layout_requires_mapping")
    header = re.fullmatch(r"把(最重|最輕)的圈起來。", lines[0]) if lines else None
    if not header or not 3 <= len(lines) <= 9:
        raise ValueError("explicit_weight_extreme_instruction_required")
    labels = "ㄅㄆㄇㄈㄉㄊㄋㄌ"
    seen, values, options = [], [], []
    for index, line in enumerate(lines[1:]):
        match = re.fullmatch(r"\s*([ㄅㄆㄇㄈㄉㄊㄋㄌ])\s+(.+?)\s*", line)
        if not match or match[1] != labels[index]:
            raise ValueError("complete_sequential_weight_labels_required")
        kind, amount = quantity(re.sub(r"[gG]$", "公克", unicodedata.normalize("NFKC", match[2])))
        if kind != "grams":
            raise ValueError("original_weight_unit_required")
        seen.append(match[1])
        values.append(amount)
        options.append({"id": f"o{index + 1}", "content": {"text": match[2], "media": []}})
    wanted = max(values) if header[1] == "最重" else min(values)
    if values.count(wanted) != 1:
        raise ValueError("unique_original_weight_extreme_required")
    chosen = values.index(wanted)
    key = re.sub(r"^\s*答案\s*[:：]\s*", "", teacher["text"]).strip()
    if key != seen[chosen] or str(reference).strip() != key:
        raise ValueError("teacher_review_independent_weight_mismatch")
    return {
        "type": "single",
        "prompt": {"text": f"哪一個{header[1]}？", "media": []},
        "options": options,
        "answer": {"option_id": options[chosen]["id"]},
    }


def bind_cropped_choice_key(labels, teacher_text, fixed_reference, fixed_locator):
    """Map an original printed answer to its manually reviewed crop order."""
    labels = tuple(labels)
    if not 2 <= len(labels) <= 8:
        raise ValueError("complete_original_crop_labels_required")
    supported = [tuple(str(i + 1) for i in range(len(labels))), tuple("ABCDEFGH"[:len(labels)])]
    if labels not in supported and labels != ("left", "right"):
        raise ValueError("complete_original_crop_labels_required")

    def clean(value):
        return re.sub(r"\s+", "", unicodedata.normalize("NFKC", str(value)))

    def key(value):
        value = re.sub(r"^答案:", "", clean(value))
        if labels == ("left", "right"):
            match = re.fullmatch(r"圖([1-9]\d*)(左|右)\(\)打[ˇ✓√Vv]", value)
            return (match[1], "left" if match[2] == "左" else "right") if match else None
        match = re.fullmatch(r"(?:\(([1-8])\)|([1-8A-H]))(?:圈起來|[ˇ✓√Vv])?", value)
        return (match[1] or match[2]) if match else None

    original, fixed = key(teacher_text), key(fixed_reference)
    if labels != ("left", "right") and fixed is None and clean(fixed_reference) in ("v", "V", "ˇ", "✓", "√"):
        mark = re.match(r"(?:在)?\(([1-8])\)", clean(fixed_locator))
        fixed = mark[1] if mark else None
    if original is None or original != fixed:
        raise ValueError("teacher_and_fixed_cropped_choice_mismatch")
    label = original[1] if isinstance(original, tuple) else original
    if label not in labels:
        raise ValueError("teacher_choice_outside_cropped_labels")
    return f"o{labels.index(label) + 1}"
