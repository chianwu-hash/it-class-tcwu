"""正式核對過後記錄新授權與發布結果；沿用同記憶鍵。"""
from pathlib import Path
import json,hashlib,shutil,subprocess,sys
from datetime import datetime,timezone
R=Path('automation/output/past-exams-adapted-listening-20261101');P=Path('.chat-mode/adapted-listening-20261101');read=lambda p:json.loads(Path(p).read_text(encoding='utf-8-sig'));save=lambda p,v:Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
live=read(R/'cloud/live-data.private.json');gate=read(R/'cloud/release-ready.private.json');assert live['passed'] and live['versions']==49 and live['open']==20 and live['closed']==10 and gate['passed']
assert read(R/'cloud/activated.private.json')['studentDataUnchanged'];assert gate['restoredOriginalFields']==26
for n in ['source-manifest.json','raw-cards.json','DESIGN.md']:shutil.copyfile(P/n,R/n)
for n in ['run.json','response.md']:shutil.copyfile(P/f'.chat-mode/sessions/adapted-listening-claude-20261101/turn-0003.{n}',R/f'claude-draw-review.private.{"json" if n.endswith("json") else "md"}')
rows=read(R/'candidates.private.json');registered=read(R/'cloud/registered.private.json');receipt={'at':read(R/'cloud/activated.private.json')['at'],'authority':'2026-11-01教師明確授權26個缺稿欄依原題/解答自行編稿、製播，標明改編版，討論驗證後上線。','edition':'改編聽力練習版，非官方稿或原音','items':[{**c,'version':registered['versions'][c['paperId']]} for c in rows],'remainingBlocked':0,'runtimeFiles':gate['unchangedLiveRuntime'],'realStoragePlayers':gate['realStoragePlayers']}
target=Path('automation/output/past-exams-review-20261030/applied-decisions/adapted-listening-20261101.private.json')
if '--retry-memory' in sys.argv or '--prepare-memory-pending' in sys.argv:assert target.exists() and read(target)==receipt
else:assert not target.exists();save(target,receipt);save(R/'applied-receipt.private.json',receipt)
def mem(args):
 r=subprocess.run(['nmem','--json','m',*args],capture_output=True,encoding='utf-8',creationflags=subprocess.CREATE_NO_WINDOW);assert r.returncode==0,r.stderr[:200];return json.loads(r.stdout)
mid='d1491e03-ff0c-4c9a-b096-255e22b831b2';before=None
if '--prepare-memory-pending' not in sys.argv:
 try:before=mem(['show',mid])['content'].replace('\r','');save(R/'memory-before.private.json',{'content':before})
 except Exception as exc:save(R/'memory-error.private.json',{'memoryId':mid,'error':str(exc),'at':datetime.now(timezone.utc).isoformat()})
