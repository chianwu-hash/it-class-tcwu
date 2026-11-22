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


def bind_graphic_choice_key(source, teacher):
    """Locate a single image key among the printed, comma-separated options."""
    layout = source.get("layout") or []
    if len(layout) < 2 or layout[-1].get("type") != "paragraph":
        raise ValueError("graphic_choice_option_paragraph_required")
    runs = layout[-1]["runs"]
    separators = [run["text"].strip() for run in runs[::2] if run["type"] == "text"]
    options = runs[1::2]
    if (not 2 <= len(options) <= 8 or len(runs) != 2 * len(options) + 1
            or len(separators) != len(options) + 1 or separators[0] not in ("（", "(")
            or separators[-1] not in ("）", ")") or any(s not in ("，", ",", "、") for s in separators[1:-1])
            or any(r["type"] != "image" or type(r.get("media_index")) is not int
                   or not 0 <= r["media_index"] < len(source["media"]) for r in options)):
        raise ValueError("graphic_choice_option_boundaries_unverified")
    original = [source["media"][r["media_index"]] for r in options]
    hashes = _image_digests({"media": original})
    teacher_hashes = _image_digests(teacher)
    if len(teacher_hashes) != 1 or hashes.count(teacher_hashes[0]) != 1:
        raise ValueError("graphic_choice_key_not_unique")
    return original, hashes.index(teacher_hashes[0])


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


def marked_single_choice(source, teacher_text, fixed_mark, fixed_locator):
    """Convert a printed one-answer comparison whose mark is bound to a position."""
    mark = r"[ˇ✓√Vv]"
    labels = ("①②③④⑤⑥⑦⑧", "ㄅㄆㄇㄈㄉㄊㄋㄌ")
    printed_label = "[" + "".join(labels) + "]"
    layout = source.get("layout") or []
    if len(layout) < 2 or any(part["type"] != "paragraph" or set(part) != {"type", "runs"} for part in layout):
        raise ValueError("marked_choice_paragraph_layout_required")
    if any(run["type"] != "text" for run in layout[0]["runs"]):
        raise ValueError("marked_choice_plain_prompt_required")
    prompt = "".join(r["text"] for r in layout[0]["runs"]).strip()
    question = re.fullmatch(r"((?:下面)?哪一[^。！？?]*比較[重輕][？?])\s*(?:請)?(?:在\s*□\s*裡)?打" + mark + r"[。．：:]?", prompt)
    simple = re.fullmatch(r"比較([重輕])的打" + mark + r"[。．]?", prompt)
    if not question and not simple:
        raise ValueError("marked_choice_single_comparison_required")
    prompt = question[1] if question else f"哪一個比較{simple[1]}？"

    options, original_labels, media_order = [], [], []
    for part in layout[1:]:
        runs = []
        for run in part["runs"]:
            if run["type"] == "marker" and type(run.get("number")) is int and 1 <= run["number"] <= 8:
                runs.append({"type": "text", "text": labels[0][run["number"] - 1]})
            elif run["type"] == "text":
                runs.extend({"type": "text", "text": token} for token in re.split(f"({printed_label})", run["text"]) if token)
            elif run["type"] == "image":
                runs.append(run)
            else:
                raise ValueError("marked_choice_unsupported_option_run")
        starts = [i for i, run in enumerate(runs) if run["type"] == "text" and re.fullmatch(printed_label, run["text"])]
        if not starts:
            raise ValueError("marked_choice_missing_printed_label")
        prefix = "".join(r["text"] for r in runs[:starts[0]] if r["type"] == "text").strip()
        if any(r["type"] != "text" for r in runs[:starts[0]]) or prefix not in ("", "□") or prefix and len(starts) != 1:
            raise ValueError("marked_choice_ambiguous_box_position")
        for start, end in zip(starts, starts[1:] + [len(runs)], strict=True):
            tail = runs[start + 1:end]
            text = "".join(r["text"] for r in tail if r["type"] == "text").strip()
            if prefix != "□":
                if not text.startswith("□"):
                    raise ValueError("marked_choice_missing_option_box")
                text = text[1:].strip()
            indices = [r["media_index"] for r in tail if r["type"] == "image"]
            if "□" in text or len(indices) > 1 or bool(text) == bool(indices):
                raise ValueError("marked_choice_ambiguous_option")
            original_labels.append(runs[start]["text"])
            media_order.extend(indices)
            options.append({"id": f"o{len(options) + 1}", "content": {
                "text": text, "media": [source["media"][i] for i in indices],
            }})
    if not 2 <= len(options) <= 8 or not any(original_labels == list(a[:len(options)]) for a in labels):
        raise ValueError("marked_choice_incomplete_source_order")
    if sorted(media_order) != list(range(len(source["media"]))):
        raise ValueError("marked_choice_must_preserve_each_source_image")

    teacher = re.fullmatch(r"\s*答案\s*[:：]\s*(" + printed_label + r")\s*" + mark + r"\s*", teacher_text)
    fixed = re.fullmatch(r"\s*(" + printed_label + r")\s*(?:方框|括號)\s*", fixed_locator)
    if not teacher or not fixed or teacher[1] != fixed[1] or not re.fullmatch(mark, str(fixed_mark).strip()):
        raise ValueError("teacher_and_fixed_mark_position_mismatch")
    if teacher[1] not in original_labels:
        raise ValueError("teacher_mark_outside_printed_options")
    chosen = original_labels.index(teacher[1])
    return {
        "type": "single", "prompt": {"text": prompt, "media": []}, "options": options,
        "answer": {"option_id": options[chosen]["id"]}, "source_labels": original_labels,
    }


