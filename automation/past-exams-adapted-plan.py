"""依新授權準備改編稿，官方原稿缺失的事實與官方raw仍保留。"""
from pathlib import Path
import json,shutil,hashlib,subprocess
R=Path('automation/output/past-exams-adapted-listening-20261101');R.mkdir(exist_ok=True)
P=Path('.chat-mode/adapted-listening-20261101');assert not P.exists(),'Immutable packet'
P.mkdir();read=lambda p:json.loads(Path(p).read_text(encoding='utf-8-sig'));save=lambda p,v:Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
cards=[c for c in read('.chat-mode/auto-review-20261101/raw-cards.json') if c['id'] in ['A01','A03']];save(P/'raw-cards.json',cards)
manifest={};proposals=[]
for c in cards:
 pid=c['paperId'];year=int(pid.split('-')[1]);folder=R/pid;folder.mkdir(exist_ok=True);old=read(f'automation/output/past-exams-audio/{pid}/bundle.private.json');save(folder/'before-bundle.private.json',old);shutil.copyfile(f'automation/output/past-exams-audio/{pid}/source-pages.private.json',folder/'source-pages.private.json')
 for role in ['paper','key']:
  rel=f'pages/{pid}/{role}-001.jpg';out=P/rel;out.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(Path('.chat-mode/auto-review-20261101')/rel,out);manifest[rel]=hashlib.sha256(out.read_bytes()).hexdigest()
 letters=['E','C','d','k','o'] if year==113 else ['J','K','b','i','f'];words=['map','dot','get','bag','lip'] if year==113 else ['dig','cab','get','hot','bag'];numbers=['nine','eight','six'] if year==113 else ['seven','ten','three']
 for i,q in enumerate(c['questions']):
  f=q['fields'][0];section='A' if i<5 else 'C' if i<10 else 'E';n=i+1 if i<5 else i-4 if i<10 else i-9
  value=letters[n-1] if section=='A' else words[n-1] if section=='C' else numbers[n-1]
  text=f'The letter is {value.upper()}.' if section=='A' else f'The word is {value}.' if section=='C' else f'{value.capitalize()}.'
  proposals.append({'paperId':pid,'id':f['id'],'section':section,'number':n,'original':f,'script':text,'target':value,'repeat':2,'voice':'en-US-JennyNeural','rate':'-12%','edition':'改編聽力練習版','officialScriptAvailable':False})
