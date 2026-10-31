"""僅為教師核准C07產出一段合成聽力與三張必要選項圖。"""
import asyncio, array, hashlib, json, math, subprocess, io
from pathlib import Path
import edge_tts, imageio_ffmpeg, pymupdf

ROOT=Path('automation/output/past-exams-approved11-20261031')
ROOT.mkdir(exist_ok=True)
read=lambda p:json.loads(Path(p).read_text(encoding='utf-8-sig'))
sha=lambda b:hashlib.sha256(b).hexdigest()
sources=read('automation/output/past-exams-audio/dingxi-113-1-g6-exam1-english/source-pages.private.json')['sources']
for s in sources.values():
    assert sha(Path(s['original']).read_bytes())==s['originalSha256']
    assert sha(Path(s['pdf']).read_bytes())==s['pdfSha256']
script="Look! There’s a dolphin."
assert script in sources['key']['pages'][4]['text']
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
def ff(args,body=None):
    r=subprocess.run([ffmpeg,'-hide_banner','-loglevel','error',*args],input=body,capture_output=True)
    assert r.returncode==0,r.stderr.decode(errors='replace')
    return r.stdout
async def main():
    target=ROOT/'C07.mp3'
    if not target.exists():
        phrase=ROOT/'C07-phrase.mp3'
        await edge_tts.Communicate(script,'en-US-JennyNeural',rate='-12%').save(str(phrase))
        pcm=ff(['-i',str(phrase),'-f','s16le','-ac','1','-ar','24000','-'])
        silence=lambda seconds:b'\0'*round(seconds*24000)*2
        body=silence(.5)+(pcm+silence(2))*2+silence(.5)
        ff(['-y','-f','s16le','-ar','24000','-ac','1','-i','-','-codec:a','libmp3lame','-b:a','96k',str(target)],body)
    pcm=ff(['-i',str(target),'-f','s16le','-ac','1','-ar','24000','-'])
    values=array.array('h',pcm);rms=math.sqrt(sum(x*x for x in values)/len(values));peak=max(abs(x) for x in values)
    assert rms>50 and peak<32767 and len(values)/24000>4
    # 不提示目標內容的離線回辨；不是真人聽審。
    from faster_whisper import WhisperModel
    model=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=4,local_files_only=True)
    segments,_=model.transcribe(str(target),language='en',beam_size=5,condition_on_previous_text=False,temperature=0)
    transcript=' '.join(s.text.strip() for s in segments)
    # Whisper可能合併完全相同的重複句，兩段分開回辨，避免誤認只播一次。
    half=(len(values)/24000-1)/2
    repetitions=[]
    for i in range(2):
        clip=ROOT/f'C07-repeat{i+1}.wav'
        ff(['-y','-ss',str(.5+i*half),'-t',str(half),'-i',str(target),'-ac','1','-ar','24000',str(clip)])
        result,_=model.transcribe(str(clip),language='en',beam_size=5,condition_on_previous_text=False,temperature=0)
        words=' '.join(s.text.strip() for s in result)
        assert 'dolphin' in words.lower() and 'look' in words.lower(),words
        repetitions.append(words)
    images=[]
    doc=pymupdf.open(sources['paper']['pdf']);page=doc[0]
    candidates=[]
    for image in page.get_images():
        for box in page.get_image_rects(image[0]):
            if 470<box.y0<500 and box.y1<532 and 110<box.x0<400:candidates.append((box.x0,image[0],box))
    assert len(candidates)==3,[(x[0],x[1]) for x in candidates]
    for i,(_,xref,box) in enumerate(sorted(candidates),1):
        # 使用原嵌入圖，不能連同其範圍內相鄰題的線條一起重繪。
        from PIL import Image
        base=pymupdf.Pixmap(doc,xref)
        smask=next(image[1] for image in page.get_images() if image[0]==xref)
        pix=pymupdf.Pixmap(pymupdf.Pixmap(base,0),pymupdf.Pixmap(doc,smask)) if smask else base
        im=Image.open(io.BytesIO(pix.tobytes('png'))).convert('RGBA')
        # 原卷可能以仿射矩陣旋轉嵌入圖；保留原方向，並排除同範圍鄰題。
        _,matrix=page.get_image_rects(xref,transform=True)[0];inv=~matrix;scale=300/72
        a,b,c,d,e,f=tuple(inv);w,h=im.size
        coefficients=(a*w/scale,c*w/scale,(a*box.x0+c*box.y0+e)*w,b*h/scale,d*h/scale,(b*box.x0+d*box.y0+f)*h)
        transformed=im.transform((math.ceil(box.width*scale),math.ceil(box.height*scale)),Image.Transform.AFFINE,coefficients,Image.Resampling.BICUBIC)
        white=Image.new('RGBA',transformed.size,'white');white.alpha_composite(transformed)
        buffer=io.BytesIO();white.convert('RGB').save(buffer,format='PNG');raw=buffer.getvalue()
        file=ROOT/f'C07-option{i}-{sha(raw)}.png';file.write_bytes(raw)
        images.append({'choice':str(i),'file':str(file.resolve()),'hash':sha(raw),'mime':'image/png','bytes':len(raw),'sourcePage':1,'sourceSha256':sources['paper']['pdfSha256'],'imageXref':xref,'bbox':list(box),'transform':list(matrix),'smask':smask})
    manifest={'audio':{'file':str(target.resolve()),'hash':sha(target.read_bytes()),'mime':'audio/mpeg','bytes':target.stat().st_size,'seconds':len(values)/24000,'rms':rms,'peak':peak,'script':script,'scriptSha256':sha(script.encode()),'sourcePage':5,'sourceSha256':sources['key']['pdfSha256'],'voice':'en-US-JennyNeural','rate':'-12%','repeat':2,'transcription':transcript,'perRepeatTranscriptions':repetitions,'validation':'FFmpeg解碼、音量、無削波、Whisper small離線無提示逐段回辨；非真人聽審'},'images':images}
    (ROOT/'media.private.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'seconds':manifest['audio']['seconds'],'transcription':transcript,'images':len(images)}))
asyncio.run(main())
