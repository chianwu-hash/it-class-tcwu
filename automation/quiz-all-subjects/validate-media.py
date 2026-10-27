import pathlib,json,hashlib,sys
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')
out=pathlib.Path('automation/output/quiz/all-subjects-pool');assets=json.loads((out/'assets.json').read_text(encoding='utf-8'));images=audio=0
for sha,a in assets.items():
 p=pathlib.Path(a['path']);raw=p.read_bytes()
 if hashlib.sha256(raw).hexdigest()!=sha or len(raw)!=a['bytes']:raise ValueError('asset_hash_mismatch')
 if a['mime'].startswith('image/'):
  with Image.open(p) as im:im.load();assert im.width>0 and im.height>0
  images+=1
 else:
  if not(raw.startswith(b'ID3') or any(raw[i]==255 and raw[i+1]&224==224 for i in range(min(4096,len(raw)-1)))):raise ValueError('audio_header_invalid')
  audio+=1
(out/'qa/media-validation.json').write_text(json.dumps({'passed':True,'images_decoded':images,'audio_original_headers_and_hashes':audio}),encoding='utf-8')
print(json.dumps({'passed':True,'images':images,'audio':audio}))
