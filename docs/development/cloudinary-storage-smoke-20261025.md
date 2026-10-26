# Cloudinary 同圖試傳與分工評估

日期：2026-10-25。使用者要求將 Supabase 已試傳的同一張圖片上傳既有 Cloudinary，比較讀取效果與存取控制。

## 目前狀態

已完成 API 試傳。使用者明確指示使用 Cloudinary API，無須網頁登入。沿用 `tools/cloudinary_upload/.env`，核對產品環境 `dmqmjfqng` 並以該環境 Admin API `ping` 驗證憑證有效後，上傳同一張圖片的公開及受保護兩個副本。沒有輸出或另存金鑰，也沒有變更全域帳號設定。先前要求登入網頁的限制已撤除；後續沿用既有 API 工作流程。

Supabase 既有結果為：私有桶簽署下載成功，PNG 原檔 SHA-256 相同；公開及未簽署讀取均拒絕，詳見 [Supabase 試傳紀錄](supabase-storage-smoke-20261025.md)。不能將其當作 Cloudinary 的測試結果。

## 實測結果

| 測試 | Supabase 私有桶（前次） | Cloudinary 公開 upload | Cloudinary authenticated |
|---|---|---|---|
| 原圖下載 | 簽署網址 HTTP 200 | 匿名 HTTP 200 | 簽章網址 HTTP 200 |
| 內容完整性 | SHA-256 相同 | SHA-256 相同 | SHA-256 相同 |
| 尺寸／大小 | 1746 × 1167／26,432 bytes | 完全相同 | 完全相同 |
| 未簽署原圖 | HTTP 400 拒絕 | 公開讀取成功 | HTTP 401 拒絕 |
| 未簽署縮圖 | 本次未測 | 本次未測 | HTTP 401 拒絕 |
| 改成公開路徑 | 本次未測 | 不適用 | HTTP 404，無法繞過 |

Cloudinary 兩個回傳 PNG 均成功解碼，受保護版下載圖亦已目視確認。單次原圖下載時間分別為公開約 450ms、受保護約 956ms；這是兩個不同 CDN 路徑的首次小圖讀取，沒有同時量測 Supabase，不能據此排名服務速度或推估整班流量表現。

本次 Cloudinary 新增兩個各 26,432 bytes 的原始物件，分別以 `-upload`、`-authenticated` 結尾，保留供後續核對。一般公開圖片網址可分享；受保護圖片的簽章網址只在記憶體使用，未寫入紀錄。結果、下載圖在 Git 忽略的 `qa/cloudinary-smoke/`。

## 試驗流程

Git 忽略資料夾 `automation/output/quiz/hanlin-fractions-local/cloudinary_smoke.py` 已執行，API 環境驗證、上傳及上述讀取測試全部完成。輸入與 Supabase 完全相同：26,432 bytes、1746 × 1167 的 PNG，SHA-256 為 `3ee2d8e12d7bed742997d59b342dcd9d9d3e89bd8852f254f48e9c7e3bc59ca0`。

- 在獨立日期測試資料夾新增一般 `upload` 與 `authenticated` 兩個副本，使用不同識別避免公開副本干擾保護測試，不覆寫既有圖片。
- 比對下載雜湊、圖片尺寸與完整解碼；記錄單次讀取時間作診斷，不以單張小圖宣稱速度優劣。
- 一般副本測試匿名讀取；保護副本測試未簽署原圖、未簽署縮圖、錯誤公開路徑與正確簽署原圖。
- 金鑰及受保護圖片的簽署網址僅在程序記憶體使用，紀錄只保留安全欄位。

## 依實測提出的分工（使用者已確認）

使用者後續明確要求「先記錄這個分工方式」，確認公開教材沿用Cloudinary、受控題目與解析使用Supabase私有Storage、本機保留來源備份，並授權原10題雲端圖片本機試答。後續API及試答紀錄見[quiz-cloud-trial-20261025.md](quiz-cloud-trial-20261025.md)。以下保留分工理由。

公開教材、課程插圖可評估沿用既有 Cloudinary；需依學生作答狀態揭露的題目與書商解析圖，優先評估 Supabase 私有 Storage 與既有驗權後端整合。原始文件及核對用圖片繼續本機封存，單純分數公式繼續網頁呈現。

Cloudinary `authenticated` 已於既有帳號實測可用，因此它也能承載受保護題庫圖片；建議目前優先以 Supabase 作為受控題庫素材服務，是為了接續現有登入、作答及揭答驗權架構，並非 Cloudinary 無法保護圖片。兩者圖片顯示品質相同，毋須為清晰度重複保存兩份雲端正式素材。

Cloudinary 官方文件指出：一般 `upload` 是公開圖片；`private` 保護原圖，但衍生版本預設可能公開；`authenticated` 保護原圖及衍生圖，須使用簽署網址。一般簽章 CDN 網址不會自動附上到期時間；另有可到期的 API 下載網址，但官方不建議用來嵌入網站，該方式無 CDN 快取且流量計費較高。不能直接把一般簽章 CDN 網址當作 Supabase 短效網址的等價替代。

兩邊的簽署網址在有效期間都可能被轉傳，不能等同每次讀取都驗證學生身分或作答狀態，須由應用程式控制發放；目前尚未串接真實學生揭答流程。本次未測 Cloudinary 到期網址或進階 token／cookie 功能，也未完成整冊容量、帳號配額或成本評估。

來源：[Cloudinary 媒體存取控制](https://cloudinary.com/documentation/control_access_to_media)、[網址簽章](https://cloudinary.com/documentation/delivery_url_signatures)。
