"""來源對照表與候選 JSON 的離線發布檢查；不連雲端、不改原件。"""
import sys,json,argparse
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent/'lib'))
from quiz_fractions import assert_no_fraction_images
p=argparse.ArgumentParser();p.add_argument('--map',required=True);p.add_argument('--candidate',required=True);args=p.parse_args()
formulas=json.loads(Path(args.map).read_text(encoding='utf-8-sig'))
if not isinstance(formulas,dict)or not formulas:raise ValueError('missing_source_verified_formula_map')
candidate=json.loads(Path(args.candidate).read_text(encoding='utf-8-sig'));checked=0
def walk(x):
 global checked
 if isinstance(x,list):
  for v in x:walk(v)
 elif isinstance(x,dict):
  if 'layout'in x and 'media'in x:
   assert_no_fraction_images(x,formulas);checked+=1
  else:
   for v in x.values():walk(v)
walk(candidate)
if not checked:raise ValueError('no_renderable_content_checked')
print(json.dumps({'passed':True,'content_blocks_checked':checked,'scope':'source_verified_map_only','unknown_images_require_visual_review':True}))
