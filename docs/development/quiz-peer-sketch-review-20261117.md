# 夥伴共同回顧筆跡：資料投影修正候選

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

## 正式關卡仍待完成

本 SQL **尚未取得本次明確核准、尚未套用正式庫**；PR #295 核准不涵蓋這個函式。核准後從 main 精確核檔套用，再更新 production snapshot、執行 live check 及正式回滾存答／共同回顧驗收。不能只憑本機通過標記正式完整驗收。

三上數學尚未整科通過：正式仍 1128 可抽來源，708 父來源及另考古 51 尚未啟用，137 技術候選與剩餘 571 適配分開登記。此修正沒有新增 AI 呼叫、媒體上傳或網站部署。SSD 升級後 C 約 257 GiB、D 約 247 GiB 可用；私有來源及暫存持續留 D。
