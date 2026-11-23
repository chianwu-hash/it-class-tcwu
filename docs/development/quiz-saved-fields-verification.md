# 已存作答：先核實際呈現契約

## 症狀與原因

複選題正式送答與後端讀回通過，但補拍畫面的腳本以 `.quiz-field-preview-set .preview-option` 等待已存答案，得到零列並逾時。增加等待沒有改善，因為實際 DOM 使用的是原 `fieldset.quiz-field`，保留勾選並停用 checkbox，旁邊顯示逐項核對。另一條一般預覽路徑才產生 preview-option；不能由「已存」推定呈現路徑。

## 驗證方式

先讀回實際 DOM、畫面及固定答案，再辨識原輸入欄位或預覽列。原勾選框逐項核 `isChecked()`，已存時另核 `isDisabled()`；一般預覽核選取項目的 `data-field-result`。不要把找不到列改成略過，也不要因收據已過而重送答案。已存作答必先以後端完整值比對，等值才沿用；首次收據不覆寫，重驗另存。

本批實際 DOM 與桌手機畫面證據已保存，修正後須重驗課本開頁／返回與已存答案。原失敗為驗收選擇器不符，沒有更改題目或網站渲染來迎合腳本。

Playwright 的等待會等指定元素達到目標狀態，不能讓不存在於該呈現路徑的區塊出現；先核 DOM 再選定位器。[官方 Locator 文件](https://playwright.dev/docs/api/class-locator#locator-wait-for)、[官方診斷文件](https://playwright.dev/docs/debug)。
