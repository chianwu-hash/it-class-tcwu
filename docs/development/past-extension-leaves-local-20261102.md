# 三上自然延伸葉與主動重點複習：本機試用（2026-11-02）

使用者已批准依[前次提案](past-extension-tree-proposal-20261102.md)做本機版，先試用，不發布、不動正式學生資料。本輪完成114上三年級期中自然的延伸認列、滿分主動複習與本機努力樹顯示；不表示其他卷已補配題或正式通用服務已完成。

## 本輪行為

- 每完成10道不同的書商延伸題取得1片延伸葉；答錯也認列。單題保存就可累積，不必湊整組；可跨日、跨卷累積，同題同學期首次才計。原卷的成績、歷次及60%達標葉保持獨立。
- 重練建立新session保留歷次，網路重送沿用request_id接同一session；相同題從不同原錯題、主動複習、重點或來源卷進入，不重複計。同組部分重複只認新增題。
- 本人原卷完整完成且已揭答後，可主動選22個重點、練同一池44道固定書商題；滿分學生也可使用。「我的錯題」仍只收本人已揭答錯答，不把正答、自核或未答塞入錯題。
- 兩種返程分開：錯題練習返回同次／同版／同欄；主動複習返回原作答的同一重點。重新整理可接回，登出／換人會清除私有內容與原身分連結。
- 延伸葉與原卷達標葉在本機樹同時呈現、分開標示；沿用既有樹圖片、葉片renderer、位置與樣式。超出可見葉片位置時分頁，不封頂或丟棄帳本；不產生魔王花。
- 顯示「完成練習」而非「已學會」。每題首次保存前最少2秒只擋瞬間送出，不證明理解；解析照常顯示，不做閱讀認證。學生操作只讀固定內容，不呼叫AI。
- 學期由服務的可信課程設定指定（本機115/1），不由來源試卷年份、舊作答或瀏覽器指定；分學期計數，歷史認列保留，零頭不跨學期。

## 實作與邊界

`automation/lib/past-extension-rewards.mjs`只在本機PGlite建立`past_extension_fixture` schema（session來源、view計時、逐題認列及葉片帳本）。認列只查實際`quiz_answers`，不接受client回報題數／葉數。唯一鍵為user＋學習學年學期＋題目內容識別，10題門檻另有ordinal唯一鍵；在交易內鎖使用者並對已保存答案補認列，重送與resume不重領。不改`student_progress`、正式獎勵SQL或原卷答案。

題目識別以書商／年級／科目／題型／共用材料／題幹／排序後選項內容歸一，不含session、來源卷、作答版本或選項ID順序；保留原始ID、ISO member、SHA供稽核。這次44題均為已複核文字題；不宣稱語意相近題、圖／聽力、跨書商改寫或通用勘誤ID管理已完成。正式化前仍須固定ID及撤回／勘誤流程。

`past-publisher-practice.mjs`沿用真正schema1作答引擎，保留classroom模式、`awardEligible:false`，新增獨立`extensionEligible`與帳本認列，不藉切換普通練習模式繞過既有獎勵規則。主動複習需本人、正確版本、完整完成；錯題模式仍要求correct=false。伺服器禁止只開延伸而未開錯題模式的配置。

新UI為`shared/past-extension-preview.mjs/css`，只由opt-in本機HTML注入；正式課程HTML沒有新增引用。`quiz-student.mjs`僅新增loopback＋本機meta保護的主動複習返程分支。navbar與登入／登出沿用共用模組，不綁自製auth，不存localStorage進度。

本機合成auth、nonce及圖片byte入口不是正式安全邊界，不可把fixture部署成正式服務。所有資料在記憶體；服務重啟會重建，不是已完成正式持久化。沒有安裝依賴、修改正式DB／Storage／學生資料、推送或部署。

## 實測

