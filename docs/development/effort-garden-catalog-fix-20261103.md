# 努力樹升級任務目錄修正（2026-11-03）

## 問題與正式修正

教師後台依正式活動設定算出學生達標，但資料庫 `garden_reward_catalog` 漏了三上第 10 週 `typing_task_5`。因此畫面顯示 62 葉／10 花，`garden_growth` 卻少算本週 4 葉與 1 花，回傳第一級。後台「待學生端同步升級」是沒有成長紀錄的狀態提示，這次根因是目錄漏列，重新登入無法修復。

已在正式 Supabase `upxgyusodibaqcrocdzj` 套用 `supabase/garden-catalog-20261103.sql`，新增一筆三上／10／typing_task_5／typing／5／無 rewardMode。正式目錄由 93 筆變成 94 筆。重複套用不新增重複列，若已有不同定義則中止，不能默默覆蓋。

本次是資料庫目錄修正，**沒有重新部署網站前端**。正式網站原有升級判定、主場景成長動畫、解鎖、登入及作答機制保留。Git 分支補收「已在正式站的第 10 週設定」，讓目錄產生器可重建 94 筆；不是另改正式頁內容。

## 稽核範圍

- 從正式網站讀取 `reward-tree-config.js` 與英／中打課程定義，建立全部應有目錄，不以本機髒工作樹或只有完成紀錄作準。
- 比對 94 個 course/week/activity 組合，包含舊學期正式活動、三上／六上週活動與 48 筆基礎打字目錄。新增加的四上／九上設定目前無週活動，不新增空白或虛構任務。
- 36 個活動頁均 HTTP 200；沿同年級頁面的外部腳本／adapter 追查，全部活動鍵存在。三上第 10 週正式 `week10.js` 明確設定總數 5。
- 修正前只有上述 1 筆 missing；種類、關卡數、魔王模式無不符或額外列。修正後 missing／mismatched／extra 全為 0；正式 `student_progress` 的未列目錄活動組合也為 0。
- 基礎打字里程碑花、考古花、作業、閱讀由各自既有伺服器蒐集器處理，不把它們重複塞成週活動。

## 驗證

1. 5 項 Node／隔離 PGlite 測試通過。使用從正式庫讀回的當前 `garden_growth` 定義，僅學生身分與成果輸入為合成資料。重現漏列時第一級；套用目錄後第二級。72 項成果 ID 全保留，第一次 seen=false、記錄 seen 後重讀為 true，只建立一筆成長紀錄；其他學生與教師權限限制保留。
2. 工作瀏覽器在本機 4466 載入正式版升級前端模組，自動播放主場景成長動畫；播放完成、手動重播、重整不重播首次動畫、62 葉／10 花保留皆通過，無頁面 JS 錯誤。首次驗收伺服器將靜態 JSON Buffer 二次編碼，造成素材載入失敗；已修正本機測試伺服器後通過，正式網站不受此測試程式影響。
3. 正式遷移以單一 repeatable-read 交易執行：確認已知目錄雜湊；比較學生進度、答題、發獎、成長、解鎖、通知、寵物偏好與既有 public 函式的前後雜湊，全部不變。只增加目錄列，不提前為學生建立成長或已讀紀錄。
4. 301 班 10 號帳號與正式名冊已核對。以正常伺服器函式進行**交易內驗算後全部 rollback**：回傳 level=2、62 葉／10 花、seen=false。驗算前後正式成長紀錄仍為 0，保留學生首次動畫。沒有代答、補假獎勵或永久寫入該生升級／已讀狀態。

學生下次開啟 `/my-tree.html?course=grade3-115-1`，正常呼叫 `garden_growth` 就會建立正式成長紀錄並播放動畫；若原頁一直開著，重新整理努力樹頁即可，不需要重做任務或登出登入。

## 維護與證據

新增 `automation/audit-garden-catalog.mjs` 與 `new-page-checklist.md` 同步檢查，明示「產生 SQL 不等於已套用資料庫」。稽核器不自行寫入或刪除正式資料。新增週頁後必須同步前後端任務定義並重新比對。

證據位於主工作樹 ignored `automation/output/garden-catalog-20261103/`：`audit.json`、`pages.json`、`migration-result.json`、`live-upgrade-probe.json`、`live-verification.json`、`browser-report.json`、兩張成長截圖；未提交私人資料庫快照或憑證。

本機重現：先取得相同格式的正式唯讀來源快照（database.json、三個課程設定 JS、expected.json、effort-garden-v2.mjs），設定 `GARDEN_CATALOG_SNAPSHOT` 為其路徑，執行 `node --test automation/tests/garden-catalog-audit.test.mjs automation/tests/garden-catalog-growth.test.mjs`，或 `node automation/garden-catalog-local.mjs` 開本機隔離驗收。測試刻意去除該週目錄以重現舊問題，再套用修正。

不要刪除本週目錄來回退已發生的正常成長；若需再修正任務定義，依實際活動契約處理，不還原舊學習資料快照。
