import unittest,tempfile
import copy,os,subprocess,sys
from pathlib import Path
from PIL import Image,ImageDraw
from lib.quiz_matching_crops import propose_graphic_crops,write_reviewed_crops,plan_sha256

class CheckedCropTests(unittest.TestCase):
    def test_proposal_requires_visual_review_and_retains_pixels_and_order(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);source=root/'source.png';image=Image.new('RGB',(1000,900),'white');draw=ImageDraw.Draw(image)
            for y in [50,350,650]:
                draw.ellipse((50,y,230,y+180),fill=(210,210,210),outline='black',width=3)
                draw.text((8,y-20),'1',fill='black');draw.ellipse((450,y+80,460,y+90),fill='black')
            image.save(source);plan=propose_graphic_crops(source,3,source_id='source',stem='source')
            self.assertEqual(len(plan['boxes']),3)
            reviewed={'sourceId':'source','sourcePngSha256':plan['sourcePngSha256'],'planSha256':plan_sha256(plan)}
            with self.assertRaises(AssertionError):write_reviewed_crops(source,plan,root/'out','source',source_id='source',reviewed=reviewed)
            plan['visuallyReviewed']=True;reviewed={'sourceId':'source','sourcePngSha256':plan['sourcePngSha256'],'planSha256':plan_sha256(plan)};rows=write_reviewed_crops(source,plan,root/'out','source',source_id='source',reviewed=reviewed)
            for row in rows:
                with Image.open(row['path']) as crop:self.assertEqual(crop.tobytes(),image.crop(tuple(row['bbox'])).tobytes())
            self.assertEqual(rows,write_reviewed_crops(source,plan,root/'out','source',source_id='source',reviewed=reviewed))
            image.putpixel((2,2),(0,0,0));image.save(source)
            with self.assertRaises(AssertionError):write_reviewed_crops(source,plan,root/'out','source',source_id='source',reviewed=reviewed)

    def test_uncertain_counts_and_overlapping_manual_boxes_stop(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);source=root/'source.png';image=Image.new('RGB',(1000,900),'white');ImageDraw.Draw(image).rectangle((50,50,250,250),fill='grey');image.save(source)
            with self.assertRaises(AssertionError):propose_graphic_crops(source,2,source_id='source',stem='source')
            plan=propose_graphic_crops(source,1,source_id='source',stem='source');plan.update(visuallyReviewed=True,expectedCount=2,boxes=[[50,50,251,251],[60,60,252,252]]);reviewed={'sourceId':'source','sourcePngSha256':plan['sourcePngSha256'],'planSha256':plan_sha256(plan)}
            with self.assertRaises(AssertionError):write_reviewed_crops(source,plan,root/'out','source',source_id='source',reviewed=reviewed)
            self.assertFalse((root/'out').exists())

    def test_review_hash_binds_source_identity_stem_and_coordinates(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);source=root/'source.png';image=Image.new('RGB',(1000,900),'white');ImageDraw.Draw(image).rectangle((50,50,250,250),fill='grey');image.save(source)
            plan=propose_graphic_crops(source,1,source_id='source',stem='source');plan['visuallyReviewed']=True
            reviewed={'sourceId':'source','sourcePngSha256':plan['sourcePngSha256'],'planSha256':plan_sha256(plan)}
            changed=copy.deepcopy(plan);changed['boxes'][0][0]+=1
            with self.assertRaises(AssertionError):write_reviewed_crops(source,changed,root/'out','source',source_id='source',reviewed=reviewed)
            with self.assertRaises(AssertionError):write_reviewed_crops(source,plan,root/'out','other',source_id='source',reviewed=reviewed)
            with self.assertRaises(AssertionError):write_reviewed_crops(source,plan,root/'out','source',source_id='other',reviewed=reviewed)
            self.assertFalse((root/'out').exists())
            (root/'out').mkdir();extra=root/'out/source-2.png';extra.write_bytes(b'older crop')
            with self.assertRaises(AssertionError):write_reviewed_crops(source,plan,root/'out','source',source_id='source',reviewed=reviewed)
            self.assertEqual(extra.read_bytes(),b'older crop')

    def test_optimized_python_cannot_disable_crop_guards(self):
        result=subprocess.run([sys.executable,'-B','-O','-c','from lib import quiz_matching_crops'],cwd=Path(__file__).parent,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'},capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('Optimized Python is not supported',result.stderr)

if __name__=='__main__':unittest.main()