def boxed_single_choice(source, teacher_text, fixed_reference, fixed_locator):
    """Split one checked option from paragraph runs without moving shared figures."""
    mark = r"[ˇ✓√Vv]"
    box = r"(?:□|[（(]\s*[）)])"
    numbered = re.compile(box + r"\s*[（(]([1-8１-８])[）)]\s*(.+)")
    instruction = re.compile(r"([？?])\s*(?:請|在[（(]\s*[）)]裡)?打" + mark + r"[。．]?\s*$")
    layout = source.get("layout") or []
    if len(layout) < 2 or any(part.get("type") != "paragraph" or set(part) != {"type", "runs"} for part in layout):
        raise ValueError("boxed_choice_paragraph_layout_required")
    if any(run.get("type") not in ("text", "image") for part in layout for run in part["runs"]):
        raise ValueError("boxed_choice_unsupported_run")

    media = source["media"]
    parts = [part["runs"] for part in layout]
    indices = [run["media_index"] for runs in parts for run in runs if run["type"] == "image"]
    if (any(type(i) is not int for i in indices) or sorted(indices) != list(range(len(media)))
            or any(item.get("kind") != "image" for item in media)):
        raise ValueError("boxed_choice_must_preserve_each_source_image")

    def text(runs):
        return "".join(run["text"] for run in runs if run["type"] == "text").strip()

    start = next((i for i, runs in enumerate(parts) if re.match(box, text(runs))), 0)
    if not start:
        raise ValueError("boxed_choice_missing_option_boundary")
    prompt_parts = []
    matched = False
    for runs in parts[:start]:
        prompt_runs = []
        for run in runs:
            if run["type"] == "image":
                prompt_runs.append(run.copy())
                continue
            if matched and run["text"].strip():
                raise ValueError("boxed_choice_text_after_instruction")
            value, count = instruction.subn(r"\1", run["text"])
            matched = matched or bool(count)
            if value.strip():
                prompt_runs.append({"type": "text", "text": value})
        if prompt_runs:
            prompt_parts.append(prompt_runs)
    if not matched:
        raise ValueError("boxed_choice_single_mark_instruction_required")

    labels, contents = [], []
    option_runs = parts[start:]
    if numbered.fullmatch(text(option_runs[0])):
        for runs in option_runs:
            value = text(runs)
            images = [media[run["media_index"]] for run in runs if run["type"] == "image"]
            match = numbered.fullmatch(value)
            if match and runs[0]["type"] == "text" and not re.search(box, match[2]):
                labels.append(unicodedata.normalize("NFKC", match[1]))
                contents.append({"text": match[2], "media": images})
            elif not value and images and contents:
                contents[-1]["media"].extend(images)
            else:
                raise ValueError("boxed_choice_incomplete_numbered_options")
        if any(len(content["media"]) > 1 for content in contents):
            raise ValueError("boxed_choice_ambiguous_numbered_media")
        chosen = bind_cropped_choice_key(labels, teacher_text, fixed_reference, fixed_locator)
    else:
        for runs in option_runs:
            if any(run["type"] != "text" for run in runs) or not text(runs).startswith("□"):
                raise ValueError("boxed_choice_ambiguous_named_options")
            labels.extend(value.strip() for value in text(runs)[1:].split("□"))

        def compact(value):
            return re.sub(r"\s+", "", unicodedata.normalize("NFKC", str(value)))

        keys = [compact(label) for label in labels]
        original = re.fullmatch(r"答案:" + mark + r"(.+)", compact(teacher_text))
        fixed = compact(fixed_reference)
        if (not original or original[1] != fixed or fixed not in keys or len(set(keys)) != len(keys)
                or any(not key or re.search(box, key) or re.match(r"\(\d+\)", key) for key in keys)):
            raise ValueError("boxed_choice_teacher_and_fixed_names_mismatch")
        chosen = f"o{keys.index(fixed) + 1}"
        contents = [{"text": label, "media": []} for label in labels]
    if not 2 <= len(contents) <= 8:
        raise ValueError("boxed_choice_option_count")

    prompt_media = []
    for runs in prompt_parts:
        for run in runs:
            if run["type"] == "image":
                prompt_media.append(media[run["media_index"]])
                run["media_index"] = len(prompt_media) - 1
    prompt = {"text": "\n".join(filter(None, map(text, prompt_parts))), "media": prompt_media}
    if prompt_media:
        prompt["layout"] = [{"type": "paragraph", "runs": runs} for runs in prompt_parts]
    return {
        "type": "single", "prompt": prompt,
        "options": [{"id": f"o{i}", "content": value} for i, value in enumerate(contents, 1)],
        "answer": {"option_id": chosen}, "source_labels": labels,
    }
