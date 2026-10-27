# 題庫圖片使用 Google Drive 可行性研究

研究日期：2026-10-27。狀態：研究建議，尚未核准採用或進行試傳、搬移、權限變更。

## 結論

Google Drive 適合當完整題庫圖片的大容量來源；若要維持目前私有題目與解析的存取方式，應由受控後端透過 Drive API 讀取原檔，再提供給已授權學生。不能把一般分享網址或短效縮圖網址直接當成可靠、永久的圖床。

500 GB 是帳號總配額，不是本次查得的剩餘容量。使用者指定帳號為 `th990821@mail.thps.ntpc.edu.tw`；專案 2026-09-09 的連線紀錄曾確認該帳號 500 GB、已用 128.72 GB，此數值不能當成今天的剩餘空間。目前 Drive 連接工具登入另一個帳號，未拿該帳號替代查核。

現有整理批次媒體內容去重約 566.9 MB，顯示 Drive 在儲存容量上有吸引力；此批不是兩年級全部科目全冊，不能據此保證完整題庫占用或可放冊數。容量基準見 `quiz-capacity-audit-20261027.md`。

## 可用的現有基礎

- `drive-connection-setup.md` 記錄指定學校帳號、Drive API 與後端 OAuth 連線已設定；本次未重新驗證授權是否仍有效，也未讀取任何權杖。
- `supabase/functions/homework/handler.mjs` 已有先檢查作業授權、後端取得 Google 存取權杖、用 `files.get?alt=media` 轉送原檔，以及受控縮圖讀取的做法。這證明已有可借用的技術模式，不代表題庫圖片已接入 Drive。
- 現有 `drive.file` 權限以應用程式建立、開啟或使用者明確選取的檔案為範圍。未來應使用專用題庫資料夾及應用程式管理檔案，不預設擴大到整個學校雲端硬碟。

## 接法比較

| 接法 | 可行性與限制 |
| --- | --- |
| 公開分享圖片，前端直接連結 | 可作個別展示試驗，但一般分享網址是檢視／下載用途；官方縮圖網址短效，不適合當永久網頁圖源，也無法沿用逐題私有授權。 |
| 私有 Drive → 已授權後端 → 學生網頁 | 技術可行，原圖與燈箱可保留；必須檢查圖片是否屬於該題與該學生可見的解析。仍有後端流量、延遲與 API 配額。 |
| Drive 保存完整媒體，Supabase 保存目前使用的圖片快取 | 值得後續評估的分層方案；需新增雜湊去重、更新與淘汰機制，快取讀取仍須符合題庫權限。尚未實作。 |

將圖片搬到 Drive，能減少 Supabase Storage 容量，但如果圖片位元組仍經 Supabase Edge Functions 轉送，仍計入 Supabase 對外流量；改由 Vercel 轉送也須核對該平台流量。不能宣稱因此消除流量成本。

Google Drive API 也有專案／使用者配額、下載限制與退避要求；官方 2026 年已變更部分配額模型。帳號 500 GB 並不代表無限制圖片分發。本次未查核該 Google Cloud 專案的實際配額或進行整班壓力測試。Google Cloud Storage 是另一項服務，不能直接套用 Drive 500 GB 配額。

學生維持目前測驗登入，由後端使用教師已授權的 Drive 連線；不把 Google 權杖送到前端，也不要求每位學生登入教師的學校帳號。

## 建議下一步（尚未執行）

先在專用測試資料夾用一張題目原圖及一張解析原圖驗證：正確學校帳號、API 私有上傳與原檔讀取、題目／解析授權、燈箱、重新整理及權杖更新，再以約 30 個同時讀取測量延遲、錯誤及實際流量。確認效果後才決定全庫圖片是否移轉。現有 Supabase 圖片與作答紀錄維持原狀。

## 補充研究：圖片避開 Supabase 流量與 Claude 討論

使用者追問能否繞過 Supabase 圖片流量，並要求先上網搜尋再與 Claude 討論。已用 chat-mode CLI 2.1.289 完成兩輪唯讀討論，session `20261027-drive-delivery`；兩輪 viewer 啟動、completion marker、同 session resume、Git 前後及獨立目前狀態比較均通過。回覆存於 `.chat-mode/sessions/20261027-drive-delivery/turn-0001.response.md` 與 `turn-0002.response.md`。Claude 使用 Codex 提供的官方研究資料，沒有自行連網、讀其他檔案、接觸憑證或修改程式。此為設計建議，未實測或採用。

