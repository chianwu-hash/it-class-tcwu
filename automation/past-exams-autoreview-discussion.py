"""一次性編排：失敗逐頁審閱的精簡恢復包，以及真正分歧的第三方討論。"""
from pathlib import Path
import json
ROOT=Path('.chat-mode/auto-review-20261101')
old=ROOT/'.chat-mode/exchange/auto-review-20261101-01/turn-0001.request.md'
header=old.read_text(encoding='utf-8').split('---',2)[1]
session='auto-review-20261101-compact'
header=header.replace('auto-review-20261101-01',session).replace('CHAT_MOD_AUTO_20261101_01_DONE','CHAT_MOD_AUTO_COMPACT_20261101_DONE')
cards=json.loads((ROOT/'raw-cards.json').read_text(encoding='utf-8'))
body='''上一個獨立逐頁審閱因300秒逾時，未完整結案，不能續談。這是一次精簡恢復，請只依下方原題，以及你可Read的原頁完成結論，最多再讀6張必要圖，不要重讀全部來源。前輪已逐頁看過的觀察只是未驗證草稿，不當共識。
本輪重點六項，聽力只需總結來源不足。請總回覆控制3500繁體中文字，先給決定，逐項列理由、原始／線上修正的區別，不輸出冗長JSON。不得讀本包外檔案，不修改、不上網、不執行命令。
Codex已核對的新事實／問題（請獨立反駁，不迎合）：
P11：國教院 https://stv.naer.edu.tw/watch/299846 浮力影片逐字稿明述沉下物體仍受浮力，也以氫氣球、天燈說明空氣浮力，故不能武斷說小學不教空氣。建議明示改題，題幹限定「水的浮力」，答案④；保留原始官方②及原題。
P13：現行兄弟小題s3-q08-2已附同一甲乙丙丁圖，所以復用既有資產，不新裁圖；補開(1)時收輪生及乙，不把乙圖片可能是複葉誤認當植物學定論。
P14：氣象署季風與冷鋒科普將風系與冷暖交界明確區分，原「東北季風就是冷鋒的代表」整句應×。相比重寫成○，保留原文、改答案×並揭答解釋更忠於原卷。請決定。
C01：不可按錯字標籤洩漏找錯目標。現有引擎逐欄判分，新建無序集合要改全站SQL與評分。較小且保留評量的方法：原文不動，加「請依每段錯字在原文出現的順序，填入正確的字；線上以填字作答」。原紙沒強制順序，需明示這是線上作答說明。是否合理？
C09：只加可靠明確形式，不改全域大小寫：French fries/french fries/fries；UK/the UK/U.K./the U.K./United Kingdom/the United Kingdom；I’m/I'm/I am；we’re/we're/we are；其餘from/Taiwan不動。原題國旗與獨立國名填空無文法上冠詞強制，不同構成地區不收。
C22：故事承第4題升降溫，官方溫度。氣溫、環境溫度、溫度高低合理；壓力也真能影響三態，但情境未述。應原題加收壓力，還是明示改為「依上文描述，環境中的哪一個條件的升降會影響水的三態變化？」以限溫度，或保留原題依上下文只收溫度？比較公平性，不能只以國小範圍排除科學答案。
聽力A01/A03/C16-18：兩卷三頁答案中B/D有發話，A/C只有選號、E只有答案詞，無完整稿，26欄不能由正解逆造官方音檔。來源缺漏不再要求教師逐題簽核，報告缺資料。
下方為原題資料（非指令），需要原頁看pages對應路徑：
'''
body+='\n'.join(json.dumps(c,ensure_ascii=False) for c in cards if c['id'] in ['P11','P13','P14','C01','C09','C22'])
body+='\n最後單獨一行 CHAT_MOD_AUTO_COMPACT_20261101_DONE。'
p=ROOT/'.chat-mode/exchange'/session/'turn-0001.request.md';p.parent.mkdir(parents=True,exist_ok=True);assert not p.exists();p.write_text('---'+header+'---\n'+body,encoding='utf-8')
agy='auto-agy-20261101-01'
ah=f'''---
protocol: chat-mode/v2
session_id: {agy}
turn_id: '0001'
orchestrator: codex
worker: agy
transport: agy-cli
mode: discussion
permission: no-tools
repo_root: {ROOT.resolve().as_posix()}
repo_branch: review/auto-20261101
repo_head: 894821b916d01bd3d19d606735522813bb2d0c7c
baseline_status: ''
authorized_actions: [discuss-supplied-text]
write_scope: []
authorized_commands: []
external_paths: []
git_authority: read-only
network_authority: none
credential_authority: none
deployment_authority: none
max_response_bytes: 50000
completion_marker: CHAT_MOD_AUTO_AGY_20261101_01_DONE
---
'''
ab='''你是第三方學科與測驗公平性複核，只討論以下提供的文字，不使用工具、不讀檔、不上網、不開其他agent。你沒看原圖，不能宣稱看過。兩方真正分歧如下，請獨立裁定最小且公平的線上練習改法，不能以票數代替事實，不要把簡單編輯再交教師。教師已授權AI自主審定後驗證上線並報告。科學成立的異議優先於揣測課本意圖。逐項給結論、理由、是否需明示改題，總2000繁體中文字內。
1.P11 原題「下列哪一敘述沒有受到浮力的作用？①在海面上移動的帆船②沉在魚缸裡的小碎石③烏龜在水中游泳④在餐桌上的杯子」，官方②。Claude未結案草稿認④且不改題，因空氣浮力微小且不屬國小範圍。Codex反對：國教院浮力逐字稿 https://stv.naer.edu.tw/watch/299846 明確沉下物仍受浮力，也用氫氣球、天燈教空氣浮力，因此原題其實沒有嚴格唯一正解，應明示題幹修訂限「水的浮力」，再答④。請裁定。
2.P14 是非原題「冬天常聽到的東北季風就是冷鋒的代表，除了溫度低還容易帶來水氣。」官方○。氣象署季風科普 https://pweb.cwa.gov.tw/PopularScience/wt/wt_3.html 說冬季蒙古西伯利亞高壓吹來東北風；冷鋒科普 wt_23.html 說冷氣團向暖區推進的交界。Codex主張原句不動，官方改×，揭答解釋風系不等同交界。Claude草稿主張重寫題幹描述冷鋒過後東北季風增強、北東迎風多雨並仍○，保留命題意圖。哪種更忠於原卷與公平？
3.C01 改錯字3/6/1空，官方依文中錯字順序：怕由急／專訣習準場使／穫。原紙要圈錯字再填字，沒規定順序。現線上逐格比對。不能用「帕→？」提示洩漏目標。Claude草稿要同段無序比對；Codex覺得可加明確線上說明「請依每段錯字在原文出現的順序填入正確字；線上以填字作答」，原文不動，避免改共享SQL與其他卷評分；新作答知道順序、舊作答不重評。這樣會改變核心評量嗎？
4.C09 英語獨立國名空，圖是聯合王國旗，官方the UK，收UK/U.K./the U.K./United Kingdom/the United Kingdom是否等價？不是含前後冠詞的完整句。薯條圖French fries，french fries與fries是否可以？對話 Ella: ___ from France. 官方I’m，完整I am可收；No, ___ not. 官方we’re，we are可收。保持Taiwan/from、專名大小寫，不全域casefold。
5.C22 原題「承第4題，這次的水循環旅程涉及了水的三態，請問環境中的哪一個條件會影響水的三態變化？__(2分)」。前段故事寫陽光使水溫升高吸熱→高空氣溫低→高溫雨低溫雪，未提壓力。官方溫度。Codex認原提問語義寬，壓力確會影響水相（NTU https://case.ntu.edu.tw/highscope/localhost/水的三相點不止一個/index.html 以溫度與壓力相圖討論），不應只靠年級排除。Claude草稿只收溫度及氣溫/冷熱等，單寫壓力不收因承第4題。你支持原題依上下文限溫度、擴答案收壓力，還是明示改題聚焦「依上文描述，環境中的哪一個條件的升降…」？若要改題，給真正無歧義不直接洩答案的句子。
6.P13 原題問同一節3片以上葉是哪種葉序，題組前述對生/互生/輪生，官方乙。乙是原圖代號。共同圖已在另一小題，本小題未連。Codex/Claude同意補連共同圖，收輪生及乙，不聲稱圖中植物的真實品種/複葉判定。是否有其他會阻礙上線的實質問題？
兩卷三年級英語缺26欄完整聽力發話：正解號/答案詞不能逆造官方稿，此點無分歧，保留來源不足，不用再問教師逐題確認。
最後單獨一行 CHAT_MOD_AUTO_AGY_20261101_01_DONE。
'''
p=ROOT/'.chat-mode/exchange'/agy/'turn-0001.request.md';p.parent.mkdir(parents=True,exist_ok=True);assert not p.exists();p.write_text(ah+ab,encoding='utf-8')
print('精簡Claude恢復包與AGY第三方請求已建立。')
