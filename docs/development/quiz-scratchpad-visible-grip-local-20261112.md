# 計算紙固定可見調整鈕：本地驗證

2026-11-12，使用者回報左下縮放角不見。從最新origin/main b3f9d76另建scratchpad-visible-grip-20261112，帶入未發布本地原型，仍禁止上線。

取消依賴瀏覽器原生resize角標，新增明確的左下22px斜向箭頭按鈕；固定於外框左下、在畫紙上層，不占底部版面，拉大外框仍可見。游標維持nesw-resize（↙／↗），Pointer Capture以水平拖動差值調整寬度，右側固定、畫紙等比例；寬度限制在最小300px與目前視窗內。放開、取消、失去capture或關閉畫板皆解除拖曳狀態。

方向改回一般ltr，無原生控制角與捲軸留白。新增按鈕有aria-label、tooltip、鍵盤左右鍵調整（向左加寬、向右縮窄）；手機維持不顯示大小調整控制。原單列工具、X、筆跡、題目／題組草稿隔離及僅當頁保存不變。

68項桌手機瀏覽器檢查通過：箭頭初始可見、nesw游標、實際左下拖曳加寬、右邊界固定、放大後仍在左下可見、原筆跡不失、鍵盤調整；以及既有滑鼠／觸控畫寫、工具、切題／課本／送答、登出清除、夥伴共用核心、手機尺寸回歸。21產物核對與git diff --check通過。最終證據在本工作樹ignored `.chat-mode/shared-scratchpad/`。

最新本機服務只綁127.0.0.1:8918；8917及之前為前版對照。

- 考古卷：`http://localhost:8918/grade3/115-1/past-exam.html?paper=synthetic&preview_study=1&preview=preview-scratchpad-visible-user`
- 一般題：`http://localhost:8918/grade3/115-1/quiz.html?cloud=1&session=00000000-0000-4000-8000-000000000001&preview_study=1&preview=preview-scratchpad-visible-normal-user`

保留本工作樹與8918服務供驗收，未push、PR、部署或改正式資料。草稿仍只留當頁、重整／登出清除，不接雲端或AI。
