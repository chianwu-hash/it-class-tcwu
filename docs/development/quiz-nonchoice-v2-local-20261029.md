歷史紀錄：本文描述 2026-10-28／29 當時狀態，後續已由正式功能取代，現況以 main 與最新發布紀錄為準

# 非選題第二版：本機交易與固定版本

日期：2026-10-29。使用者在五組互動試作後同意「照這方向發展」。延續本機試辦；沒有正式發布、上傳媒體、變更正式學生資料或批次轉錄其他試卷。

MEMKEY:考前練功坊-考古題前處理-cian請益

入口：<http://127.0.0.1:4411/>。服務保留運行，瀏覽器已另開空白作答。

## 本輪完成

- `shared/quiz-nonchoice.mjs`：獨立且需明確選用的契約候選，驗證五種題型、完整欄位、原代號、集合與排序差異、圖片雜湊和正規化座標；抽出可重用判分。未讓既有schema1匯入器接受本機格式。
- `automation/nonchoice-pilot/persistent-store.mjs`：使用專案已安裝PGlite，在輸出目錄建立本機PostgreSQL資料庫，未安裝依賴。獨立`nonchoice_candidate` schema；版本、作答、整組收據與逐欄答案分表。
- 每組收據及逐欄答案在同一交易內寫入，途中任一欄失敗全部回滾。同一作答鎖定後驗證；原request及相同標準化作答重送只回既有結果。換答案或跨組重用request拒絕。
- 作答開始時固定完整模型版本。新版本只用於新作答；舊作答從資料庫原版本載入。版本資料禁止更新或刪除，同版本ID內容不同拒絕啟動。
- 既有cookie可在服務停止重啟後接回。「重新試作」建立新作答，舊測試紀錄留在本機。未使用localStorage。
- 集合代號從模型讀取。畫圖仍為`self_checked`，正確與分數均null，不發葉片。

模型`modelSchema:2`是本輪獨立候選契約，不是既有正式系統已支援的schema2。`DemoStore`保留作為純判分測試及交易內重建狀態；HTTP服務已改走持久資料庫。

## 驗證證據

```powershell
node --test automation/nonchoice-pilot/engine.test.mjs automation/nonchoice-pilot/persistent-store.test.mjs automation/tests/quiz.test.mjs automation/tests/quiz-native-content.test.mjs
```

17項全部通過：8項原型判分、4項模型／資料庫測試、5項既有SQL及圖文回歸。資料庫測試刻意在第五欄觸發例外，確認收據與前四欄均回滾；測試錯答保存、重送不新增、集合逆序等價、畫圖null、磁碟重開、兩版本答案不同及版本禁止覆寫。

首次真資料庫測試抓到JSONB調整物件鍵順序，造成字串比較誤判重送衝突。已改成深層內容比對，保留排序陣列的順序意義；修正後整套通過。

租約Chrome驗證五組實際送答、回應遺失後同包重送、刷新接回、滑鼠與鍵盤標示、參考圖鎖定。1280及390寬度共10畫面無溢出、破圖、JS錯誤或外部請求。實際停止服務程序再重啟，原瀏覽器cookie成功接回五組、12/12與畫圖狀態；接著另開新作答供使用者試用。租約已釋放。

證據相對位置：`automation/output/past-exams-113-114-1/pilot/dingxi-114-1-g3-exam1-science/interactive/qa-v2/`：

- `browser-results.json`、桌機／手機截圖：完整互動驗證。
- `restart-resume.json`：實際服務重啟接回。
- `integrity.json`：7份既有題庫／登入／SQL檔及中立來源題庫與本輪基準SHA一致。工作區其他既有修改保留，不能據此宣稱整個repo乾淨。

## 邊界與下一步

目前只有同一份自然試卷的五組互動。來源仍為已核對原卷；3個官方答案疑義繼續阻擋，沒有猜補。新舊版本固定與交易在本機PostgreSQL成立，尚未接上正式Supabase RPC、RLS、學生帳號、進度、錯題或獎勵。

本機cookie只是合成作答識別；清除cookie後沒有正式登入可取回。沒有正式保留期限／清除介面。HTTP靜態白名單與畫圖參考路由仍對應這份固定小樣；未驗證跨版本換圖、私有媒體授權或舊參考圖保留，不能宣稱媒體版本管理完成。

下一步以這個模組設計正式雙版轉接與教師預覽，先補正式權限／安全投影、媒體按版本保存、組級計時及舊場次相容方案。所有正式資料流程仍須經完整驗證；不可直接匯入私有fixture。未commit、push或部署。
