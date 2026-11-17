# 夥伴共同回顧筆跡：正式投影修正與驗收

## 正式收據（2026-11-17，優先於下方候選紀錄）

- 使用者另行明確核准 PR #298 SQL 後，從 main `a3366cb337393b06d16d2dff16a460185bb45889` 核對原檔並成功套用；SQL SHA256 為 `42c6ea15364f2e158a2cbab913d4c75faa1d470c2e9d9482bf1aa491a33bfe41`。只套用本次一檔，沒有重套 PR #295。
- 正式快照更新並通過 `db-snapshot-check.mjs --live`：180 函式、112 表、21 政策、22 觸發器。與套用前比對，只有本次私有函式內容改變，原執行授權／security definer 與完整 schema 保持。
- 正式交易回滾重驗原 18 父來源保存及夥伴 10 題：每題不同的合成筆跡原值精確回讀；全組提交前，已標記題也沒有筆跡；完成後兩位成員各讀到全部十題最新筆跡。原 25 張夥伴表記錄保持，代答／非成員拒絕，未自動判手寫正確或發獎，所有合成使用者、房間、答案與請求均已回滾並另查清除。
- 直接用上述正式回應驗未修改的共用 renderer：桌手機 40 次逐題回顧，含 20 次他人筆跡，色彩／座標一致、只有一張保存畫板、無橫向溢出；代表截圖已目視。這是正式回滾資料的畫面重播，不冒稱正式 Google 登入或前端部署。自有分頁已關閉，server／租約釋放。
- 私有正式證據：`approved-peer-review-application.private.json`、`peer-review-live-rollback.private.json`、`peer-review-live-acceptance.private.json`、`peer-review-formal-browser-proof.private.json`、`peer-review-after-live-check.private.log`，均在下方同一 D 碟權威根目錄。舊「缺少 attempts」收據保留為歷史，不覆寫成新證據。更新快照後同一隔離 SQL／權限／歷史回歸再通過。

**共同回顧缺口已補齊，整科仍未完成。** 三上數學沒有新啟用或前端部署，正式仍 1128，708 及另考古 51 保持。下一批 9 個比較符號父來源／23 目標／30 位置僅已驗 27 原件 SHA、原鍵／固定複核／有理數獨立計算及課本頁碼；6 程式測試通過，正式保存與畫面驗收仍待辦，不混入已通過數。

## 歷史候選紀錄（正式結果以上方為準）

三上數學手寫正式保存已由 PR #295 核准的兩份 SQL 完成；正式回應卻在共同回顧的 `shared` 清除了全部 `attempts`，其他夥伴因此看不到已保存筆跡。先前人工補資料的瀏覽器 fixture 掩蓋此缺口，不能作為正式完整驗收證據。[前階段收據](quiz-open-sketch-20261117.md)保留，不改成通過。

## 修正範圍

`supabase/quiz-partner-peer-sketch-review.sql` 僅更新既有私有函式 `partner_pilot.learning_snapshot_pre_message_media(uuid)`。沿用原成員／來源守衛，僅在全組全部題目已提交後，為明確 `type:open` 且含 `input:sketch` 的一般題回傳該題負責人最新一次已保存作答。共同回顧不帶出歷次筆跡；本人原歷史作答保留。提前標記／討論題目不揭露筆跡。原單選、多欄、純文字開放題及考古題投影保持。

沒有新增資料表、RLS、授權或前端修改，原外層送答／回顧介面保持。SQL 有精確原函式 MD5、手寫驗證依賴與交易守衛；重複套用或來源不符直接拒絕。固定的套用前 fixture 可重現產物：

```text
node automation/build-quiz-partner-peer-sketch-review.mjs
```

## 已完成的候選驗收

- 32 項回歸通過；其中隔離資料庫使用完整候選 SQL，測十道手寫題、兩位成員、各題不同筆跡、顏色／座標原值、訂正後只回傳最新一筆、本人歷史保留、未全部提交不揭筆跡、非成員／未登入拒絕、原執行授權及個人資料保持、重複遷移拒絕。產物另驗 LF／CRLF 可重現。
- 使用上述資料庫實際產出的兩位成員 snapshot，交給未修改的共用 renderer；桌機 1280／手機 390 共 40 次逐題回顧，其中 20 次為他人題目。筆跡／顏色精確一致、每題只有一張已保存畫板、無橫向溢出；四張截圖及桌手機代表畫面已目視。沒有手工補 `shared[].attempts`。
- production snapshot 靜態檢查通過，仍為原 180 函式；此檢查不是候選 SQL 的正式套用或 live check。

私有證據位於 `D:/AI-Work/g3math-media-live-20261117/`：`peer-review-regression.private.log`、`peer-review-local-snapshots.private.json`、`peer-review-browser-proof.private.json`、`peer-review-static-check.private.log`。使用合成身分與隔離資料庫，不能冒稱正式 Google 登入或正式共同回顧通過。自有 QA 分頁已關閉、server 停止及瀏覽器租約釋放。

## 當時待完成的正式關卡（現已完成）

當時本 SQL 尚未取得本次明確核准、尚未套用正式庫；PR #295 核准不涵蓋這個函式。現在已依上方收據完成另行核准、main 核檔套用、production snapshot、live check 與正式回滾存答／共同回顧驗收。不能只憑本機通過標記正式完整驗收。

三上數學尚未整科通過：正式仍 1128 可抽來源，708 父來源及另考古 51 尚未啟用，137 技術候選與剩餘 571 適配分開登記。此修正沒有新增 AI 呼叫、媒體上傳或網站部署。SSD 升級後 C 約 257 GiB、D 約 247 GiB 可用；私有來源及暫存持續留 D。
