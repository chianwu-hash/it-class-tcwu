# 三年級第 09 週正式發布紀錄

2026-10-28，使用者明確授權「確認沒問題就套用活動登記 SQL，將三年級第09週課程網頁正式上線」。

正式課程：[第 09 週｜會旗票選，課文練功出發！](https://it-class-tcwu.vercel.app/grade3/115-1/week09.html)

## 發布內容與範圍

- 會旗票選入口、本人登入指引、國語第二課與英語 Unit 2 六關、考前練功入口。
- `weekCode: '09'`、`activityKey: 'typing_task_6'`、總關數 6；使用既有 Google 本人控制器、typing 模組及受控 RPC。
- 首頁最新週卡、學期 navbar、後台週次／總關數、努力樹同步。同學期舊週頁僅更新 navbar 快取版本。
- 功能提交 `774024448dfc04f3ce6693306d7b0cfb3b66dc2e`，21 個相關檔案，推送 `origin/main`。未納入其他未提交的教材、題庫、作業、閱讀或工具修改。
- Vercel 專案 `it-class-tcwu`（`prj_eJ1qle57xyilS5MKy6ZS6OuYtyFb`），團隊 `chianwu-4755s-projects`，production branch `main`。CLI 現行帳號與上述團隊、repo、專案已核對。
- 功能版正式部署 `dpl_AKoz1foFyjcdeTREWUor2vTPqLLP` 已 READY；前版為 `dpl_AugcnEhJT86CWReo6fKk63Y2R8cA`（`560957d`）。後續文件提交不更動產品程式。

## 正式 SQL

- 由已核對的 `supabase-personal` 執行，連到 `upxgyusodibaqcrocdzj`／`chianwu-hash's Project`。另以工作瀏覽器確認正式 Supabase 專案及組織頁面。
- 套用 `supabase/grade3_week09_typing.sql`，確認 `('09','typing_task_6',6)`，未修改 RPC、權限或舊活動。
- SQL SHA256：`ea9acae3b02e7c4b28c8df34d4bcb57fe125715c0be465ee00afeac39f8c83fb`。
- 初次彙總快照回傳空物件，未將其採作保留資料的證據；改成明確欄位與回應形狀驗證後，重跑可重入 SQL 並比對。2,526 筆 `student_progress` 與 592 筆 `guest_progress` 在登記前後筆數、內容摘要一致。
- 正式六關實測僅新增教師專用 307-30 的本週一筆成果；排除此筆後，其餘 2,526 筆正式進度摘要仍與登記前一致。

## 驗收結果

- 本機 SQL 測試重跑通過：登記可重入、總數衝突拒絕、匿名拒絕、本人保存、重送不倒退與他人隔離。
- 前一階段合成瀏覽器測試已通過：登入鎖定、保存失敗重試、精準提示、重整接續、六組再練習換題且不寫回、共用鍵盤、帳號變更鎖定、完成回饋及週卡可見性。
- 正式站 16 個 runtime 檔案逐一核對 SHA256，與功能提交完全一致，均回應 HTTP 200。
- 工作瀏覽器可見本人學校帳號後，確認可信課程身分為 307-30，再由頁面實際檢查控制項完成六關。資料庫為 `current_level=6`、`score=6`、`completed=true`；重新整理仍接回完成。
- 正式努力樹可見本週五片打字葉與一朵魔王花，標示「第 9 週 國語第二課與英語 Unit 2」。
- 正式 1280px／390px 頁面與首頁驗收通過：無水平溢出、零頁面錯誤、第 09 週為最新且可見、navbar 第 09 週連結存在。票選表單未代為送出。
- 以既有 `admin_set_week_visibility` 教師 RPC，在明確 authenticated SQL 測試情境切換本週隱藏／顯示，由真實瀏覽器確認首頁與 navbar 同步，第 08 週不受影響；最後移除本次測試列，恢復原本預設顯示。這是後端教師權限情境與正式前端聯測，沒有宣稱實際按過教師後台按鈕。
- 已有學校 Google session 的正式流程通過；本次未另啟一輪 OAuth，也未以桌面原生注音候選窗逐字操作。

## 提交檢查與證據

- 原工作區 pre-commit 掃到與本週無關的既有 ignored／untracked PowerShell 腳本而拒絕。保留原檔，將 index 匯出到乾淨暫存目錄，補入既有檢查工具，使用同一 pre-commit 成功通過 ASCII 與 agent state 檢查後提交，沒有停用 hook。
- Vercel 連接工具無法讀取部署清單；依其提供的 fallback，改用已核對帳號及明確團隊／專案的本機 CLI，未更換發布目標。
- 私有／暫存證據在 ignored `tmp/grade3-week09-release/`：SQL 比對、正式檔案摘要、正式瀏覽器、努力樹、週卡可見性及截圖。不提交帳號 session、憑證、原始學生資料或教材 PDF。
