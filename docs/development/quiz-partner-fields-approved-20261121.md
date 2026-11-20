# 一般多格題共同回顧：核准版 SQL

使用者於2026-11-21回覆核准 commit `28920e2923e4e944e9a8934b21e630dc78e45c6d` 的 `supabase/quiz-partner-fields-review.sql`，同意依流程套用並驗收。本次只處理該版一般多格題，不包含 PR396 後加的 legacy single 分支；新增單選範圍已另詢問，尚待回覆。題庫來源及八類繪圖試用仍沿各自門檻，不由這項核准順帶啟用。

本檔保留核准連結的 Git 原文，首行 pending 是原草稿註解。Git 的 LF 版 SHA256 為 `2d60bd31d5e814f0b8f92ecd520a631cc7ffe6ef1619df53de2cdb2b9e47d2c2`；先前 Windows CRLF 副本為 `a0c677183bee2c1d8f8107b47c0d50cbef5d2990677d9301a202e3704e919051`，僅換行不同。本 SQL 固定 LF，從 main 取出的套用檔必須逐位元組符合核准 Git 版，避免函式本文換行造成額外雜湊漂移。

## 範圍與驗證

- 只更新既有 `partner_pilot.learning_snapshot(uuid)`；只有全隊完成後，才在一般多格題共同回顧回傳原負責人的最新實際作答。不改題目、配題、答案、歷次、來源凍結或資料表權限。
- 原函式及兩個依賴函式都有 MD5 基線保護；前置正式唯讀比對定義、EXECUTE ACL 與 SECURITY DEFINER 均符合既有快照。正式套用仍須重新確認 main 與基線。
- 原生隔離測試涵蓋一般／allocation-v1 凍結小隊、完成前不揭答、完成後只取負責人最新原答、保留錯答與歷次、匿名／非成員／他人寫入拒絕、其他函式與資料雜湊不變，以及依賴漂移、重套拒絕。
- 測試專用舊函式保留混合換行，不可套正式庫。核准升級測試與當前正式快照測試分開；正式快照尚未更新前，後者明列跳過，不把跳過當通過。更新快照後須兩種都通過。

## 執行狀態

已經 PR #397 合併到 main `2c70ba3ed51d97b488ed884d48280eab9f406574`，並從該乾淨 main checkout 核對核准檔 SHA 後套用正式庫一次。正式函式 MD5 從 `ed117acd31cce89bd7622c60288bb307` 變為 `2a8634c909aa6331fc3824213a6aee8e`，其他179個函式、EXECUTE ACL、SECURITY DEFINER及整份schema／policy／trigger定義均保持。

隨即匯出快照、執行 `db-snapshot-check.mjs --live`，180函式比對通過；新快照的升級／當前函式、一般／凍結小隊及依賴漂移共5項測試全部通過、零跳過。正式SQL只有函式與既有EXECUTE權限定義，不含題目、配題、答案或歷次資料列寫入；逐筆資料雜湊保持的測試證據來自隔離資料庫，不冒稱正式學生介面OAuth驗收。本次不部署前端、不啟用新來源。

CLI在全新工作目錄以 `--linked` 自動推導連線時先遇到IPv6設定問題，當時沒有正式寫入。改以工具原有 `--cli` 參數使用明示 `--project-ref upxgyusodibaqcrocdzj` 的本機薄包裝後，完整前後live檢查與匯出通過；沒有重設資料庫、重跑舊SQL或暴露連線憑證。完整私有收據位於 `D:/AI-Work/conversion-resume-20261120/fields-approved-production-receipt.private.json`。

PR396的legacy single候選仍待補充核准，原本以舊MD5為前置條件的合併版已不能直接套用。後續須以本次正式多格版為基線，另外準備單選擴充；原核准檔保留不改，也不重套。
