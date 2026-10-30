"""準備Claude唯讀來源包，不變更題庫或教師原審閱頁。"""
from pathlib import Path
import json,shutil,hashlib,subprocess
base=Path('automation/output/past-exams-review-20261030');packet=Path('.chat-mode/pending-review-20261030');packet.mkdir(exist_ok=False)
read=lambda p:json.loads(Path(p).read_text(encoding='utf-8-sig'))
data=read(base/'review-data-audio-update.private.json');cards=[c for c in data['cards'] if c['category']!='校對歷程' and c['id']!='P04']
assert len(cards)==50
paths=set()
for c in cards:
 for p in c['pages']:paths.update([p['image'],p['pdf'].split('#')[0]])
 for q in c['questions']:
  for i in q['images']:paths.add(i['image'])
  for choice in q['choices']:paths.update(choice['images'])
manifest={}
for rel in sorted(paths):
 src=base/rel;target=packet/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,target);manifest[rel]=hashlib.sha256(target.read_bytes()).hexdigest()
(packet/'cases').mkdir()
for c in cards:
 rows=[f'# {c["id"]}｜{c["paper"]}',f'類型：{c["category"]}',f'題目ID：{", ".join(c["questionIds"])}',f'原審閱快照內容SHA：{c["bundleSha256"]}','## 原先疑義（需獨立核對，不代表正確）',c['reason'],'## 已轉錄原題與官方答案']
 for q in c['questions']:
  rows += ['### '+q['group'],'共同材料：'+q['material'],'題幹：'+q['prompt']]
  for f in q['fields']:rows += [f'欄位 {f["id"]}｜{f["points"]}分｜試卷頁{f["paperPage"]}／解答頁{f["keyPage"]}',f['text'],'官方可見記號：'+f['raw'],'參考答案：'+f['reference']]
  rows += ['選項與圖：',json.dumps({'choices':q['choices'],'images':q['images']},ensure_ascii=False)]
 rows += ['## 原頁影像與PDF（需實際查看，請逐列明記查閱）']
 for p in c['pages']:rows += [f'{p["role"]}第{p["page"]}頁：{p["image"]}；PDF：{p["pdf"]}']
 (packet/'cases'/f'{c["id"]}.md').write_text('\n\n'.join(rows)+'\n',encoding='utf-8')
(packet/'cards.json').write_text(json.dumps(cards,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(packet/'source-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(packet/'INDEX.md').write_text('# 考古題疑義第二輪複核來源包\n\n僅討論與提出建議，未授權變更題庫或上線。P04已由教師核准②並上線，不再覆核。現有暫停40欄＝13個P類＋27個A類（A02與C07重疊）；C22卡與R12卡是其他覆核／開放參考，不是另外的暫停欄。原稿／官方答案與AI推論要明確分開；缺錄音文字時不可從答案猜造官方稿。官方錯誤可依常識與算式提出更正建議，但仍待教師確認。\n\n'+ '\n'.join(f'- {c["id"]}：cases/{c["id"]}.md｜{c["paper"]}｜{c["category"]}' for c in cards)+'\n',encoding='utf-8')
(packet/'.gitignore').write_text('.chat-mode/\n',encoding='utf-8')
subprocess.run(['git','init','-b','review/pending-20261030',str(packet)],check=True,capture_output=True)
subprocess.run(['git','-C',str(packet),'add','.'],check=True,capture_output=True)
subprocess.run(['git','-C',str(packet),'commit','-m','凍結40個暫停欄與其他覆核來源供唯讀討論'],check=True,capture_output=True)
print(json.dumps({'packet':str(packet.resolve()),'cards':len(cards),'sourceFiles':len(manifest),'head':subprocess.check_output(['git','-C',str(packet),'rev-parse','HEAD'],text=True).strip()}))
