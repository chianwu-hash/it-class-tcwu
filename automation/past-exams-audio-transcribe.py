"""不提供目標提示的本機語音回辨；結果須另判讀，不能當教師聽審。"""
import json,re,difflib,os
from pathlib import Path
from faster_whisper import WhisperModel
ROOT=Path(os.environ.get('PAST_AUDIO_ROOT','automation/output/past-exams-audio'));assert ROOT.as_posix() in ['automation/output/past-exams-audio','automation/output/past-exams-adapted-listening-20261101'];manifest=json.loads((ROOT/'audio-manifest.private.json').read_text(encoding='utf-8'));plan=json.loads((ROOT/'plan.private.json').read_text(encoding='utf-8'));tracks={t['id']:t for t in plan['tracks']}
model=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=4,local_files_only=True)
norm=lambda t:re.sub(r'[^a-z0-9]+',' ',t.lower().replace('’',"'")).split()
results=[]
for row in manifest:
 segments,info=model.transcribe(row['file'],language='en',beam_size=5,condition_on_previous_text=False,vad_filter=False,temperature=0)
 segs=list(segments);actual=' '.join(s.text.strip() for s in segs);t=tracks[row['id']];expected=' '.join(s['text'] for s in t['segments']);expected=' '.join([expected]*t['repeat'])
 ratio=difflib.SequenceMatcher(None,norm(expected),norm(actual)).ratio()
 results.append({'id':row['id'],'sha256':row['sha256'],'expected':expected,'transcription':actual,'similarity':round(ratio,4),'logProbability':round(sum(s.avg_logprob for s in segs)/len(segs),4) if segs else None,'needsReview':ratio<.82})
 (ROOT/'asr.private.json').write_text(json.dumps({'model':'faster-whisper-small, CPU int8, no initial_prompt','results':results,'complete':len(results)==len(manifest)},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print(row['id'],round(ratio,3),flush=True)