note=f'''【2026-11-01新授權已完成：26題改編聽力上線】MEMKEY:考前練功坊-考古題前處理-cian請益。教師明確核准剩26個缺官方稿的三英欄位，依原題與解答自行編稿、製播、標明改編版，AI討論驗證後直接上線。這取代下文「本26欄缺完整稿一律暫停」限制；官方稿仍未提供，不可冒稱找回原稿或原音。其他AI自主複核、缺來源不得假稱官方、原題/官方raw/來源SHA保留規則不變。
113/114上期中三英各A5/C5/E3＝26原欄已恢復。A讀The letter is E等；C讀The word is map等；E讀The number is nine等，每段兩次、JennyNeural -12%，26段約289秒。114A1試卷②J/key②D、A2試卷①K/key①L仍保留矛盾，改編以試卷J/K、原官方選號②/①，不斷言哪份誤植。學生每組明示改編/非官方，新作答標題含改編聽力。
E原4分未分列，經三方同意明示改編選圖2+拼字2，32個線上欄、恢復總64分（每卷32）不變；原id留拼字、-picture新id選圖，兩張原圖1左2右，選圖收1/①/左/左圖等、字收小寫/首大寫/全大寫，數字不算英文拼字。原26條ledger與4分記錄另存。每卷自動90分、原manual自核10分不變，52/90不過、54/90恰60%通過。
Claude session adapted-listening-claude-20261101三輪106/18/19秒成功，首輪實看4原頁26稿，二輪修E句，三輪討論QA定位；AGY adapted-listening-agy-20261101單輪37秒供給文字成功。viewer/Git/canary均驗，AGY未看圖未上網。原件包HEAD1d5e5831e0166bbd4119e4e9324e400f7079ead4。初版裸Six被無提示Whisper small辨為sex，未亂正規化；E全改The number is...後26段內容過，數字字形正常化，兩遍波形相關最低.999778、解碼/音量/SHA過，非真人聽審。12必要原圖用embedded+smask+仿射白底，頁clip鄰題線稿未發。
正式新註冊2版並啟用，47舊版與其他28卷/函式hash保留，現49版、20期中開10期末未開。全體blocked由26降0，officialScriptAvailable仍為false，改編音軌origin=adapted。35新私有物件上傳下載SHA過；兩卷本機真SQL逐題/合法與錯答/圖字部分分/52及54邊界/舊版鎖定/歷次跨版一葉過。正式來源合成auth+本機SQL全題組1280/390/360、教師/重試/畫圖等過；真私有Storage {gate['realStoragePlayers']}個播放器實播暫停重播過。正式PG兩卷各新錯→對→對+舊版完成8暫時作答全rollback，新增音圖quiz_media_access逐件owner/path/mime過，九表摘要一致；register/activate亦守九表。未動正式學生持久作答、成績/進度/葉。
114既有manual QA曾落點y1008在900 viewport外，盲等canvas scroll未解；改fixture先summary置中/命中、真click、確認details.open，再canvas命中後真鼠標畫/復原過。未改產品，不能把footer必然攔截當證實根因；成功座標/展開/scrollHeight/底部列資料與失敗照保留。不是實體手機或真人OAuth驗證。
不需前端部署，沿用當時正式介面，{gate['unchangedLiveRuntime']}執行檔SHA核對不變；無SQL/RLS/Edge修改。證據ignored automation/output/past-exams-adapted-listening-20261101、原稿/改編稿/音圖manifest/初稿/ASR/預覽/所有QC；applied-decisions/adapted-listening-20261101.private.json對應兩卷新版本，舊審閱頁/匯出/草稿未覆寫。詳docs/development/past-exams-adapted-listening-20261101.md及playbook/agent-handoff。不要重跑plan/build/inspect/register/activate/finish，clone不含ignored來源與產物。

下文是先前歷史，47版本/26暫停數字已由本次49版本/0暫停取代。

'''
if before is None:
 save(R/'memory-pending.private.json',{'memoryId':mid,'key':'考前練功坊-考古題前處理-cian請益','status':'pending-remote-dns','contentPrefix':note,'preserveExistingHistory':True});print('正式發布與收據已完成；遠端記憶DNS無法解析，待同步前綴已保存在本機。');sys.exit(0)
if '--retry-memory' in sys.argv and not before.startswith('【2026-11-01完成：AI自主疑義審定、四卷已發布】'):
 save(R/'memory-pending.private.json',{'memoryId':mid,'key':'考前練功坊-考古題前處理-cian請益','status':'needs-merge-with-newer-memory','contentPrefix':note,'preserveExistingHistory':True});print('記憶已有其他新內容，先合併待同步紀錄，不以舊發布狀態蓋回。');sys.exit(0)
after=note+before;mem(['update',mid,'-c',after]);assert mem(['show',mid])['content'].replace('\r','')==after;save(R/'memory-release.private.json',{'memoryId':mid,'verified':True,'contentSha256':hashlib.sha256(after.encode()).hexdigest()});print('改編聽力正式收據與同MEMKEY已更新、讀回驗證完成。')
