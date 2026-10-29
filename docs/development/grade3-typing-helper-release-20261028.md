# 三年級找字小幫手與草稿正式發布

2026-10-28，使用者檢視操作預覽後同意套用。正式入口：[三年級第 09 週](https://it-class-tcwu.vercel.app/grade3/115-1/week09.html)。

## 發布結果

- 狀態：production／READY，已 promote。
- Vercel：`it-class-tcwu`／`prj_eJ1qle57xyilS5MKy6ZS6OuYtyFb`，團隊 `chianwu-4755s-projects`／`team_SOhQ0oysg6ZGV9vs3RryW2CB`。已核對現行 CLI 帳號、專案、正式別名及部署身分。
- 新部署：`dpl_FsaD45HERoxHHFkFuF2X1CgZHpCh`，部署網址 `https://it-class-tcwu-abkxxltz8-chianwu-4755s-projects.vercel.app`。
- 前版／可回復部署：`dpl_8wfgFTaHc8VpdJyxXCPUKwLrmuJP`。前版 Git SHA：`5e5b15b0c0dc3db07f561c7b13c73546091b6709`。
- 靜態網站，沒有本次新增的 Functions。先建立 production `--skip-domain` 候選部署，核對 24 個檔案及原正式別名未變後，promote 同一個已驗證的部署，沒有重建另一份產物。

## 內容與範圍

本次隔離匯出當時正式 Git SHA，只覆蓋 24 個 runtime 檔案；保留另外 389 個既有檔案的來源內容。沒有整包發布主工作區的未完成測驗、努力樹、美術、作業、教材、資料庫或自動化修改。

- `grade3/115-1/`：`week02`、`week02-mail`、`week03`～`week09` 的 HTML／JS，共 18 個檔案。所有現學期九個打字活動接上手動儲存／回復草稿；含新工具的第 03～09 週同步更新版本字串。
- `shared/typing-challenge.js`、`shared/grade3-google-course.js`：以本人核對後的登入 session 處理草稿；保持正式進度原 RPC 路徑，不將草稿視為過關。
- `shared/typing-tools.js`：保留既有匯出與 getter API，整合限高鍵盤及標點面板互斥。
- 新增 `shared/typing-guide-model.mjs`、`shared/typing-keyboard-guide.js`、`shared/typing-keyboard-guide.css`：長文分段、完整注音可捲動、可選字卡查鍵、英文大小寫／空白／標點／換行提示、低高度退路。
- 第 09 週移除雙重 renderer，統一依目前題目切換中英提示。

全三年級十九個既有週次打字活動皆有草稿設定；舊學期十個原已啟用，本次補齊現學期九個。沒有新增自動存檔、輪詢、即時逐字評分或自動送出。

## 資料庫與驗證

- 唯讀確認指定 Supabase 專案 `upxgyusodibaqcrocdzj` 的 `typing_drafts` 已存在，欄位、包含 `course_id` 的五欄主鍵、RLS 與 authenticated CRUD 權限符合契約；四項 policy 以 `auth.uid() = user_id` 限定本人。無 SQL／schema／權限異動。
- 六項 model 單元測試通過，所有三年級十九個活動設定盤點及修改模組語法檢查通過。
- 以「正式基準＋24 檔」凍結發布包另開 loopback 測試站：1280×720、640×360 等效縮放／低高度、390×844；查字滑鼠焦點、按鈕 Enter、全文獨立捲動、工具互斥、中文組字事件防護、英語格式均通過。組字事件測試是合成事件。
- 凍結包所有九個現學期活動逐頁草稿儲存／重整回復、覆蓋確認、失敗與重試、過關清草稿、未登入／名冊拒絕、token 更新、切回分頁不自動保存、身分失效的延遲回應防護均通過。
- 保護中的候選部署經既有 Vercel 驗證抓回 24 個檔案，逐位元組 SHA256 全部一致後才 promote。未停用 Deployment Protection，也未匯出 token。
- promote 後，正式主網址 24 個檔案回應 HTTP 200，逐位元組 SHA256 全部一致。另核對首頁、努力樹、原 auth/navbar、測驗與作業等十一個重要既有檔案，UTF-8 文字在 CRLF／LF 正規化後與前版一致。
- 正式主網址真實瀏覽器以攔截的合成登入／草稿／進度回應驗證第 08／09 週長文鍵盤、草稿重整回復及原 `save_grade3_progress` 參數；第 16 週靜態鍵盤及中英切換亦通過，無頁面錯誤。沒有真實學生寫入，沒有冒稱完成真人 Google OAuth 或原生微軟注音候選窗驗收。

正式站適用的是已測試的同一份靜態產物。原生 Windows 注音候選窗與教室閱讀距離仍保留為實機確認項目。

## 發布與維護紀錄

連接工具可核對正式別名，但專案／部署詳情回傳 404；依工具建議改用同帳號、明確團隊與原專案的本機 Vercel CLI。CLI 54.7.1 的 `curl` 會將部分全域旗標轉傳給 curl；本次在已核對 `.vercel/project.json` 的隔離目錄執行，使用明確 project／org 環境範圍及指定 deployment 讀取，未更改存取控制。

隔離產物、24 檔 manifest／SHA256、候選及正式讀回、十一檔保留比對與合成瀏覽器紀錄保存在忽略的 `tmp/typing-release-20261028/`。未發布本機 preview、測試程式或此文件。

2026-10-28 發布時尚未 commit／push；2026-10-29 依使用者指示，將上述 24 個正式 runtime 檔案、三個對應測試及相關文件獨立整理提交。提交前逐檔核對發布 manifest 與工作區 SHA256 全部一致，正式站 24 檔亦一致；其他未上線功能不納入。提交識別與推送結果以 Git 紀錄為準。
