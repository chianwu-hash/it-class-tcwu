"""Propose bounded diagram crops; writing requires a separately reviewed SHA plan."""
from hashlib import sha256
from pathlib import Path
import json,os,re,tempfile
if not __debug__:
    raise RuntimeError('Optimized Python is not supported: crop guards must remain enabled')
import cv2
import numpy as np
from PIL import Image

def plan_sha256(plan):
    fixed={k:v for k,v in plan.items() if k!='visuallyReviewed'}
    return sha256(json.dumps(fixed,sort_keys=True,separators=(',',':')).encode('utf8')).hexdigest()

def propose_graphic_crops(path, expected_count, *, source_id, stem, left_fraction=0.4, padding=8):
    assert re.fullmatch(r'[A-Za-z0-9_-]{1,100}',source_id)
    assert re.fullmatch(r'[A-Za-z0-9_-]{1,100}',stem)
    assert isinstance(padding,int) and 0<=padding<=32
    path=Path(path);raw=path.read_bytes()
    with Image.open(path) as original:
        image=original.convert('RGBA')
        canvas=Image.new('RGBA',image.size,'white');canvas.alpha_composite(image)
        rgb=np.array(canvas.convert('RGB'))
    height,width=rgb.shape[:2];cut=int(width*left_fraction)
    assert 0.2<=left_fraction<=0.5 and 1<=expected_count<=8
    binary=(cv2.cvtColor(rgb[:,:cut],cv2.COLOR_RGB2GRAY)<245).astype('uint8')
    _,_,stats,_=cv2.connectedComponentsWithStats(binary,8)
    boxes=[]
    for x,y,w,h,area in stats[1:]:
        if w>=width*.1 and h>=height*.07 and .5<=w/h<=4:
            assert x+w<cut-2,'Graphic touches the column boundary; manual review required'
            boxes.append([int(x),int(y),int(x+w),int(y+h)])
    boxes.sort(key=lambda b:b[1])
    assert len(boxes)==expected_count,'Ambiguous component count; do not guess or omit diagrams'
    assert all(a[3]<=b[1] for a,b in zip(boxes,boxes[1:])),'Overlapping diagram rows'
    return {'sourceId':source_id,'stem':stem,'padding':padding,'sourcePngSha256':sha256(raw).hexdigest(),'sourceSize':[width,height],'expectedCount':expected_count,
            'method':'left_column_connected_component_proposal','leftFraction':left_fraction,
            'boxes':boxes,'visuallyReviewed':False}

def write_reviewed_crops(path, plan, output_dir, stem, *, source_id, reviewed):
    path=Path(path);output=Path(output_dir);raw=path.read_bytes()
    assert re.fullmatch(r'[A-Za-z0-9_-]{1,100}',stem),'Crop stem must not contain a path'
    assert plan['sourceId']==reviewed['sourceId']==source_id,'Reviewed source identity changed'
    assert plan['stem']==stem,'Reviewed output stem changed'
    assert plan_sha256(plan)==reviewed['planSha256'],'Reviewed crop coordinates or settings changed'
    assert plan['sourcePngSha256']==reviewed['sourcePngSha256']
    assert plan.get('visuallyReviewed') is True,'A proposal is not visual approval'
    assert sha256(raw).hexdigest()==plan['sourcePngSha256'],'Reviewed source bytes changed'
    padding=plan['padding'];assert isinstance(padding,int) and 0<=padding<=32
    with Image.open(path) as image:
        width,height=image.size;assert [width,height]==plan['sourceSize']
        assert len(plan['boxes'])==plan['expectedCount']
        previous=-1;rows=[];pending=[]
        for index,box in enumerate(plan['boxes'],1):
            assert len(box)==4 and all(isinstance(n,int) for n in box)
            x0,y0,x1,y1=box;assert 0<=x0<x1<=width and 0<=y0<y1<=height
            assert y0>=previous;previous=y1
            bbox=[max(0,x0-padding),max(0,y0-padding),min(width,x1+padding),min(height,y1+padding)]
            crop=image.crop(tuple(bbox))
            file=output/(stem+'-'+str(index)+'.png')
            # Preserve the original pixels/mode. No rescaling, inpainting or redraw.
            import io
            buffer=io.BytesIO();crop.save(buffer,format='PNG',icc_profile=image.info.get('icc_profile'));content=buffer.getvalue()
            if file.exists():assert file.read_bytes()==content,'Refuse to overwrite a different fixed crop'
            pending.append((file,content))
            rows.append({'index':index,'bbox':bbox,'path':str(file),'sha256':sha256(content).hexdigest(),
                         'bytes':len(content),'size':list(crop.size),'mime':'image/png',
                         'sourcePngSha256':plan['sourcePngSha256'],'pixelsUnchanged':True})
        expected={file for file,_ in pending}
        assert not set(output.glob(stem+'-*.png'))-expected,'Stale crop numbers require reconciliation'
        # Stage complete PNGs, then link them without overwriting existing files.
        output.mkdir(parents=True,exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='.crop-stage-',dir=output) as folder:
            staged=[];created=[]
            for file,content in pending:
                temp=Path(folder)/file.name;temp.write_bytes(content);staged.append((temp,file))
            try:
                for temp,file in staged:
                    if file.exists():assert file.read_bytes()==temp.read_bytes()
                    else:os.link(temp,file);created.append((temp,file))
            except BaseException:
                for temp,file in created:
                    if file.exists() and file.stat().st_ino==temp.stat().st_ino:file.unlink()
                raise
    return rows
