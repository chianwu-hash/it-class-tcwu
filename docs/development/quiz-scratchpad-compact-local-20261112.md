# 計算紙工具列精簡：本地驗證

2026-11-12，使用者要求說明與按鈕盡量縮小、畫紙面積優先，「收起計算紙」改為X。本輪仍禁止上線。

從最新origin/main b3f9d76新建scratchpad-compact-20261112，帶入已完成但尚未發布的共用畫板a395bdf後調整，沒有直接沿用舊工作樹修改。

## 介面調整

- 標題縮為13px、減少標題列及內距；關閉只顯示×，保留「收起計算紙」的aria-label、tooltip與鍵盤焦點。
- 六色筆、橡皮擦、復原與清除合成緊湊同排工具列。桌機按鈕28px，手機／粗略指標36px，工具圖示同步縮小；窄螢幕有必要才換行。
- 原頂部長提醒改成畫紙下方11px「重整／登出會清除」。完整意思保留在tooltip。
- 一般畫圖操作說明不再占可視版面，保留讀屏status；筆畫到70筆時才顯示容量提醒。沒有更動80筆上限或繪圖模型。
- 保持原畫紙比例與正規化筆跡，不以拉伸畫紙扭曲原有算式／圖形；減少工具列及留白，使畫紙可完整露出。畫板原筆色、整筆擦除、復原、清除確認與草稿隔離不變。
- 變更均限.quiz-scratchpad-dialog，夥伴練功原畫板工具尺寸不變。

## 驗證與限制

21生成產物核對及git diff --check通過。原50項桌機1280／手機390瀏覽器回歸通過，再加入每個尺寸5項精簡版檢查，最後完整60項通過：X按鈕、標題列不超過46px、工具區高度減少、整張畫紙露出、短提醒在畫紙之後；保留滑鼠／真實CDP觸控、筆色、橡皮擦、復原、清除、切題／課本／送答保留、換人清空、桌機調整後切手機及夥伴共用核心回歸。

草稿仍只存當頁，重新整理／登出清除。不接AI、雲端草稿或正式資料。未push、未建PR、未部署，也未修改正式網站／資料庫／教材或考古卷enabled。

## 新版本機試用

本機服務只綁127.0.0.1:8914；8913保留為前版對照，不能只重新整理8913就當成新版。

- 一般題：`http://localhost:8914/grade3/115-1/quiz.html?cloud=1&session=00000000-0000-4000-8000-000000000001&preview_study=1&preview=preview-scratchpad-compact-user`
- 考古卷：`http://localhost:8914/grade3/115-1/past-exam.html?paper=synthetic&preview_study=1&preview=preview-scratchpad-compact-past-user`

公開測試程式automation/tests/quiz-scratchpad-browser.cjs預設8914，也可由SCRATCHPAD_PREVIEW_ORIGIN指定本機合成服務。最終60項證據與桌手機截圖位於本工作樹ignored `.chat-mode/shared-scratchpad/`，本輪工作樹與服務保留供使用者驗收。
