# 答題動畫：Codex與Claude Opus 5.5討論及預覽

日期：2026-10-25。使用者要求與Claude討論動畫作法，必要時交由Claude Opus 5.5製作。透過 `chat-mode` 技能與Claude Code訂閱CLI合作；專案仍由Codex唯一寫入，Claude沒有專案寫入工具、Bash、網路、憑證或部署權限。

## 採用的方向

目前的角色主要將整張SVG位移或旋轉，容易看起來像移動圖示。兩方同意改為原創角色的身體、耳朵、眼睛、嘴、腮紅與手分開動，透過時間差呈現生命感。選擇原生SVG＋CSS，因為兩段短回饋不需要另外引入播放器；不以未驗證的套件固定大小或素材製作工具限制作為理由。

| 結果 | 動作節奏 | 文字與教學內容 |
|---|---|---|
| 答對 | 預備壓縮→跳起→落地回彈→揮手，眼睛轉彎眼，少量彩點，約1.3秒 | 立即顯示結果、原創鼓勵語及解析，不等待動畫 |
| 答錯 | 好奇眼神→輕傾與指向解析→線索燈泡→溫柔點頭，約1.4秒 | 保留尊重與自主選擇，不責備、不哭泣或做懲罰動作 |

角色不使用版權卡通，回饋不增加連勝、排名、音效或新的計分規則。鼓勵語不偽稱阿德勒名言。減少動態時顯示各自的最後靜態姿勢；切換設定或隱藏頁面時立即取消。只有明確的收尾事件才能移除播放class，避免第一個耳朵或手的動畫結束就提前清理。

## 本機預覽與界線

預覽：`http://127.0.0.1:4346/animation-workshop.html`。可分別重播兩種動畫、切換減少動態效果，桌機兩欄、手機一欄。題目與解析為明示的自製示意，不是書商原題或原解析；不連接測驗API，不寫作答紀錄。檔案在Git忽略的 `automation/output/quiz/ui-research-20261025/animation-workshop.html`。

本輪只製作動畫比較預覽，尚未把這組新角色取代真實測驗中的既有角色；4345真實題庫仍沿用上一輪已驗證的回饋。未變更判分、選項打亂、身分、揭答權限、圖片儲存或部署。

## 協作證據與未完成狀態

- 技能：`C:/Users/user/.codex/skills/chat-mode/SKILL.md`。
- Claude Code 2.1.289，訂閱OAuth；僅在本次子程序設定 `ANTHROPIC_MODEL=claude-opus-5-5`，未切API計費。自本輪精確session的assistant model欄位核對為 `claude-opus-5-5`。[官方Opus 5.5說明](https://www.anthropic.com/claude-opus-5-5)。
- 證據包：`.chat-mode/review-packets/quiz-animation-20261025/`，只含介面程式與需求；獨立臨時Git基線不涉及主專案提交。唯讀工具不等於OS讀取路徑隔離，已向使用者說明限制並禁止無關讀取。
- Session `20261025-quiz-animation-opus55`。首輪設計討論completed，6個內部turn、約112秒，四個檔案閱讀；Codex已核對其建議與實際程式。未把Claude沒有執行的視覺測試算作完成。
- 第二輪以原session續談，要求Claude撰寫完整HTML並經回覆交付，Claude仍無寫入權。約300秒時在HTML已閉合、補充說明尚未結束的階段timeout，缺少完成marker；run狀態為failed，不能稱為成功交付或驗收通過。完整HTML從未驗證的live草稿擷取，保留原始證據，由Codex靜態檢查及瀏覽器獨立驗證後才提供預覽。沒有繼續失敗session或假造Claude最終回覆。
- 兩輪viewer均已確認啟動；臨時證據庫Git前後一致，主專案HEAD／branch／status與委交基線一致。原型由Claude撰寫，儲存、審查與瀏覽器驗證由Codex進行。

Claude首輪尚未看過實際動畫，也未讀學生入口與完整渲染模組；「外層隱藏可能重播」只是待驗證風險。本輪原型有明確的結束清理及分頁隱藏取消，但不代表真實學生頁所有生命週期已完成整合。

## Codex獨立驗證

瀏覽器實測：答對18個部位動畫、答錯11個部位動畫，均為單次且正常結束；播放class隨收尾事件移除，無持續運行動畫。快速連按重播不疊加，勾選及系統減少動態設定皆不播放；合成visibilitychange驗證停止（不等同真實長時間背景節流測試）。390px無橫向溢出，桌機與手機截圖已目視核對；無頁面JS錯誤、無外部請求。原始完整HTML約22KB。

目視發現隱藏分頁取消後，狀態文字仍稱「正在播放」。Codex僅補上停止時的狀態文字同步，保留Claude原版於 `animation-workshop.claude-original.html`；其餘圖形、動作與程式皆來自Claude草稿。驗證腳本 `verify_animation_workshop.cjs` 及報告 `animation-workshop-report.json` 在相同輸出目錄。這是Codex驗證過的預覽，不回溯宣稱Claude第二輪成功完成。