save(R/'script-proposals.private.json',proposals);save(P/'script-proposals.json',proposals);save(P/'source-manifest.json',manifest)
contract='''# 教師新授權與改編設計
教師已明確核准：剩26欄可依原題和答案自行編製聽力稿、製播，標明改編版；AI討論、驗證後上線，無需逐題人工簽核。不能宣稱復原官方錄音／官方完整稿；官方raw／原題／來源SHA保留。
範圍僅113/114上期中三年級英語A/C/E各13欄。依試卷選項與官方選號設計新練習，音檔不讀「答案第幾個」。114A1官方選號②，試卷②J而key印D；A2官方①，試卷①K而key印L。本改編版以試卷J/K製播，學生選號仍②/①，原矛盾留存，不判定哪份原件誤植。
A：字母名稱聽辨，The letter is E.等，每段兩次。選項保留原大小寫，僅音檔無法分大小寫，但每題無同字母大小寫重複，不影響唯一性。
C：讀完整單字而非直接說字首，學生在___ap等題補首音。113 map/dot/get/bag/lip，114 dig/cab/get/hot/bag，單字由官方選號和尾字母組成，明示新編而非猜官方稿。請檢查詞有效、字首音與選項、是否需更自然稿。
E：數字短聽辨，113 nine/eight/six；114 seven/ten/three。只讀數字單字兩次，無新增可能不合圖意的完整情境。維持原兩張圖片，113全左、114前兩右第三左，應核圖。
E線上呈現提案：用既有short多欄題型，每題兩格，第一格填圖片代號1或2（可收①②/左圖右圖），第二格拼英文數字；每格2分、每題4分。明示「改編配分：選圖2分、填字2分；原卷每題4分未分列」。不將這個2+2說成官方規準。新小圖欄ID是原id+'-picture'，原id留給拼字；原26欄轉32個線上欄位，總64分不變，原始26條ledger及官方4分獨立保存。好處不需新SQL/schema，也確實驗選圖與拼字；缺點選圖以填代號取代圈選且可部分給分，是明示改編。若會降低合理性請提出最小替代法；不要把圈圖動作直接刪掉，也不要將兩動作全靠拼字給4分。
所有新增題組學生可見「改編聽力練習版｜依原題及解答重新編製，非官方聽力稿或原音；每段兩次，可重播」。官方完整稿製播的既有B/D不改。新版本只給新作答／重作，舊歷次鎖版；60%完整單次、跨版一葉不變。
請獨立審核所有26條稿，特別指出字母發音、音素與選項、圖意、答案唯一性、E配分方案的問題。可以直接定案編輯問題，不把來源已缺的官方原句再交教師補。
'''
(P/'DESIGN.md').write_text(contract,encoding='utf-8');(P/'.gitignore').write_text('.chat-mode/\n',encoding='utf-8')
for args in [['init','-b','review/adapted-listening-20261101'],['add','.'],['commit','-m','Freeze 26 adapted listening proposals and original pages']]:subprocess.run(['git','-C',str(P),*args],check=True,capture_output=True)
head=subprocess.check_output(['git','-C',str(P),'rev-parse','HEAD'],text=True).strip();session='adapted-listening-claude-20261101';marker='CHAT_MOD_ADAPTED_LISTENING_CLAUDE_DONE'
header=f'''---
protocol: chat-mode/v2
session_id: {session}
turn_id: '0001'
orchestrator: codex
worker: claude
transport: claude-cli
intent: adapted-listening-review
mode: review
permission: read-only
authority: delegated
approval_policy: cli-supervised
edit_mode: dont-ask
repo_root: {P.resolve().as_posix()}
repo_branch: review/adapted-listening-20261101
repo_head: {head}
repo_upstream: ''
repo_upstream_head: ''
baseline_status: ''
write_scope: []
authorized_actions: [read-project, list-and-search-project]
authorized_commands: []
git_authority: read-only
network_authority: none
credential_authority: none
deployment_authority: none
external_paths: []
max_response_bytes: 30000
completion_marker: {marker}
---
'''
body='請先讀DESIGN.md、script-proposals.json及raw-cards.json，再實看4張paper/key原頁；不讀本包外檔案、不上網、不執行命令、不改檔、不另開agent。你是唯讀獨立複核，不需再詢問教師。回覆總2500繁體中文字以內：逐題差異/異議、4張實看圖路徑、26稿是否可採、E配分與ID決定，必要修改給確切替代稿，未核範圍明列。最後一行 '+marker+'。'
out=P/f'.chat-mode/exchange/{session}/turn-0001.request.md';out.parent.mkdir(parents=True);out.write_text(header+body,encoding='utf-8')
sid='adapted-listening-agy-20261101';marker='CHAT_MOD_ADAPTED_LISTENING_AGY_DONE';aheader=header.replace(session,sid).replace('worker: claude','worker: agy').replace('transport: claude-cli','transport: agy-cli').replace('mode: review','mode: discussion').replace('permission: read-only','permission: no-tools').replace('authorized_actions: [read-project, list-and-search-project]','authorized_actions: [discuss-supplied-text]').replace('CHAT_MOD_ADAPTED_LISTENING_CLAUDE_DONE',marker)
out=P/f'.chat-mode/exchange/{sid}/turn-0001.request.md';out.parent.mkdir(parents=True);out.write_text(aheader+'只討論供給文字，不用工具、不讀repo、不看圖、不上網、不另開agent。圖像描述由Codex實看提供，不能宣稱自己看過。請獨立審查以下設計與26稿，尤其E兩動作2+2是否合理，字首音是否有唯一解，J/D與K/L改編是否清楚；1500繁體中文字內給可實作裁決。\n'+contract+'\n'+json.dumps(proposals,ensure_ascii=False)+'\n最後一行 '+marker+'。',encoding='utf-8')
print(json.dumps({'packet':str(P),'head':head,'fields':len(proposals)}))
