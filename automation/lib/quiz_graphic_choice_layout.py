"""Recover printed Word figures before binding an image-only choice."""

import posixpath
from hashlib import sha256
from io import BytesIO
from pathlib import PurePosixPath
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from PIL import Image, ImageChops, ImageFilter, ImageOps


NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "v": "urn:schemas-microsoft-com:vml",
}


def _tag(prefix, name):
    return f"{{{NS[prefix]}}}{name}"


def word_image_occurrences(docx, load_vector):
    """Return visible rasters in document occurrence order, including repeats.

    load_vector receives the original EMF/WMF SHA and returns its source raster.
    Unsupported transformations require a separate source review.
    """
    with ZipFile(BytesIO(docx)) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
        rels = ET.fromstring(archive.read("word/_rels/document.xml.rels"))
        targets = {r.get("Id"): r.get("Target") for r in rels if r.get("TargetMode") != "External"}
        for node in root.iter():
            if node.tag not in (_tag("w", "drawing"), _tag("w", "pict"), _tag("w", "object")):
                continue
            modern = node.findall(".//a:blip", NS)
            legacy = node.findall(".//v:imagedata", NS)
            if len(modern) + len(legacy) != 1:
                raise ValueError("word_image_reference_not_unique")
            if modern:
                rel = modern[0].get(_tag("r", "embed"))
                rects = node.findall(".//a:srcRect", NS)
                transforms = node.findall(".//a:xfrm", NS)
                if len(rects) > 1 or len(transforms) > 1:
                    raise ValueError("word_multiple_image_transforms")
                attrs = transforms[0].attrib if transforms else {}
                if set(attrs) - {"flipH", "flipV", "rot"} or attrs.get("rot", "0") != "0" or attrs.get("flipV", "0") not in ("0", "false"):
                    raise ValueError("word_image_transform_requires_review")
                flip = attrs.get("flipH", "0")
                if flip not in ("0", "1", "false", "true"):
                    raise ValueError("word_unknown_horizontal_flip")
                flip_h = flip in ("1", "true")
                rect = rects[0].attrib if rects else {}
                if set(rect) - set("ltrb"):
                    raise ValueError("word_unknown_crop_edge")
                crop = tuple(int(rect.get(k, "0")) for k in "ltrb")
            else:
                rel = legacy[0].get(_tag("r", "id"))
                if any(k.lower().startswith("crop") for k in legacy[0].attrib):
                    raise ValueError("word_legacy_crop_requires_review")
                shapes = node.findall(".//v:shape", NS)
                if any(any(key in shape.get("style", "").lower() for key in ("flip:", "rotation:")) for shape in shapes):
                    raise ValueError("word_legacy_transform_requires_review")
                crop = (0, 0, 0, 0)
                flip_h = False
            path = posixpath.normpath(posixpath.join("word", targets.get(rel, "")))
            if not path.startswith("word/media/"):
                raise ValueError("word_local_image_required")
            data = archive.read(path)
            digest = sha256(data).hexdigest()
            suffix = PurePosixPath(path).suffix.lower()
            if suffix in (".wmf", ".emf"):
                image = load_vector(digest)
            else:
                with Image.open(BytesIO(data)) as opened:
                    image = opened.copy()
            l, t, r, b = crop
            if min(crop) < 0 or l + r >= 100000 or t + b >= 100000:
                raise ValueError("word_crop_out_of_bounds")
            w, h = image.size
            visible = (round(w*l/100000), round(h*t/100000), round(w*(1-r/100000)), round(h*(1-b/100000)))
            image = image.crop(_checked_bounds(image, visible))
            if flip_h:
                image = ImageOps.mirror(image)
            yield image, {"embedded_sha256": digest, "word_crop": crop, "raster_box": visible, "flip_h": flip_h}


def _checked_bounds(image, box):
    x0, y0, x1, y1 = box
    if not (0 <= x0 < x1 <= image.width and 0 <= y0 < y1 <= image.height):
        raise ValueError("graphic_crop_out_of_bounds")
    return box


def _white_background(image):
    rgba = image.convert("RGBA")
    result = Image.new("RGB", rgba.size, "white")
    result.paste(rgba, mask=rgba.getchannel("A"))
    return result


def _ink(image):
    return ImageOps.invert(image.convert("L")).point(lambda x: 255 if x > 100 else 0)


def crop_choice_figure(image, box, *, paper_only_boxes=()):
    """Copy a reviewed option and remove isolated printed controls."""
    result = _white_background(image.crop(_checked_bounds(image, box)))
    for paper_box in paper_only_boxes:
        excluded = _ink(result.crop(_checked_bounds(result, paper_box)))
        bounds = excluded.getbbox()
        if not bounds or not (0 < bounds[0] and 0 < bounds[1] and bounds[2] < excluded.width and bounds[3] < excluded.height):
            raise ValueError("graphic_control_touches_crop_boundary")
        result.paste("white", paper_box)
    ink_box = _ink(result).getbbox()
    if not ink_box:
        raise ValueError("graphic_option_is_empty")
    return result.crop(ink_box)


def uniquely_match_line_art(options, teacher_image):
    """Compare black-line figures at different print sizes without mirroring."""
    def normalized(image):
        trimmed = crop_choice_figure(image, (0, 0, image.width, image.height))
        mask = _ink(trimmed.resize((160, 160), Image.Resampling.LANCZOS))
        if not mask.getbbox():
            raise ValueError("graphic_line_art_disappears_after_normalization")
        return mask, trimmed.width / trimmed.height

    def coverage(a, b):
        return ImageChops.multiply(a, b.filter(ImageFilter.MaxFilter(9))).histogram()[255] / a.histogram()[255]

    key, key_aspect = normalized(teacher_image)
    scores = []
    for option in options:
        ink, aspect = normalized(option)
        aspect_similarity = min(aspect, key_aspect) / max(aspect, key_aspect)
        scores.append(min(coverage(ink, key), coverage(key, ink)) if aspect_similarity >= 0.85 else 0)
    ranks = sorted(range(len(scores)), key=scores.__getitem__, reverse=True)
    if len(ranks) < 2 or scores[ranks[0]] < 0.98 or scores[ranks[0]] - scores[ranks[1]] < 0.03:
        raise ValueError("graphic_line_art_key_not_unique")
    return ranks[0], scores
