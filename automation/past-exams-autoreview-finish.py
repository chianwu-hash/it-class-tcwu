"""驗正式完成後才保存收據與沿用同MEMKEY；不修改舊教師審閱頁或匯出。"""
from pathlib import Path
import json,hashlib,shutil,subprocess
R=Path('automation/output/past-exams-autoreview-20261101');P=Path('.chat-mode/auto-review-20261101');read=lambda p:json.loads(Path(p).read_text(encoding='utf-8-sig'))
save=lambda p,v:Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2),encoding='utf-8')
live=read(R/'cloud/live-data.private.json');assert live['passed'] and live['versions']==47 and live['open']==20 and live['closed']==10
assert read(R/'runtime-live.private.json')['passed'] and read(R/'cloud/activated.private.json')['studentDataUnchanged']
for name in ['raw-cards.json','source-manifest.json']:shutil.copyfile(P/name,R/name)
shutil.copyfile(P/'.chat-mode/sessions/auto-review-20261101-01/turn-0001.run.json',R/'claude-first-timeout.private.json')
review=read('automation/output/past-exams-review-20261030/review-data-claude.private.json');rows=read(R/'candidates.private.json');registered=read(R/'cloud/registered.private.json')
receipt={'authority':'2026-11-01教師授權AI自主審定；非教師逐題簽核','at':read(R/'cloud/activated.private.json')['at'],'items':[],'missingSourceFields':26,'unusedVersion':registered['unusedCandidates']}
for c in rows:
 for rid in c['reviewIds']:
  source=next(x for x in review['cards'] if x['id']==rid);receipt['items'].append({'reviewId':rid,'paperId':c['paperId'],'reviewSnapshotBundleSha256':source['bundleSha256'],'baselineSha256':c['oldSha256'],'newSha256':c['newSha256'],'version':registered['versions'][c['paperId']]})
folder=Path('automation/output/past-exams-review-20261030/applied-decisions');folder.mkdir(exist_ok=True);target=folder/'autoreview-20261101.private.json';assert not target.exists();save(target,receipt);save(R/'applied-receipt.private.json',receipt)
def mem(args):
 r=subprocess.run(['nmem','--json','m',*args],capture_output=True,encoding='utf-8',creationflags=subprocess.CREATE_NO_WINDOW);assert r.returncode==0,r.stderr[:300];return json.loads(r.stdout)
mid='d1491e03-ff0c-4c9a-b096-255e22b831b2';before=mem(['show',mid])['content'].replace('\r','');save(R/'memory-before-release.private.json',{'content':before})
note='''【2026-11-01完成：AI自主疑義審定、四卷已發布】MEMKEY:考前練功坊-考古題前處理-cian請益。教師新政策永久取代下文「其餘等教師逐題確認」：Codex與Claude先獨立核來源與求解，真正分歧交AGY CLI第三方必要文字複核，能定案就驗證、上線並報告，不例行請教師簽核；缺完整來源列缺件保留阻擋，其餘持續。AI票數不等於官方證據，原題、官方raw、原頁SHA、推導及修訂保留，改題明示；學生manual/畫圖評量方式不變。
本輪6項：P11限定水的浮力答④；P13補接既有共同圖，收輪生/乙；P14原句東北季風=冷鋒改×；C01加段內原文順序填字說明不洩錯字；C09英語縮寫完整形式/國名等價，含french fries/fries/chips；C22明示按水循環上文情境問條件，收溫度/氣溫等，不將原寬泛題下的壓力說成科學錯。新增5自動分，3非聽力阻擋皆恢復；剩26欄僅兩卷三英A/C/E缺完整發話，不由正解倒造官方稿，不要求教師逐題確認。原15項維持現況、已核准11與P04不改。
Claude首輪300秒逾時為未驗證草稿，另新session auto-review-20261101-compact精簡恢復112秒6Read成功。AGY auto-agy-20261101-01實跑1.4.12/Gemini3.8FlashMedium，兩輪65+26秒，viewer/canary工具拒絕/Git不變均驗；AGY未看圖未讀repo未上網。chips初稿三方皆排除，Codex以Oxford/Cambridge反證，AGY第二輪明確撤回；不能把共識當正確。英語前候選未啟用仍保留，另增immutable版本。
正式已啟用4卷新版本，總47版本（原42+4初稿+1英語補充；1個未啟用候選保留），20期中開/10期末未開不變；舊版作答與歷次保留，重作採新版，跨版本只一葉。四卷真本機SQL變體接受/錯誤拒絕/舊版鎖定/完整0→1→1、一葉與歷次過，P04兩項回歸過；當前正式來源隔離auth+本機SQL全題組1280/390/360及教師預覽、英語20播放器過，英語補充後重驗。本次正式PG四卷新錯→對→對+舊版完成共16暫時作答全rollback、九表摘要一致；register/supplement/activate交易亦驗九表。無正式學生持久變更，沒有真人OAuth或實體手機宣稱。無新媒體、SQL/RLS/Edge變更。
介面核對答案取代官方記號，僅6個標籤/快取鏈檔。從當時最新正式dpl_7DQqnJPJDzyLCaF49T8qQR3sWsiH完整769來源SHA1核封存，保留最新question-reports與登入等功能。候選6檔、發布後319公開執行檔SHA全過；正式dpl_9K3cwM4PTNhTvAZrXYHQDTLLHQoF。不要用舊工作區整包部署。
證據ignored automation/output/past-exams-autoreview-20261101；原審閱HTML/Downloads/草稿未改，applied-decisions/autoreview-20261101.private.json對應6卡最新版本，不能舊快照整卷蓋回。詳細docs/development/past-exams-autoreview-20261101.md與playbook/agent-handoff。不要重跑build/inspect/register/supplement/activate/finish；clone不含ignored來源和產物。

以下保留先前歷史，日期更早的待教師政策及42/29數字已由本次47/26取代。

'''
after=note+before;mem(['update',mid,'-c',after]);assert mem(['show',mid])['content'].replace('\r','')==after;save(R/'memory-release.private.json',{'memoryId':mid,'verified':True,'contentSha256':hashlib.sha256(after.encode()).hexdigest()});print('正式收據與同MEMKEY更新、讀回驗證完成。')
