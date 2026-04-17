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

## 2.1 Gemini 生圖自動化（已驗證到下載）

目前已驗證可自動化的段落：

1. 連到已登入的正式 Chrome（CDP `9222`）
2. 找到既有 Gemini 分頁
3. 切換到「生成圖片 / 建立圖像」模式
4. 送出提示詞
5. 等待圖片生成完成
6. 點擊「下載原尺寸圖片」
7. 將原始 PNG 下載到本機

腳本：

- `automation/gemini-generate-infographic.js`

使用方式：

```powershell
npm.cmd run gemini:generate-image -- --prompt-file .\tmp\week11-gemini-prompt.txt --out-dir C:\Users\user\projects\tmp --output-name week11-infographic-source.png
```

目前產物：

- 原始下載圖：預設到 `C:\Users\user\projects\tmp`
- 畫面截圖：`automation/output/gemini-generate-infographic.png`
- metadata：`automation/output/gemini-generate-infographic.json`

> 注意：這個腳本目前只負責「Gemini 生圖 + 下載原尺寸 PNG」，壓圖請接下一步的 WebP 轉檔腳本。

## 2.2 資訊圖卡壓圖腳本（已補上）

腳本：

- `automation/convert-infographic-to-webp.py`

快捷指令：

```powershell
npm.cmd run image:compress-infographic -- --input C:\Users\user\projects\tmp\week11-infographic-source.png --output C:\Users\user\projects\it-class-tcwu\grade6\images\week11\week11-infographic-1920x1080-q80.webp
```

預設規格：

- `1920x1080`
- `WebP`
- `q80`
- `cover` 模式（自動置中裁切到滿版）

可選參數：

- `--fit cover|contain`
- `--quality 80`
- `--width 1920`
- `--height 1080`

如果原圖比例不是目標比例：

- `cover`：優先滿版，會置中裁切
- `contain`：完整保留原圖，空白處補背景色

## 2.3 Cloudinary 單張圖卡上傳（已補上）

腳本：

- `automation/upload-infographic-to-cloudinary.py`

快捷指令：

```powershell
npm.cmd run cloudinary:upload-infographic -- --input C:\Users\user\projects\it-class-tcwu\grade6\images\week11\week11-infographic-1920x1080-q80.webp --grade grade6 --week week11 --public-id week11-infographic-1920x1080-q80 --overwrite
```

預設規則：

- folder：`it-class-tcwu/{grade}/{week}`
- public_id：預設取檔名，不含副檔名
- `.env`：`tools/cloudinary_upload/.env`

實測：

- 已成功上傳 week11 圖卡
- secure_url：
  `https://res.cloudinary.com/dmqmjfqng/image/upload/v1776398793/it-class-tcwu/grade6/week11/week11-infographic-1920x1080-q80.webp`

補充：

- 若只想先確認參數，不要真的上傳，可加 `--dry-run`
- `.env` 僅供本機使用，不進 commit

## 3. Windows 路徑注意事項

- Windows 下若 Python 直接處理含中文路徑失敗，先輸出到 ASCII 路徑，例如 `C:\Users\user\projects\tmp`
- 之後再複製回專案資料夾

## 3.1 中文提示詞亂碼避坑

這次實測已確認：

- **不要**把中文 Gemini 提示詞直接寫進 PowerShell inline script / here-string 再丟給 Node。
- 這樣很容易讓中文在中途被吃成 `????`，導致 Gemini 收到的是壞掉的 prompt。

正式做法：

1. 先把提示詞存成 **UTF-8 純文字檔**
2. 腳本從檔案讀取 prompt
3. 再透過 CDP + Playwright 送進 Gemini

固定規則：

- prompt 檔案一律 UTF-8
- 腳本一律使用 `--prompt-file`
- 不再用 shell inline 方式直接嵌中文 prompt

## 3.2 六年級 week08 資訊圖卡風格基準

後續六年級資訊圖卡若沒有另外指定風格，預設先參考 week08 的視覺語氣：

- 淺色背景，主體清爽明亮
- 黑色粗標題，強調大週次與任務名稱
- 多個圓角資訊卡整齊分區
- 卡片邊框偏藍綠、帶柔和陰影
- 友善、偏教學感的插圖與小圖示
- 局部有鉛筆、星星、放大鏡等輕量裝飾
- 整體可愛但不幼稚，適合國小高年級與教室投影

如果新週次要延續六年級網站一致性，Gemini 提示詞應明講：

- 參考 week08 的清爽資訊圖卡風格
- 不要過度花俏
- 區塊清楚、字大、投影可讀

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

## 7. 每週新增頁面檢查清單

每次新增 `weekXX.html` 時，至少檢查以下項目：

1. 頁面是否已載入對應年級的 `navbar.js`
2. navbar 的 auth bar 是否真的有啟動，不只是顯示外殼
3. 若頁面需要顯示登入狀態 / 教師後台按鈕 / 登出按鈕，需接上：
   - `shared/navbar-auth.js`
   - 或等效的 auth 初始化流程
4. 不能只看到 `未登入` 與 Google 按鈕就當作完成，必須實際確認：
   - 已登入時會顯示帳號
   - 教師帳號會顯示後台按鈕
   - 登出按鈕行為正常
5. 若該頁有額外進度功能，再另外決定是否需要啟用 `重新闖關` 按鈕
