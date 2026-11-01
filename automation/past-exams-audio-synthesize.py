"""依已核對的官方稿或明示改編計畫製播；來源類別由plan保留，快取與雜湊可重驗。"""
import asyncio,json,hashlib,subprocess,array,math,wave,os
from pathlib import Path
import edge_tts,imageio_ffmpeg
ROOT=Path(os.environ.get('PAST_AUDIO_ROOT','automation/output/past-exams-audio'));assert ROOT.as_posix() in ['automation/output/past-exams-audio','automation/output/past-exams-adapted-listening-20261101'];CACHE=ROOT/'speech-cache';CACHE.mkdir(exist_ok=True)
PLAN=json.loads((ROOT/'plan.private.json').read_text(encoding='utf-8'));FFMPEG=imageio_ffmpeg.get_ffmpeg_exe();SAMPLE=24000;sem=asyncio.Semaphore(2)
def sha(v):return hashlib.sha256(v).hexdigest()
def key(s,rate):return sha(json.dumps([s['text'],s['voice'],rate],ensure_ascii=False).encode())
async def speak(s,rate):
 p=CACHE/(key(s,rate)+'.mp3')
 if p.exists() and p.stat().st_size>500:return
 async with sem:
  for attempt in range(3):
   try:
    await edge_tts.Communicate(s['text'],s['voice'],rate=rate).save(str(p))
    assert p.stat().st_size>500
    print('SYNTH '+p.stem,flush=True);return
   except Exception:
    if p.exists():p.unlink()
    if attempt==2:raise
    await asyncio.sleep([2,8][attempt])
def ff(args,body=None):
 r=subprocess.run([FFMPEG,'-hide_banner','-loglevel','error',*args],input=body,capture_output=True);assert r.returncode==0,r.stderr.decode(errors='replace');return r.stdout
async def main():
 unique={(key(s,t['rate']),t['rate']):s for t in PLAN['tracks'] for s in t['segments']}
 await asyncio.gather(*(speak(s,rate) for (_,rate),s in unique.items()))
 manifest=[]
 for t in PLAN['tracks']:
  folder=ROOT/t['paperId']/'audio';folder.mkdir(exist_ok=True)
  silence=lambda seconds:b'\0'*round(seconds*SAMPLE)*2
  pieces=[ff(['-i',str(CACHE/(key(s,t['rate'])+'.mp3')),'-f','s16le','-ac','1','-ar',str(SAMPLE),'-'])+silence(s['gapAfter']) for s in t['segments']]
  segment=b''.join(pieces);pcm=silence(.5)+(segment+silence(t['repeatGap']))*t['repeat']+silence(.5)
  target=folder/(t['id'].split('__')[1]+'.mp3')
  ff(['-y','-f','s16le','-ar',str(SAMPLE),'-ac','1','-i','-','-codec:a','libmp3lame','-b:a','96k',str(target)],pcm)
  decoded=ff(['-i',str(target),'-f','s16le','-ac','1','-ar',str(SAMPLE),'-'])
  samples=array.array('h',decoded);duration=len(samples)/SAMPLE;peak=max(abs(x) for x in samples);rms=math.sqrt(sum(x*x for x in samples)/len(samples))
  assert duration>2 and rms>50 and peak<32767 and target.stat().st_size<8388608
  manifest.append({'id':t['id'],'paperId':t['paperId'],'file':str(target.resolve()),'sha256':sha(target.read_bytes()),'bytes':target.stat().st_size,'mime':'audio/mpeg','durationSeconds':round(duration,3),'sampleRate':SAMPLE,'channels':1,'peak':peak,'rms':round(rms,1),'scriptSha256':sha(json.dumps(t,ensure_ascii=False,separators=(',',':')).encode()),'source':t['source'],'voices':sorted(set(s['voice'] for s in t['segments'])),'rate':t['rate'],'repeat':t['repeat'],'generation':'edge-tts '+edge_tts.__version__,'validation':'FFmpeg解碼、非靜音、無PCM削波；尚待語音回辨及網站播放驗收'})
 (ROOT/'audio-manifest.private.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(json.dumps({'tracks':len(manifest),'seconds':round(sum(m['durationSeconds'] for m in manifest),1),'uniquePhrases':len(unique)}),flush=True)
asyncio.run(main())
