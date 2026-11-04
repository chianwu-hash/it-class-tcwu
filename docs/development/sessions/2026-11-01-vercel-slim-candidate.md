# Vercel 瘦身候選與正式站保護

後續已獲授權完成雲端預覽，見 [預覽驗收](2026-11-01-vercel-slim-preview.md)。本文件以下為本機候選階段紀錄。準備工具已追加正式短／長別名一致性保護，目前共 6 項測試通過；同步發布導致別名不一致時會中止，不能直接用舊候選發布。

本次依使用者「瘦身不能影響正式站」指示，只準備本機候選與驗證工具，沒有部署、刪除部署、變更 Vercel 設定或改動學生資料，也沒有提交／推送 Git。

## 本批範圍

- 正式基準：`dpl_8RRMxcuQ9ozADDWWC77BgYF5isFa`，773 個來源檔。
- 候選：741 檔；740 個保留檔案 SHA-1 與正式來源完全相同，只有 `.vercelignore` 更新。
- 排除 16 張未找到引用的 PNG：32,389,602 bytes（32.39 MB）。
- 排除 16 份原本公開網址即 404 的 S091／S092 課本來源 PDF：231,820,219 bytes。
- 乾跑來源總量從 299,530,027 bytes 降至 35,320,765 bytes，約 35.32 MB。這是來源上傳清單差異，不是精確帳務回收量。
- 原先 17 張圖片候選中的 `grade3/115-1/images/week01/week01-computer-lab-rules-v2-01.png` 被公開教案 `grade3/LessonPlan/115-1/Week 01.md` 引用，本批已保留。
- HTML、JS、CSS、API、正式中英打依賴、教案與教材下載檔沒有更新或刪除；不整包排除 prototypes。

## 工具與固定政策

- `automation/vercel-slim-policy.json`：32 個精確路徑、原始大小與 SHA-1，以及必要保留檔案。
- `automation/prepare-vercel-slim-release.cjs`：以目前正式 API 來源樹核對指定發布快照，產生獨立候選並執行真正 CLI dry-run。沒有任何部署、promote、刪除或資料庫操作指令。
- `automation/tests/vercel-slim-release.test.cjs`：保護機制測試。

工具會在以下情況中止：團隊或專案錯誤、正式部署 ID 改變、來源檔案不符正式雜湊、排除檔已被修改、教案／文字／程式碼出現被排除檔名、必要檔案缺失、來源有符號連結、候選範圍重疊／已存在、乾跑多傳／漏傳／雜湊改變、查核前後發布目標或最新部署發生變化。

候選只從正式 manifest 逐檔複製，不複製快照內額外檔案，也不把主工作區整包發布。相容排除模式寫入候選的 `.vercelignore`，避免凍結快照沿用舊規則。主工作區 `.vercelignore` 沒有在本次改動；未來若跳過此工具直接發布其他資料夾，這些保護不會自動套用。

## 使用方法

先唯讀取得當下正式部署 ID 與完整來源快照。不要把下方歷史 ID 當成永遠有效。

```powershell
node automation/prepare-vercel-slim-release.cjs --source <目前正式來源快照的絕對路徑> --out <尚不存在的獨立候選資料夾> --production <當下正式dpl_ID> --report <驗證JSON絕對路徑>
node --test automation/tests/vercel-slim-release.test.cjs
```

預設沿用已登入的全域 Vercel CLI，也可用 `--cli <vercel/dist/index.js絕對路徑>` 明確指定。工具只執行 GET API 與 `deploy --dry --json`；`--dry` 不建立正式或預覽部署。

## 已完成的驗證與下一道界線

1. 重新向 Vercel 取得正式來源樹，773 個來源檔逐一比對本機 SHA-1，全部相同。
2. 同時掃描 HTML、JS、MJS、CJS、CSS、JSON、SVG、webmanifest、Markdown、TXT；包括 URL 編碼及 Unicode escape 的檔名。
3. 真正 dry-run 確認恰好排除這 32 檔，其他 740 檔完全相同；必要 API、三／四／六年級入口、認證、測驗、中英打與被教案引用的圖片全保留。
4. 查核前後正式部署與最新部署 ID 相同。本輪不做登入後的正式作答、儲存、寵物訪問等會產生資料的驗證。
5. 五項保護測試通過，涵蓋換正式基準、團隊錯誤、教案編碼引用、錯誤路徑／來源類型、乾跑漏檔／多檔／雜湊變更，以及被教案引用圖片的保留。
6. 將 32 個排除路徑以測試檔重新放進獨立目錄，用 Windows CLI 真正乾跑：32 檔全數排除，教案引用的 v2 PNG 與 index.html 仍保留。這項檢查排除「只是候選已刪檔，規則本身其實沒作用」的假成功。

目前只能確認本機候選的來源差異與乾跑範圍，尚未做雲端建置或完整登入情境驗收。未來需要發布時，先重新核對當下正式基準、依新基準重建候選，再依使用者授權安排預覽驗收；不得直接 promote 舊候選。公開外部直接連結及任意動態組路徑不能僅靠檔名字面掃描完全排除，因此本輪不宣稱「已證明未來上線絕無影響」。既有正式站此次完全未動。

## 本機證據

- 最終候選：`D:/ai-browser/logs/vercel-slim-candidate-20261101-verified/`
- 來源與乾跑驗證：`D:/ai-browser/logs/vercel-slim-audit-20261101/slim-verification.json`
- 同名附加檔 `.dry-run.json`、`.baseline-tree.json` 保留實際發布清單與遠端來源 manifest。
- 初始盤點：同資料夾 `瘦身盤點.md`、`public-head.json`。
- Windows 排除規則實測：同資料夾 `rule-probe.json`。

這些發布快照與原始證據不應整包加入 Git。
