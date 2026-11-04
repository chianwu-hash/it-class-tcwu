"""在註冊前保留初稿，統一E自然短句並重建待驗候選。"""
from pathlib import Path
import json,shutil
R=Path('automation/output/past-exams-adapted-listening-20261101');P=Path('.chat-mode/adapted-listening-20261101');read=lambda p:json.loads(Path(p).read_text(encoding='utf-8-sig'));save=lambda p,v:Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
run=read(P/'.chat-mode/sessions/adapted-listening-claude-20261101/turn-0002.run.json');assert run['status']=='completed';assert not (R/'cloud/registered.private.json').exists()
draft=R/'draft-bare-numbers';assert not draft.exists();draft.mkdir()
for name in ['audio-manifest.private.json','asr.private.json','candidates.private.json','local-qc.private.json','plan.private.json','script-proposals.private.json']:shutil.copyfile(R/name,draft/name)
for year in [113,114]:
 pid=f'dingxi-{year}-1-g3-exam1-english';(draft/pid).mkdir();shutil.copyfile(R/pid/'bundle.private.json',draft/pid/'bundle.private.json');shutil.copytree(R/pid/'audio',draft/pid/'audio')
rows=read(R/'script-proposals.private.json')
for p in rows:
 if p['section']=='E':p['script']='The number is '+p['target']+'.'
save(R/'script-proposals.private.json',rows);(R/'candidates.private.json').rename(R/'candidates-bare-numbers.private.json')
for f in ['run.json','response.md']:shutil.copyfile(P/f'.chat-mode/sessions/adapted-listening-claude-20261101/turn-0002.{f}',R/f'claude-number-review.private.{"json" if f.endswith("json") else "md"}')
print('初稿已保留；6段E改自然短句，需重製、重建、重驗。')
