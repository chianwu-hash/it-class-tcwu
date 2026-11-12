# 計算紙單列工具與貼紙外框：本地驗證

2026-11-12，使用者再次框出標題／工具兩列與底部空白，要求再縮小。沿用僅本地、禁止發布的限制。

從最新origin/main b3f9d76另建scratchpad-singlebar-20261112，帶入前兩版本本地提交，舊8913／8914預覽保留作對照。

## 變更

- 標題改為視覺隱藏，仍供dialog的aria-labelledby與工具列tooltip識別題目。
- 六色筆、橡皮擦、復原、清除與X合成唯一頂列。桌機按鈕24px、手機／觸控30px；極窄視窗僅筆色區可橫捲，復原、清除與X保留在右邊。
- 移除底部短提醒與內距，保存限制保留在dialog的aria-description及計算紙入口tooltip。
- 底部空框來自手動拉高外框、SVG仍維持原比例；現在外框height:auto並只允許橫向調整，畫紙隨寬度等比例調整，框底貼齊畫紙，避免額外拖出空白。沒有拉伸或改寫原筆跡資料。
- 共用editor新增可選toolbarHost，個人計算紙把原工具放入頂列；未提供時保留原夥伴畫板結構。destroy同步清除外置工具，防止切題後重複累積。原畫筆／擦除／復原／清除及資料上限不變。

## 驗證

19項共用模型、語音附件、既有study權限／課本導航／四課程建置與21產物核對通過。瀏覽器完整60項通過：1280桌機、390手機實際滑鼠／觸控、每題及題組草稿隔離、查課本／送答保留、登出清空、夥伴共用核心，以及單列高度不超過38px、工具區在畫紙上方占高少於40px、紙底與框底差距小於3px。另直接模擬inline height=600px，確認不再留下底部空白；桌機改尺寸後切手機仍適配。

首輪測試的X selector原本選所有header buttons，工具搬入header後應選直屬關閉button，已修正測試並完整重跑通過。最終60項結果及桌手機截圖在本工作樹ignored `.chat-mode/shared-scratchpad/`。

未push、PR、部署或修改正式DB、學生作答、教材／考古卷enabled。草稿仍只留當頁，重整或登出清除。

## 最新試用

僅綁127.0.0.1:8915，前版8914不會自動變成新版。

- 一般題：`http://localhost:8915/grade3/115-1/quiz.html?cloud=1&session=00000000-0000-4000-8000-000000000001&preview_study=1&preview=preview-scratchpad-singlebar-user`
- 考古卷：`http://localhost:8915/grade3/115-1/past-exam.html?paper=synthetic&preview_study=1&preview=preview-scratchpad-singlebar-past-user`

保留本工作樹與8915服務供使用者驗收。本輪不授權發布；後續仍須從最新main整合及走正式PR／發布流程。
