# 計算紙入口併入題號列：本地驗證

2026-11-12，使用者指出計算紙入口另占一整行。從最新main b3f9d76另建scratchpad-inline-entry-20261112，帶入未發布本地原型；仍僅本機、禁止發布。

一般題將按鈕放進既有題號h3，考古卷放進既有題組card-title、分數徽章之前；以28px高的小工具按鈕呈現，不再prepend在閱讀區而額外推低題目。若未來其他畫面沒有既有題號／題組列，退回右上浮動定位，仍不建立獨立一行。單列畫板、左下固定縮放鈕、筆跡與所有草稿生命週期均未變動。

72項1280／390瀏覽器檢查通過，新增一般題按鈕在題號列、考古卷按鈕在題組列及閱讀區無獨立入口的檢查；保留畫寫、切題、查課本、送答、登出清空與可見縮放鈕回歸。21生成產物與diff檢查通過。最終證據在本工作樹ignored `.chat-mode/shared-scratchpad/`。

最新本機服務只綁127.0.0.1:8919；8918及以前保留作對照，不會自動更新。

- 考古卷：`http://localhost:8919/grade3/115-1/past-exam.html?paper=synthetic&preview_study=1&preview=preview-scratchpad-inline-user`
- 一般題：`http://localhost:8919/grade3/115-1/quiz.html?cloud=1&session=00000000-0000-4000-8000-000000000001&preview_study=1&preview=preview-scratchpad-inline-normal-user`

保留本工作樹／8919服務供使用者驗收，未push、PR、部署或修改正式DB、學生作答與考古卷enabled。草稿仍只留當頁，重整／登出清除。
