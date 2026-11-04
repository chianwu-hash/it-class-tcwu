"""新詞典證據修正三方初稿：保留已註冊但未啟用的候選，不覆寫雲端版本。"""
from pathlib import Path
import json,sys,hashlib,shutil
R=Path('automation/output/past-exams-autoreview-20261101');P=Path('.chat-mode/auto-review-20261101');sid='auto-agy-20261101-01'
read=lambda p:json.loads(Path(p).read_text(encoding='utf-8-sig'))
save=lambda p,v:Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
if sys.argv[1]=='ask':
 old=P/f'.chat-mode/exchange/{sid}/turn-0001.request.md';header=old.read_text(encoding='utf-8').split('---',2)[1].replace("turn_id: '0001'","turn_id: '0002'").replace('CHAT_MOD_AUTO_AGY_20261101_01_DONE','CHAT_MOD_AUTO_AGY_20261101_02_DONE')
 body='''只討論下列新證據，不使用任何工具。前輪C09你和Claude都主張chips不收，因美式意指洋芋片。我Codex在上線前反證發現這個理由可能不公平。劍橋英英詞典自己的French fries詞條 https://dictionary.cambridge.org/dictionary/essential-british-english/french-fries 明列英式用chips；Oxford Advanced Learner fry名詞詞條 https://www.oxfordlearnersdictionaries.com/us/definition/english/fry_2 也將fries/French fry與British English usually chip對照。原E題指示只有Look and Write看圖拼寫食物單字；圖是薯條，沒有明文限美式英語、指定字首、字數或字庫。圖片在世界地圖美國位置，但那是食物位置，不等於必須用美式單字。Codex認為圖已消除chips的多義，應加收英式chips，不收crisps、potato chips、French fires。請反駁或明確撤回先前排除chips的建議，300繁體中文字內。你的角色只討論供給文字，沒有看原圖也沒上網。最後一行 CHAT_MOD_AUTO_AGY_20261101_02_DONE。'''
 out=old.with_name('turn-0002.request.md');assert not out.exists();out.write_text('---'+header+'---\n'+body,encoding='utf-8')
else:
 assert sys.argv[1]=='build';run=read(P/f'.chat-mode/sessions/{sid}/turn-0002.run.json');assert run['status']=='completed' and run['toolBoundaryVerified'];assert not (R/'cloud/activated.private.json').exists()
 pid='dingxi-113-1-g6-exam1-english';file=R/pid/'bundle.private.json';b=read(file);assert not (R/'chips-revision.private.json').exists();shutil.copyfile(file,file.with_name('registered-candidate-v1.private.json'))
 for n in ['candidates.private.json','adjudication.private.json','local-qc.private.json']:shutil.copyfile(R/n,R/('pre-chips-'+n))
 g=next(g for g in b['document']['groups'] if g['id']=='s5-q01');assert 'chips' not in g['fields'][0]['answer'];g['fields'][0]['answer'].append('chips')
 response=P/f'.chat-mode/sessions/{sid}/turn-0002.response.md';note={'date':'2026-11-01','action':'add-British-equivalent-chips','reason':'原題未限美式英語，薯條圖已消除多義，英式chips應給分；撤回先前全體排除chips的初稿。','source':'https://dictionary.cambridge.org/dictionary/essential-british-english/french-fries','reviewResponseSha256':hashlib.sha256(response.read_bytes()).hexdigest()};b['provenance']['editorialRevisions'].append(note);b['provenance']['entries'][next(i for i,e in enumerate(b['provenance']['entries']) if e['id']=='s5-q01')]['editorialDecision']['supplement']=note
 b['sha256']=hashlib.sha256(json.dumps(b['document'],ensure_ascii=False,separators=(',',':')).encode()).hexdigest();save(file,b)
 rows=read(R/'candidates.private.json');next(r for r in rows if r['paperId']==pid)['newSha256']=b['sha256'];save(R/'candidates.private.json',rows)
 save(R/'chips-revision.private.json',{'paperId':pid,'priorRegistered':read(R/'cloud/registered.private.json')['versions'][pid],'sha256':b['sha256'],'decision':note});shutil.copyfile(response,R/'agy-chips-response.private.md');save(R/'agy-chips-run.private.json',run)
 print(json.dumps({'revised':pid,'sha256':b['sha256']}))
