# 2026-11-11 夥伴練功獨立測試庫：直接 API 權限修正

## 範圍與授權

使用者於 2026-11-11 授權修正安全警告，並要求日後測試環境也必須具備適當安全控管。
本次只處理 `partner-practice-staging / jazeolkwueoexcgkxhzr`；正式課程庫 `upxgyusodibaqcrocdzj` 不在本批範圍。沒有發布網站、修改資料庫函式或更新正式快照。

## 問題與修正

以下十張 public 表未啟用 RLS，且 anon/authenticated 各有 ALL 權限；匿名及一般登入者的直接 HEAD/精確筆數請求皆成功。名冊四筆均為 example.test 測試信箱，其餘有資料的是四筆場次、一筆考古卷及一筆學習設定；本次未查閱歷史存取日誌，不判定是否曾外洩。

- student_enrollments、student_progress
- quiz_sessions、quiz_past_papers、quiz_generated_papers
- quiz_learning_settings、quiz_learning_leaves、quiz_media_assets
- garden_growth、garden_reward_catalog

已針對十表 ENABLE ROW LEVEL SECURITY，並 REVOKE ALL FROM PUBLIC,anon,authenticated。保留 postgres/service_role 權限、函式擁有者及 ACL，不 FORCE RLS、不刪表、不新增全開政策。實際管理 API 操作逐次核對個人帳號、固定測試 project ref 及組織，且在同一交易檢查原表 ACL/RLS 及函式定義/ACL 未漂移。

原網站經 partner_action/partner_media/private Broadcast 存取 partner_lab；另存 partner_pilot 的原名冊／來源卷／媒體路徑。十表已找到的函式依賴均為 postgres owner SECURITY DEFINER，故封鎖直接表存取仍可保留原 RPC。不可將本批 SQL 直接套用至正式庫；正式站另有直接進度寫入契約。

可追溯 SQL：`supabase/staging/20261111-api-table-security.sql`。機器私有證據保存在 `D:/ai-browser/logs/security-audit-20261111/`，不提交資料列、題庫副本、憑證或管理 token。

## 驗證

- 本機十表權限模型 86 項通過。
- 本機實際 40 表結構與 42 函式副本 38 項通過：雙人加入／分題、答案隱藏、互助、草稿接續、共同回顧、領獎防重、真題媒體雜湊及原 pilot 名冊／目錄；Auth 與 Realtime 為本機替身，Google provider 為合成模擬。
- 套用後匿名十表直接請求均 401；登入者十表直接請求均 403；原目錄 75 份及 me 查詢正常。
- 即時套用前後 40 表資料雜湊一致，42 函式定義／owner／ACL 及既有政策保持。
- Security Advisor 已重新整理：11 errors → 0 errors；仍有 23 warnings，非本次十表錯誤，不能據此宣稱整個專案全面稽核通過。新增的無政策 RLS Info 為本批 RPC-only 設計的預期結果。

- 線上真實 HTTPS/RPC/私有 WebSocket 19 項通過：三個測試身分登入、75 份目錄、非名冊拒絕、雙人加入／準備／分題、答案隱藏、互助、草稿接續、共同回顧、領獎防重、真題圖片、未授權媒體拒絕、成員可訂閱、非成員拒絕、通知最小化與離隊後舊頻道失效。
- 第一次私有同步訂閱曾失敗；保留失敗紀錄，唯讀重查成功，完整流程第二次 19 項全過。沒有為了通過測試放寬權限或修改同步程式。
- 兩批安全回歸各建立三間專用測試房，使用隨機標記及精確 UUID／requestId 清理。最終原有 40 表資料筆數／雜湊、42 函式定義／owner／ACL、既有政策均與套用前一致；測試使用的序號可能正常前進。
- 本輪沒有真正學生雙機、實體手機或真 Google provider 登入驗收；pilot Google 路徑僅在本機合成 provider 驗證。這不影響本批只改表格 ACL/RLS 的界線，也不能冒稱全站全面安全稽核。

## 後續測試安全原則

測試站、暫存站與原型上網前，也要驗證匿名、未授權帳號及跨使用者存取會被拒絕，並確認正常功能可用。優先用假資料及獨立資源，管理憑證不得進前端；不得以「只是測試」為由公開表格讀寫、停用必要 RLS 或略過成員檢查。需要例外時，限縮範圍、說明風險與期限並取得明確授權。
