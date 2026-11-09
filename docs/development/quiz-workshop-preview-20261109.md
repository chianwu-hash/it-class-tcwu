# 跨校答題比較預覽與設定化補修

## 本輪交付與前輪正式版的區別

前輪 PR120／121／122 的共用答題框架、單選呈現與生成式入口已於 2026-11-08 正式發布，來源 `d7b9ff8`、部署 `dpl_AvkasWz4M8ZnWSsG632dPwxnJi27`。本輪從最新 `origin/main 803986b` 接續，沒有另做一套仿製答題介面。

使用者先要求比較預覽，之後已明確接受並授權「可以上線」。本輪真正待發布的 runtime 差異限於補齊學校／年級設定：

- `workshopNavigation()` 集中品牌標籤、選卷／課程首頁／努力樹的課程路徑，經既有 bootstrap 傳給原年級 navbar。三種模式使用同一資料；未帶設定的舊課程頁保留既有 navbar fallback，登入事件仍走 `initNavbarAuth()`。
- 考古題入口能力與各校考古區說明移至 `quiz-workshop-config.mjs`，移除 library 控制器中的九年級校名及年級陣列分支。
- 重建四課程16個入口與模組指紋。沒有改題庫、原卷版本、RPC、Auth、名冊、草稿、進度、訂正、計獎或紀念動畫。

**比較台、合成登入、fixture RPC、測試傳輸全部位於 `automation/`，依既有排除規則不會部署。** 不為純預覽或文件單獨重建正式部署；本輪發布只涵蓋上述真實 runtime 補修。

## 單一比較入口

- 使用者預覽：<http://localhost:8872/>
- 工作樹：`D:/projects/it-class-tcwu-worktrees/quiz-workshop-preview-20261109`
- 可切換頂溪三／六、土城四、中正九，以及一般答題／個人考古題／夥伴練功；夥伴另可比較一般單題與完整原卷段落。
- 可用自動寬度、1280px 桌機或390px手機模式；身分甲／乙及各年級分別隔離。重設按鈕僅清本輪、本年級合成狀態。
- 使用者成果分頁已開啟並標記保留。伺服器仍在服務預覽，不能清理這個 worktree。

`workshop-preview.html` 只提供控制列與 iframe，iframe 載入這次產生的真正年級頁面及既有入口／控制器／adapter：

| 預覽模式 | 真實前端路徑 | 僅本機替代部分 |
|---|---|---|
| 一般答題 | quiz-student → quiz-module → quiz-server → workspace／choice | 合成身分與 fixture transport 回傳場次快照 |
| 個人考古 | quiz-past-entry → quiz-module past 分支 → quiz-past-exams → quiz-past-ui | 合成 paper／attempt／group／field 及本機草稿快照 |
| 夥伴練功 | partner-pilot/app → 原邀請解析／snapshot／mutate → learning／camp／review | 合成 room、revision、題目與隊友進度；不手動把另一套 learning UI 掛進頁面 |

## 可操作範圍

可選答、送出、核對正誤與固定解析、換下一題或題組；原卷勾選保留整組多欄位。夥伴可從原 app 進入小隊、送答、訂正、開共同營地並傳合成小紙條，之後看共同回顧。夥伴原卷兩個欄位保留同一段落；沿用原 qid／room 提交方式，沒有擅改為個人 group RPC。

草稿與合成歷次作答只保存在本機服務記憶體，切換回同一範圍可接續；服務重啟會清空。fixture 模擬判分與同意回顧，不發放正式葉花，不能拿來證明正式計獎政策已重新實測。比較台清楚標示「不是正式登入」，不讀取真實試卷或學生紀錄。

## 隔離與驗證方式

本機只監聽 loopback；RPC endpoint 驗證相同 localhost origin，不代理正式 API。CSP 的 `connect-src 'self'` 進一步禁止本機頁面連正式資料服務。所有正式程式透過原 transport 介面取得合成結果，不在產品程式加入試用登入開關。

瀏覽器測試用新命名空間，不碰使用者成果分頁或其合成進度。預覽測試真正操作 iframe 內控制器，檢查 room／qid packet 與共同回顧，不以同外觀靜態圖或手動掛載 UI 代替。

可重跑：

```text
npm run quiz:preview
node --test automation/tests/quiz-workshop.test.mjs
node automation/build-quiz-workshop.mjs --check
```

`automation/tests/quiz-workshop-preview-browser.cjs` 須經共享租約的 `D:/ai-browser/run-background.cjs` 執行；`WORKSHOP_PREVIEW_URL` 可指定獨立驗證伺服器，使用者的8872成果服務保持不動。既有350項 `quiz-workshop-browser.cjs` 也支援該環境變數，避免誤驗舊預覽。

未驗證：正式 Google 雙帳號、真實多人即時同步／斷線、正式資料庫原卷全題判分、真實獎勵新增／紀念播放、實體觸控／IME／Safari／iPad、錄音與附件上傳。兩套舊原卷 SQL 測試仍缺私人 document 題包，不計為通過。合成夥伴預先完成部分題目與回顧，不能冒稱真人雙機驗收。
