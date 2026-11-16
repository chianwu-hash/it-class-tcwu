"""以教師原圖核對完整圖形選項；不猜圖意，不處理近似圖片。"""
import hashlib
import re
from PIL import Image


def _single_image_layout(content):
    if "layout" not in content:
        return True
    indexes = []

    def walk(value):
        if isinstance(value, list):
            for item in value:
                walk(item)
        elif isinstance(value, dict):
            if value.get("type") == "image":
                indexes.append(value.get("media_index"))
            for item in value.values():
                if isinstance(item, (dict, list)):
                    walk(item)

    walk(content["layout"])
    return indexes == [0]


def image_pixel_identity(path):
    """保留原尺寸及透明度；不縮放、不裁切、不做近似比對。"""
    with Image.open(path) as source:
        if getattr(source, "n_frames", 1) != 1:
            raise ValueError("animated_teacher_key_not_supported")
        image = source.convert("RGBA")
        return image.size, hashlib.sha256(image.tobytes()).hexdigest()


def match_teacher_graphic_choice(teacher, options, resolve_image):
    """只接受一張完整教師鍵圖，且唯一選項的完整圖像逐像素相同。

    呼叫端仍須核來源 SHA、全部選項拆分／圖位、複核疑義、解析中的
    亂序引用、教材頁碼及學生畫面。匹配成功不是上線核准。
    """
    text = re.sub(r"^\s*答案\s*[:：]\s*", "", teacher.get("text", ""))
    text = text.replace("圈起來", "").strip()
    if text or len(teacher.get("media", [])) != 1 or not _single_image_layout(teacher):
        raise ValueError("one_complete_teacher_graphic_required")
    if not 2 <= len(options) <= 8:
        raise ValueError("complete_options_required")
    identity = image_pixel_identity(resolve_image(teacher["media"][0]))
    matches = []
    for index, option in enumerate(options):
        # A square can be a meaningful option. Only ignore a paper checkbox
        # when a complete image is present beside it.
        if len(option.get("media", [])) != 1 or not _single_image_layout(option) or option.get("text", "").strip() not in ("", "。", "□"):
            continue
        if image_pixel_identity(resolve_image(option["media"][0])) == identity:
            matches.append(index)
    if len(matches) != 1:
        raise ValueError("teacher_graphic_not_exact_unique_option")
    return {"option_index": matches[0], "pixel_sha256": identity[1], "size": list(identity[0])}
