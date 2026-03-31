# 圖像與首頁預告卡 SOP

更新日期：2026-03-31

## 1. 資訊圖卡預設規格

- 用途：教學網站資訊圖表 / 投影圖
- 輸出尺寸：`1920x1080`
- 輸出格式：`WebP`
- 品質：`q80`
- 命名格式：`weekXX-infographic-1920x1080-q80.webp`

## 2. 資訊圖卡標準流程

1. Gemini 原圖先放到本機可處理路徑，例如 `C:\Users\user\projects\tmp`
2. 先縮圖輸出成 `1920x1080 WebP q80`
3. 再複製回專案對應週次資料夾，例如 `grade3/images/week08/` 或 `grade6/images/week08/`
4. 上傳到 Cloudinary
5. 網頁正式使用 Cloudinary 正式網址，不直接吃原始大圖
6. 如需比對效果，可暫留本地預覽版，但正式上站以 Cloudinary 版為準

## 3. Windows 路徑注意事項

- Windows 下若 Python 直接處理含中文路徑失敗，先輸出到 ASCII 路徑，例如 `C:\Users\user\projects\tmp`
- 之後再複製回專案資料夾

## 4. 首頁灰卡預告 SOP

用途：首頁課程卡片區的「下週預告」占位卡，不是完整課程頁，也不是正式資訊圖表。

適用範圍：
- `grade3/index.html`
- `grade6/index.html`

規則：
- 預告卡放在首頁卡片區最末端
- 視覺上使用灰色、虛線框、低彩度樣式
- 只做 `敬請期待 / 下週新任務準備中` 類型文案
- 不提前寫太多課程細節
- 不需要另外做完整資訊圖卡，除非之後真的有需要
- 當下一週正式上線時：
  - 把原本「本週最新」標籤從上一週移除
  - 將新週次卡片改成正式彩色卡片
  - 再補上一張新的下一週灰卡預告
- 以上流程三年級與六年級首頁都相同

建議文案：
- 標題：`敬請期待`
- 說明：`下週新任務準備中。`
- 標籤：`即將解鎖`

## 5. 三年級 week08 成品

- 本地壓縮檔：`grade3/images/week08/week08-infographic-1920x1080-q80.webp`
- Cloudinary：`https://res.cloudinary.com/dmqmjfqng/image/upload/v1774936821/it-class-tcwu/grade3/week08/week08-infographic-1920x1080-q80.webp`

## 6. 六年級 week08 成品

- 本地壓縮檔：`grade6/images/week08/week08-infographic-1920x1080-q80.webp`
- Cloudinary：`https://res.cloudinary.com/dmqmjfqng/image/upload/v1774848035/it-class-tcwu/grade6/week08/week08-infographic-1920x1080-q80.webp`
