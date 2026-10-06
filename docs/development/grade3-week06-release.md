# 第 06 週 Google 登入正式切換紀錄

2026-10-06。使用者明確核准「正式切換資料庫與網站，保留並接回舊成果」。

## 原因與修正

Google OAuth 已成功，但正式 Supabase 尚未安裝 reconnect_grade3_progress／get_grade3_progress／save_grade3_progress；前端因此不能確認本人、英打保持鎖定，努力樹也無法讀取身分卡成果。補充 PGRST202 的明確訊息，登入但尚未接回時 navbar 不再只顯示 email，英打區同步說明原因。

## 正式資料核對與部署

- 已確認 Supabase 可見帳號 chianwu@gmail.com、指定專案 upxgyusodibaqcrocdzj；Vercel 帳號 chianwu-4755、既有 it-class-tcwu 專案。
- 129 位學生的目前班級、座號、姓名、帳號／115 年度 email，與原始歷史身分卡名冊逐人核對一致；592 筆來源的歷史姓名、座號皆對上原名冊，無未知活動或矛盾成果。第 05 週六關紀錄符合現行目錄。
- 額外第307班測試卡沒有來源成果，不納入本屆129位核准。3筆既有正式成果屬教師示範，完整保留，沒有認領成學生成果。
- 受限資料／權限／函式快照與核對後 SQL 保存在 C:/Users/user/.codex/private/grade3-week06-20261006，沒有納入 Git 或網站發布內容。
- 安裝在單一交易執行，鎖定來源／名冊／正式成果，重新比對完整 preflight 快照；資料有異動則全交易停止。建立129筆核准及共用 RPC/RLS，凍結舊身分卡寫入；592筆歷史與3筆示範皆保留。
- 網站基準為當時正式 Git HEAD 74dcec56eab16a29a64eeb75b4c666eaaed40703；隔離匯出後只覆蓋21個本次程式／網頁檔，不發布主工作區的不相關修改、SQL、帳密或私人快照。
- Vercel 部署 dpl_BMcz5fNRf1eCDEAhXRVWxmzUhseS 已 READY 並 promote。正式入口：https://it-class-tcwu.vercel.app/grade3/115-1/week06.html 。抓回 Week06、Google 模組、Week05 與 my-tree，與本地內容逐字相同。

## 驗證

- 合成 PostgreSQL 2個整合測試、含缺 RPC 狀態的完整桌機／手機瀏覽器測試通過。
- 使用現有30130真實 Google session 在本地頁面驗證：navbar 為301／30及正確姓名，英打第1關輸入／檢查可用；故意錯字顯示正確提示，沒有保存過關紀錄。
- 實際努力樹顯示本人及11葉2花，對應6筆舊成果。雙分頁重新接回後仍只有1筆綁定、6筆匯入稽核，沒有重複。
- 正式 PostgreSQL 在 authenticated 角色及受確認的30130身分 claims下測本人RPC保存／讀取、看不到他人列，再換教師角色測原admin_reset_progress；交易ROLLBACK，因此第06週留下0筆測試紀錄。
- 教師第06週visibility隱藏／顯示RPC通過並ROLLBACK，保持原預設可見，沒有改動實際課堂設定。
- 最後狀態：核准129、綁定1、稽核6、來源592、正式9（教師3＋30130接回6）、第06週0。匿名不能執行新保存RPC或舊個人帳號查詢RPC。

## 範圍與後續

本次已驗證既有 Google session接回與實際資料庫權限，沒有重新走完整親師生平台第一次開通／改密碼／OAuth選帳號。雙分頁測的是已綁定重試，首次並行匯入競爭仍只有合成／鎖契約驗證。其他學生於首次本人登入時受控接回；遇到名冊異動應依維修契約處理。

主專案程式與SQL仍未提交／推送 Git。後續從舊main重新部署會覆蓋新前端，必須先整合這21個檔案及SQL契約；保留不相關工作區修改，勿直接整包提交。本次Vercel隔離發布不是主專案Git提交。
