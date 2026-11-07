# 夥伴紀念葉花成長動畫

Claude Opus 5.5 透過使用者指定的 Computer Use／Claude Desktop 完成第一版設計與寫檔；Codex 整合驗證，再交由同一模型複核通過。

## 呈現

地面弧線與金色種子出現，莖沿曲線長高。紀念葉左右舒展、葉脈與金邊亮起；紀念花從花苞依序展開五瓣，再點亮愛心花蕊、短暫暖光與少量星光。一次約3.2～4.4秒後停在完整姿態，無聲、無循環、無計時器。

10題1片紀念葉、20題2片、考古題1朵花，僅以後端award的數量繪圖。每片紀念葉的雙葉造型是既有努力樹識別，不把兩片葉瓣誤算成兩份獎勵。路徑、金邊與花瓣色彩對應既有 partnerKeepsakeSvg。

## 整合與保護

- 新場景 `shared/partner-pilot/keepsake-growth.mjs` 提供純SVG組成及可停止的WAAPI播放器；learning沿用既有awardTracker。
- 全員送答／共同回顧、後端確認完成與發獎後才自動慶祝；未達標沿用訂正提示。沒有修改發獎、判分、資料庫或個人練習。
- 新獎在沒有未送訂正時僅捲到可見處，不移動鍵盤焦點；重播沿用明確按鈕與焦點流程。
- 紀錄冊的「重播紀念慶祝」只操作呈現，不送領獎RPC，不重複加葉花。隊友同步不重播，舊獎重進不自動當新獎。
- 關閉、換房、退出取消動畫及待執行的捲動；停止／完成都移除動態與可見性監聽。舊輪Promise以身分比較，不會清掉新輪。
- prefers-reduced-motion、背景或不支援WAAPI時直接顯示完整靜態圖；中途切reduce／背景亦停止，返回不補播。手機維持圖文排列與可見控制項。

## 驗證

37項可見Chrome合成瀏覽器使用實際createLearningUI，檢查一葉、兩葉、花、真實播放與停止、同步DOM／起始時間不變、重播不發action或變更award、舊獎、減少動態中途切換、清理、未達標、390px與pageerror0。13項既有Node／隔離SQL涵蓋回顧結算、訂正補達、葉花、紀念重播與第二級來源hover；2項新Node驗證SVG數量／識別與靜態fallback。

Claude Opus 5.5第二輪核對實檔，確認生命週期、獎勵門檻、版本鏈與不遮擋答題，複核通過。仍未做正式Google學生雙機、Safari／iPad或實體平板測試。

合成預覽：`node automation/keepsake-growth-preview.mjs`（8858）；實際learning整合合成預覽：`node automation/keepsake-growth-integration-preview.mjs`（8859）。兩者皆無正式登入／DB／RPC代理。