| 驗證 | 實際結果 |
| --- | --- |
| `node automation/tests/past-extension-ledger.mjs` | 9/10門檻、錯答、部分題數／部分重疊、內容副本／選項重排、跨來源卷、模擬跨日、PGlite並行重送、可信學期與來源學期不同、跨人及拒直接讀帳本、歷史保留通過 |
| `node automation/tests/past-extension-api.mjs` | 真作答SQL判分後認列、太快拒絕不計、9題無葉／10題1葉、重送／重練、滿分主動複習、原卷資料不變、未完成／正答冒充錯題／跨人／錯版／無關重點拒絕通過 |
| `automation/tests/past-extension-browser.cjs`（共用CDP入口） | 實點10題取得葉、重練不重領、錯題與主動複習返程及刷新、滿分學生無錯題仍可練、樹圖／葉、1280/390/360無橫向溢出、登出清空及student2換student1連結通過，0頁面錯誤 |
| 舊功能 | `node --test automation/tests/past-wrong-compat.test.mjs`通過；關閉延伸flag後重跑`past-full-learning-api.mjs`，67解析／66錯題／22重點／44書商及原圖、原卷葉維持通過 |
| 錯誤配置 | 延伸開、錯題模式關時，實際程序以`extension_requires_wrong_review`拒絕啟動（預期exit 1） |
| 原卷葉隔離 | 合成學生1原卷葉0、滿分學生2原卷葉1；延伸各自計算，不互看 |

證據沿用ignored `automation/output/past-full-learning-20261101/`：`extension-api-results.private.json`、`extension-browser-results.private.json`、`extension-tree-390.png`、`extension-trial.private.json`及啟動log。PGlite單連線並行只證明本機冪等，不等於正式Postgres鎖定壓測；手機是桌面viewport，不是真實裝置／真人OAuth。

最後曾把API與瀏覽器同時對同一組合成學生跑，API的另一學生零筆斷言見到瀏覽器剛寫入的4筆而失敗；保留此排程教訓，重新建立本機資料後單獨重跑API通過，沒有放寬斷言或改產品去繞過。以最新獨立通過結果為準；未把此當跨人資料外洩。新一輪共用會改寫合成資料的套件必須依序執行。

交付開頁時，背景滿分分頁操作曾停住並出現`Runtime.callFunctionOn`逾時；停止自有worker、斷線及釋放lease後，改成每頁獨立有界開啟、先啟用精確target，再實際檢查內容，兩頁皆成功。這證明有可用恢復方式，未證明底層逾時原因；未因此重建已備好的9題試用紀錄。成功收據為`extension-open-full.private.json`及`extension-open-wrong.private.json`，最後錯題頁在前景，沒有代送試用答案。

## Claude複核

透過chat-mode supervisor，Claude CLI2.1.289、訂閱OAuth，session `past-extension-code-20261102`（實際`64fb6afc-b62a-4f8d-87e8-426a38c21627`），126.44秒、9次Read，viewer確認、Git前後一致、無本機阻擋問題；未自行執行測試。讀過帳本、practice adapter、新UI及指定server部分、ledger/API測試；browser僅Grep、CSS及真判分寫入SQL未讀。

Codex依意見補配置防護、錯題模式額外檢查、可信學期、來源註冊零筆即報錯、換人連結及私有參數清除，再跑受影響SQL/API/瀏覽器測試。Claude對transport仍以URL傳學生的描述不符實檔（transport已由session判斷），但UI生成的跨頁連結確有沿用原URL學生風險，已一併修正並以換人後實際點擊驗證。沒有把未讀／未跑部分冒稱複核完成。

## 試用與重開

- [我的錯題](http://127.0.0.1:4497/grade3/115-1/quiz-library.html#wrong)
- [主動選重點](http://127.0.0.1:4497/grade3/115-1/extension-topics.html)
- [滿分合成學生主動複習](http://127.0.0.1:4497/grade3/115-1/extension-topics.html?fixture_student=2)
- [本機努力樹](http://127.0.0.1:4497/grade3/115-1/extension-tree.html)

沿[全卷報告](past-full-learning-local-20261101.md)的啟動設定，另加`PAST_EXTENSION_REWARDS=1`與`PAST_SEED_CORRECT_DEMO=1`；`PAST_WRONG_REVIEW=1`必須保留。背景啟動用隱藏視窗及本機log。服務端點4497，題包仍為同份114三上自然。私有來源及QA不在clone。

交付時合成學生1預先以真正本機作答保存9道不同書商題（0延伸葉），方便接著試第10題長葉；這些是明示示範紀錄，未代真實學生作答。滿分學生2保留驗證時的延伸紀錄，仍可選其他重點或重練。當次深連結及重點名稱在`extension-trial.private.json`，服務重啟後需重新取得，不沿用舊runtime識別。

已同步原MEMKEY的補充記憶`9e677451-b82d-4361-93ca-4b1397d282e4`，更新為已批准並完成本機版，保留先前提案原文並完整讀回驗證；原本較長主記憶不截斷、不刪歷史。收據為`extension-memory-verified.private.json`。
