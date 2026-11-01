"""Extract and register generated whole sprites. No character/limb repainting."""
from pathlib import Path
import sys,json,hashlib
import cv2,numpy as np
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parent.parent
RAW=Path('D:/projects/it-class-tcwu/automation/output/pet-surprise-20261101/generated')
OUT=ROOT/'garden/assets/processed/pet-surprise-v1'
def bbox(a):
 y,x=np.where(a>100);return [int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]
def process(sp):
 p=RAW/sp/'surprise-v1-01.png';im=Image.open(p).convert('RGBA');a=np.array(im)
 n,labels,stats,centroids=cv2.connectedComponentsWithStats((a[:,:,3]>100).astype('uint8'),8)
 ids=sorted([i for i in range(1,n) if stats[i,4]>10000],key=lambda i:centroids[i][0])
 assert len(ids)==3,(sp,len(ids))
 boxes=[[int(x),int(y),int(x+w),int(y+h)] for x,y,w,h,_ in stats[ids]]
 cuts=[0]+[round((boxes[i][2]+boxes[i+1][0])/2) for i in range(2)]+[im.width]
 cells=[];bounds=[]
 for i in range(3):
  c=np.array(im.crop((cuts[i],0,cuts[i+1],im.height)))
  n,l,st,_=cv2.connectedComponentsWithStats((c[:,:,3]>24).astype('uint8'),8)
  main=1+np.argmax(st[1:,4]);region=cv2.dilate((l==main).astype('uint8'),np.ones((15,15),'uint8'))>0
  c[~region]=0;c[c[:,:,3]<10]=0
  cells.append(Image.fromarray(c));bounds.append(bbox(c[:,:,3]))
 target=(560,500) if sp=='cat' else (840,600) if sp=='rabbit' else (840,500);anchor=[target[0]//2,560 if sp=='rabbit' else 460]
 ref=Image.open(ROOT/('garden/assets/processed/gait-v9/web/frame-6.webp' if sp=='cat' else f'garden/assets/processed/pets-v2/{sp}/stand-0.webp')).convert('RGBA')
 rb=bbox(np.array(ref)[:,:,3]);scale=(rb[3]-rb[1])/np.median([b[3]-b[1] for b in bounds]);refAnchor=303.4 if sp=='cat' else 420
 cx=anchor[0]+(rb[0]+rb[2])/2-refAnchor
 files=[];visible=[];qa=[];dest=OUT/sp;dest.mkdir(parents=True,exist_ok=True)
 for i,(cell,b) in enumerate(zip(cells,bounds)):
  # Single uniform scale for the entire sheet; translation aligns the feet.
  res=cell.convert('RGBa').resize((round(cell.width*scale),round(cell.height*scale)),Image.Resampling.LANCZOS).convert('RGBA')
  canvas=Image.new('RGBA',target);dx=round(cx-(b[0]+b[2])/2*scale);dy=round(anchor[1]-b[3]*scale);canvas.alpha_composite(res,(dx,dy))
  out=dest/f'surprise-{i}.webp';canvas.save(out,'WEBP',quality=95,method=6);files.append(f'{sp}/{out.name}');vb=bbox(np.array(canvas)[:,:,3]);visible.append(vb)
  assert vb[0]>0 and vb[1]>0 and vb[2]<target[0] and vb[3]<target[1],vb
  qa.append({'sourceBox':b,'scale':scale,'offset':[dx,dy]})
 mpath=OUT/'manifest.json';m=json.loads(mpath.read_text(encoding='utf8')) if mpath.exists() else {'species':{},'provenance':{}}
 m['species'][sp]={'canvas':{'size':list(target),'anchor':anchor,'referenceHeight':360},'groups':{'surprise':{'frames':files,'visibleBoxes':visible,'footAnchors':[anchor[1]]*3}}}
 m['provenance'][sp]={'sourceSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'registration':qa,'generator':'ChatGPT original character conversation; prompt by Claude Desktop Opus 5.5'}
 mpath.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf8')
 sheet=Image.new('RGB',(target[0]*3,target[1]),'#eaf3ee')
 for i,f in enumerate(files):
  c=Image.open(OUT/f).convert('RGBA');sheet.paste(c,(target[0]*i,0),c)
 sheet.save(RAW/sp/'contact.png');print(json.dumps({'species':sp,'files':files,'boxes':visible}))
if __name__=='__main__':process(sys.argv[1])
