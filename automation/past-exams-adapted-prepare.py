"""製播計畫與必要原圖擷取；不把自行編稿當成官方稿。"""
from pathlib import Path
import json,hashlib,pymupdf,io,math
from PIL import Image,ImageDraw
R=Path('automation/output/past-exams-adapted-listening-20261101');read=lambda p:json.loads(Path(p).read_text(encoding='utf-8-sig'));save=lambda p,v:Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8');sha=lambda b:hashlib.sha256(b).hexdigest()
rows=read(R/'script-proposals.private.json');assert len(rows)==26
tracks=[];allimages=[]
for year in [113,114]:
 pid=f'dingxi-{year}-1-g3-exam1-english';folder=R/pid;sources=read(folder/'source-pages.private.json')['sources'];s=sources['paper'];assert sha(Path(s['original']).read_bytes())==s['originalSha256'];doc=pymupdf.open(s['pdf']);page=doc[0];assets=folder/'assets';assets.mkdir(exist_ok=True)
 # 範圍只包括必要的原試卷圖片，不裁解答字或數字單字。
 boxes=([[547.15,551.8,582.41,613],[612,551.5,644.41,614]],[[685.4,540.73,763.16,622.54],[764.6,549.38,827.93,615.94]],[[860.8,552,928,611],[946.5,551.5,999,613]]) if year==113 else ([[543.45,465.67,578.51,521.77],[606.7,464.47,636.1,521.09]],[[686.5,456.92,758.51,532.64],[764.34,462.22,827.68,528.79]],[[850.9,482.22,927.11,521.84],[938.04,466.32,985.46,521.84]])
 images=[]
 for qi,pair in enumerate(boxes,1):
  for oi,box in enumerate(pair,1):
   rect=pymupdf.Rect(box);assert page.rect.contains(rect);parts=[]
   for info in page.get_images():
    for bounds,matrix in page.get_image_rects(info[0],transform=True):
     if rect.contains((bounds.tl+bounds.br)/2):parts.append((info[0],info[1],bounds,matrix))
   assert parts,(year,qi,oi);bounds=pymupdf.Rect(parts[0][2])
   for part in parts[1:]:bounds|=part[2]
   scale=300/72;size=(math.ceil(bounds.width*scale),math.ceil(bounds.height*scale));white=Image.new('RGBA',size,'white')
   for xref,smask,_,matrix in parts:
    base=pymupdf.Pixmap(doc,xref);pix=pymupdf.Pixmap(pymupdf.Pixmap(base,0),pymupdf.Pixmap(doc,smask)) if smask else base
    im=Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGBA');a,b,c,d,e,f=tuple(~matrix);w,h=im.size
    coefficients=(a*w/scale,c*w/scale,(a*bounds.x0+c*bounds.y0+e)*w,b*h/scale,d*h/scale,(b*bounds.x0+d*bounds.y0+f)*h)
    white.alpha_composite(im.transform(size,Image.Transform.AFFINE,coefficients,Image.Resampling.BICUBIC))
   out=io.BytesIO();white.convert('RGB').save(out,format='PNG');data=out.getvalue();h=sha(data);f=assets/(h+'.png');f.write_bytes(data);images.append({'id':f'E{qi}-{oi}','paperId':pid,'page':1,'bboxPt':list(bounds),'sourceSha256':s['originalSha256'],'hash':h,'file':str(f.resolve()),'width':size[0],'height':size[1],'embeddedXrefs':[x[0] for x in parts],'renderMode':'native-images-smask-affine-white','alt':f'原卷E第{qi}題第{oi}張圖片'})
 save(folder/'images-manifest.private.json',images);allimages+=images;doc.close()
 for p in [r for r in rows if r['paperId']==pid]:
  tracks.append({'id':pid+'__adapted-'+p['section']+str(p['number']),'paperId':pid,'questionId':p['id'],'edition':'改編聽力練習版','officialScriptAvailable':False,'source':{'fileId':'paper-and-key','page':1,'paperSha256':s['originalSha256'],'keySha256':sources['key']['originalSha256'],'description':'依原試卷題意、選項與官方解答自行編製；不是官方聽力稿或原音。'},'segments':[{'text':p['script'],'voice':p['voice'],'gapAfter':.8}],'repeat':2,'repeatGap':2,'rate':p['rate']})
save(R/'plan.private.json',{'policy':'2026-11-01教師明確授權依26個缺稿原題及答案自行編聽力稿、製播，標明改編版，AI討論與驗證後上線。','tracks':tracks,'imageCount':len(allimages)})
sheet=Image.new('RGB',(1000,6*210),'white');draw=ImageDraw.Draw(sheet)
for i,m in enumerate(allimages):
 im=Image.open(m['file']).convert('RGB');im.thumbnail((420,175));x=(i%2)*500;y=(i//2)*210;sheet.paste(im,(x+30,y+25));draw.text((x+20,y+5),m['paperId'].split('-')[1]+' '+m['id'],fill='black')
sheet.save(R/'images-contact.private.png');print(json.dumps({'tracks':len(tracks),'images':len(allimages)}))