### 共同推薦

圖片走「私有 Google Drive → Cloudflare Worker → 學生瀏覽器」，Supabase 僅保留登入、題目／解析授權、判分、進度與小型讀圖憑證。圖片位元組不經 Supabase／Vercel，就不計入這兩者的圖片轉送流量；控制資料仍有流量。這是調整流量路徑與計價方式，不是消除網路傳輸或所有平台限制。

Supabase 依當前可見題目批次簽發短效 ticket，指定媒體、版本／雜湊、用途及到期；揭答前不簽發解析 ticket。Worker 本地驗證通過後才讀內部快取或 Drive 原檔。先保留所有圖的授權，不擅自改題目圖為公開。Worker 不持有 Supabase service role，Google 憑證不交給瀏覽器。專用 OAuth app／檔案授權需先驗證，不能直接把作業系統既有憑證複製到另一服務。

### 其他路徑與未採建議

- 公開 Drive 直連可能顯示圖片，但沒有現有私有解析授權；非官方網址不能當穩定服務承諾。私有檔只回傳 302 不會自動把後端 Google 授權帶給學生。
- 學生各自 Google OAuth 並獲得檔案權限，技術可行，但增加登入／分享步驟，且檔案存取權與逐題揭答不是同一回事。
- Apps Script 可回傳含 base64 的文字／JSON，圖片內容經此路徑可避開 Supabase；但不是直接輸出二進位圖片的 ContentService，base64 約增加三分之一資料量，還有自己的配額，不推薦當全庫主力。
- Vercel 代理也可避開 Supabase，但改消耗 Vercel 流量，不能說完全省下成本。
- 取消題目圖 ticket 只會減少授權負擔；若仍經 Worker，圖片請求仍計 Worker request，不能宣稱因此大幅減少 Worker 圖片請求。

### 配額、快取與覆核修正

官方 Workers 定價：Free 每日 100,000 requests、每次 10ms CPU；Paid 最低 US$5／月，包含每月 1,000 萬 requests，另有超額請求／CPU 計價，明文不另收 egress／bandwidth 費。不能推成所有方案永久免費無限，也未查核我們的 Cloudflare 帳號／部署能力。快取命中仍計 Worker 請求，Drive 冷讀仍受 Google 配額影響。

Claude 第一輪部分推論已由 Codex 指出並在第二輪撤回／修正：drive.file 支援使用者明確選取授權的既有檔案，不必一律擴大成全庫 readonly；HMAC ticket 與 Google token 更新併發是不同問題；KV 不是更新鎖；不能宣稱 workers.dev 一定無快取；撤銷 Google 憑證不保證已發 ticket／快取立即失效。官方 Cache API 有 workers.dev 行為說明，實際命中、各地冷讀及延遲仍需實測。

Google token 可先做有效期內的 request／isolate 記憶體快取，不預設新增跨 isolate 協調；若實測有大量更新才處理。短效 ticket 仍可在效期內轉傳，路徑／查詢參數都可能入 log，不能當絕對防分享。瀏覽器已看過的圖無法收回。Drive app 權限與是否可批次授權資料夾子檔尚待測，不因建立新 client 就宣稱權限隔離完成。

### 建議最小試驗（尚未執行）

使用專用測試頁與少量題目圖、解析圖及一張大圖；驗證圖片 bytes 未經 Supabase／Vercel、未揭答／竄改／過期存取被拒、原檔雜湊與燈箱尺寸一致、實際快取命中、約 30 人同時讀取時的延遲／CPU 超額／Drive 限流，並確認關閉測試設定可回原圖庫。保留既有題庫與作答資料，不新增付費或全量移轉。

補充官方來源：

- [Cloudflare Workers 定價](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- [Apps Script ContentService](https://developers.google.com/apps-script/reference/content/content-service)

## 原研究官方依據

- [Drive API 下載原檔與瀏覽器下載連結](https://developers.google.com/workspace/drive/api/guides/manage-downloads)
- [Files 資源：thumbnailLink 短效與網頁使用限制](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)
- [Drive API 使用限制與 2026 配額模型](https://developers.google.com/workspace/drive/api/guides/limits)
- [Drive API 權限範圍](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Supabase 對外流量包含 Edge Functions 回應](https://supabase.com/docs/guides/platform/manage-your-usage/egress)
