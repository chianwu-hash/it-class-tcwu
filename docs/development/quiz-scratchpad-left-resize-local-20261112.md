# 計算紙左下調整角：本地驗證

2026-11-12，使用者指出計算紙右下的大小調整控制應放左側。從最新origin/main b3f9d76新建scratchpad-left-resize-20261112，帶入尚未發布的計算紙本地提交；仍禁止上線。

以原生CSS resize控制將拖曳角移到左下，畫板右側位置固定，往左拖曳即加寬，畫紙維持等比例且筆跡保留。外層方向控制角的位置，header／body明確保持ltr，因此工具及畫寫不反轉。外層overflow:hidden避免RTL小數像素造成額外水平捲軸與底部留白，內層body保留必要捲動；手機維持不顯示大小調整角。

公開瀏覽器腳本新增真實滑鼠從左下角向左拖120px、加寬超過60px、右邊界位移小於2px、工具／畫紙方向不變及筆跡保留；連同既有本機畫板／夥伴回歸，1280桌機與390手機完整64項通過。21產物核對與git diff --check通過，無正式DB、教材、作答或部署變更。

最新本機服務只綁127.0.0.1:8916；8915及之前是前版對照。

- 考古卷：`http://localhost:8916/grade3/115-1/past-exam.html?paper=synthetic&preview_study=1&preview=preview-scratchpad-left-user`
- 一般題：`http://localhost:8916/grade3/115-1/quiz.html?cloud=1&session=00000000-0000-4000-8000-000000000001&preview_study=1&preview=preview-scratchpad-left-normal-user`

最終證據在本工作樹ignored `.chat-mode/shared-scratchpad/`，初次捲軸診斷在本機`C:/Users/user/ai-now/scratchpad-left-resize-20261112/`。保留工作樹及8916服務供使用者驗收，不自行push、PR或發布。
