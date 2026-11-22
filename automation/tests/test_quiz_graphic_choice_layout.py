import sys
import unittest
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

from PIL import Image, ImageDraw, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
from quiz_graphic_choice_layout import NS, crop_choice_figure, uniquely_match_line_art, word_image_occurrences


class GraphicChoiceLayoutTests(unittest.TestCase):
    def test_word_crop_and_flip_apply_to_each_occurrence(self):
        source = Image.new("RGB", (4, 1))
        source.putdata([(255, 0, 0), (0, 0, 255), (0, 128, 0), (0, 0, 0)])
        img = BytesIO()
        source.save(img, format="PNG")
        xml = f"""<w:document xmlns:w="{NS['w']}" xmlns:a="{NS['a']}" xmlns:r="{NS['r']}">
         <w:p><w:r><w:drawing><a:blip r:embed="rId1"/><a:srcRect l="25000"/></w:drawing></w:r>
         <w:r><w:drawing><a:blip r:embed="rId1"/><a:srcRect l="25000"/><a:xfrm flipH="1"/></w:drawing></w:r></w:p>
        </w:document>"""
        docx = BytesIO()
        with ZipFile(docx, "w") as archive:
            archive.writestr("word/document.xml", xml)
            archive.writestr("word/_rels/document.xml.rels",
                             '<Relationships><Relationship Id="rId1" Target="media/image.png"/></Relationships>')
            archive.writestr("word/media/image.png", img.getvalue())
        (left, a), (right, b) = word_image_occurrences(docx.getvalue(), None)
        self.assertEqual(a["embedded_sha256"], b["embedded_sha256"])
        self.assertEqual(a["raster_box"], (1, 0, 4, 1))
        self.assertEqual(left.tobytes(), ImageOps.mirror(right).tobytes())
        self.assertFalse(a["flip_h"])
        self.assertTrue(b["flip_h"])

    def test_crop_excludes_controls_and_match_rejects_tie(self):
        source = Image.new("RGB", (90, 70), "white")
        draw = ImageDraw.Draw(source)
        draw.rectangle((8, 8, 55, 42), outline="black", width=3)
        draw.line((8, 26, 55, 26), fill="black", width=3)
        draw.line((63, 50, 72, 55), fill="black", width=3)
        option = crop_choice_figure(source, (0, 0, 90, 70), paper_only_boxes=((59, 46, 78, 61),))
        self.assertEqual(option.size, (48, 35))
        with self.assertRaisesRegex(ValueError, "graphic_control_touches_crop_boundary"):
            crop_choice_figure(source, (0, 0, 90, 70), paper_only_boxes=((64, 48, 78, 60),))
        with self.assertRaisesRegex(ValueError, "graphic_line_art_key_not_unique"):
            uniquely_match_line_art([option, option], option)


if __name__ == "__main__":
    unittest.main()
