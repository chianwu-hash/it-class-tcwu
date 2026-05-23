# 圖像與首頁預告卡 SOP

更新日期：2026-05-23

## 1. 資訊圖卡預設規格

- 用途：教學網站資訊圖表 / 投影圖
- 輸出尺寸：`1920x1080`
- 輸出格式：`WebP`
- 品質：`q80`
- 命名格式：`weekXX-infographic-1920x1080-q80.webp`

## 2. 資訊圖卡標準流程

0. 課程資訊圖卡預設使用「網頁 ChatGPT + CDP wrapper 生圖」（`npm.cmd run chatgpt:image-batch`），讓流程可自動下載圖片並留下 metadata；Codex Chrome 擴充套件只作為 CDP 不可用時的臨時備援或人工檢查。不要使用 Codex 內建 ImageGen，避免在對話中消耗大量 token 且缺少專案 metadata / 壓圖 / Cloudinary 流程銜接。
1. ChatGPT 或 Gemini 產出的原圖先放到本機可處理路徑，例如 `C:\Users\user\projects\tmp`
2. 先縮圖輸出成 `1920x1080 WebP q80`
3. 再複製回專案對應週次資料夾，例如 `grade3/images/week08/` 或 `grade6/images/week08/`
4. 上傳到 Cloudinary
5. 網頁正式使用 Cloudinary 正式網址，不直接吃原始大圖
6. 如需比對效果，可暫留本地預覽版，但正式上站以 Cloudinary 版為準

### 2.0 生圖工具路由

課程網站的資訊圖卡、案例卡、教學插圖與投影圖，預設路由如下：

1. **首選：ChatGPT CDP batch wrapper**
   - 使用 `npm.cmd run chatgpt:image-batch -- --cdp-url ...`
   - 適合課程圖卡的標準流程：批次產圖、固定 metadata JSON、自動下載、後續壓圖與 Cloudinary 串接
   - 需先確認 `--cdp-url` 指向已登入 ChatGPT 的 Chrome
   - 中文提示詞一律用 UTF-8 prompt file
2. **備援 A：Codex Chrome 擴充套件**
   - 只在 CDP Chrome 不可用、需要快速人工檢查、或使用者臨時指定時使用
   - 可操作已登入的 ChatGPT 分頁，但下載與 metadata 不如 CDP wrapper 穩定
3. **備援 B：Gemini 生圖自動化**
   - 只有在 ChatGPT 分頁不可用、教師指定 Gemini、或需要比對 Gemini 風格時使用
   - 使用前仍需切新對話，避免上下文污染
4. **不要用：Codex 內建 ImageGen**
   - 一般課程資訊圖卡不使用內建 ImageGen
   - 例外只限使用者明確指定「用內建 ImageGen」，或網頁 ChatGPT / Gemini 流程無法使用且使用者同意
   - 即使例外使用，也要把輸出落到正式資產流程：壓 WebP、上 Cloudinary、頁面不引用原始大圖

## 2.1 ChatGPT 生圖自動化（預設；CDP wrapper）

課程資訊圖卡預設使用已登入的 ChatGPT 瀏覽器分頁搭配 CDP wrapper，不使用內建 ImageGen。CDP wrapper 是目前最穩定的路線：可送出 UTF-8 prompt file、等待生成、下載圖片並寫出 metadata，方便後續 WebP 壓圖與 Cloudinary 上傳。

使用前先讀專案技能：

- `skills/chatgpt-image-workflow/SKILL.md`

CDP wrapper 優先流程：

1. 啟動或確認已存在支援 CDP 的 Chrome（預設 `http://127.0.0.1:9333`）
2. 在該 Chrome 開啟 `https://chatgpt.com/` 並確認已登入
3. 確認 CDP 檢查入口可用，例如 `http://127.0.0.1:9333/json/version`
4. 將 prompt 先存成 UTF-8 `.txt`
5. 執行 `npm.cmd run chatgpt:image-batch`
6. 檢查 metadata JSON 與實際下載圖片
7. 接 WebP 壓圖、Cloudinary 上傳與頁面引用更新

Codex Chrome 擴充套件備援流程：

1. 確認 Codex 可以看到 `Chrome` extension browser，profile 通常顯示為「你的 Chrome」
2. 開啟或切到已登入的 `https://chatgpt.com/` 分頁
3. 將 UTF-8 prompt file 內容貼到 ChatGPT composer 並送出
4. 等待圖片生成完成後人工確認或下載
5. 盡量補記 prompt、下載檔與後續壓圖 / Cloudinary 紀錄；若需要完整 metadata，改回 CDP wrapper 重跑

快捷指令：

```powershell
npm.cmd run chatgpt:image-batch -- --cdp-url http://127.0.0.1:9333 --prompt-file automation/prompts/week12-safety-card.txt --count 1 --min-images 1 --output-dir grade3/images/week12 --output-prefix week12-safety-card --meta automation/output/week12-safety-card.json
```

固定規則：

- 中文提示詞一律存成 UTF-8 `.txt`，用 `--prompt-file` 傳入
- 不要用 PowerShell inline / here-string 直接塞中文 prompt
- 若要延續目前對話才使用 `--reuse-chat`；一般課程圖卡建議開新脈絡，避免舊對話污染主題
- 生圖成功與下載成功要分開確認；若走 CDP wrapper，以 metadata JSON 與實際圖片檔是否存在為準
- 下載後仍需接 WebP 壓圖與 Cloudinary 上傳流程，正式上站不要直接引用原始大圖
- 教案與圖卡文案應先確認，再把產圖整合進週頁

## 2.1.1 Gemini 生圖自動化（備援；已驗證到下載）

目前已驗證可自動化的段落：

1. 連到已登入的正式 Chrome（CDP `9222`）
2. 找到既有 Gemini 分頁
3. 先切到「新對話」，避免沿用舊上下文
4. 切換到「生成圖片 / 建立圖像」模式
5. 送出提示詞
6. 等待圖片生成完成
7. 點擊「下載原尺寸圖片」
8. 將原始 PNG 下載到本機

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
>
> 補充：若未先開新對話，Gemini 可能會吃到前一輪對話內容，造成主題錯誤或文字串題；這次 week11 已實際踩到這個問題，因此改列為固定步驟。

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

## 2.4 提示詞語言建議

若圖卡需要精準顯示中文文案，建議採用「英文為主體、中文文案原樣嵌入」的 hybrid prompt：

- 版面、風格、構圖、圖示方向：可用英文描述
- 圖上必須逐字出現的標題與內文：直接放中文原文
- 一樣必須存成 UTF-8 檔案，再用 `--prompt-file` 讀入

原因：

- 英文更適合描述整體構圖與視覺風格
- 中文可鎖定圖上實際要出現的文字
- 兩者混用時，通常比「全英文但再要求中文輸出」更穩，也比整份全中文更容易維持版面控制

## 3. Windows 路徑注意事項

- Windows 下若 Python 直接處理含中文路徑失敗，先輸出到 ASCII 路徑，例如 `C:\Users\user\projects\tmp`
- 之後再複製回專案資料夾

## 3.1 中文提示詞亂碼避坑

這次實測已確認：

- **不要**把中文 Gemini / ChatGPT 提示詞直接寫進 PowerShell inline script / here-string 再丟給 Node。
- 這樣很容易讓中文在中途被吃成 `????`，導致生圖工具收到的是壞掉的 prompt。

正式做法：

1. 先把提示詞存成 **UTF-8 純文字檔**
2. 腳本從檔案讀取 prompt
3. 再透過 CDP + Playwright 送進 Gemini 或 ChatGPT

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

## 3.3 文件到簡報生圖流程

這段流程適用於「先拿到一份原始文件或會議記錄，再把它整理成一組可生成的簡報主視覺」。

目標不是一步把整份簡報做完，而是先把內容拆成適合生圖模型理解的頁面單位，再逐頁生成。

### Step 1. 先把原始文件拆成簡報故事線

先不要急著寫 prompt。第一步是把原始文件整理成 3 個層級：

1. 整份簡報主題
2. 頁面順序
3. 每頁只保留一個主訊息

建議先做出一個簡單表格：

| 頁次 | 頁面主題 | 這頁只講什麼 |
|------|----------|--------------|
| 1 | 封面 | 這份簡報的主題與語氣 |
| 2 | 政策背景 | 為什麼會推動 |
| 3 | 經費結構 | 錢怎麼分配 |
| 4 | 行政配套 | 導師與行政如何落地 |
| 5 | 作息方案 | A/B/C 差異 |

固定原則：

- 一頁只保留一個中心句
- 一頁不超過 3 個輔助重點
- 先做「簡報語言」，不要保留原始公文語氣

### Step 2. 把每頁文案壓成生圖可用短句

Gemini 生圖比較適合：

- 大標題
- 1 到 3 個短句
- 2 到 4 個短標籤

不適合：

- 公文式長段落
- 太多數字與條款原文
- 一頁超過 80 到 120 字的圖中文字需求

建議把每頁拆成：

- `page_goal`：這頁想讓人一眼理解什麼
- `headline`：大標題
- `supporting_points`：2 到 4 個短句
- `visual_scene`：這頁想看到的畫面

範例：

```text
page_goal: 說明免費午餐已從福利選項轉為校園治理配套
headline: 免費午餐已成校園治理的重要配套
supporting_points:
- 少子化下更重視學生照顧
- 零至十二歲國家養政策方向
- 各縣市免費午餐逐步成形
visual_scene: 溫暖校園、教室午餐、公共照顧感、教育政策資訊圖卡
```

### Step 3. 先決定這頁是「圖主導」還是「字主導」

這一步很重要，因為它會決定 prompt 寫法。

`圖主導`
- 封面
- 章節首頁
- 結尾頁
- 情緒氛圍頁

`字主導`
- 比較表
- 經費拆分
- 流程說明
- A/B/C 方案差異

原則：

- 圖主導頁可以讓 Gemini 直接生成較完整圖文畫面
- 字主導頁應減少讓模型直接畫大量文字，必要時改成人工後製

### Step 4. 品牌元素先分級，不要一開始全塞

品牌融入建議先選一種濃度：

- `輕品牌`
  - 一個小型校徽或單一識別角標
  - 其他只用色彩語彙
- `中品牌`
  - 小校徽固定在左上或右上
  - 吉祥物自然融入內容場景
- `強品牌`
  - 吉祥物成為主角
  - 品牌色與角色辨識明顯主導畫面

實務上最穩的是 `中品牌`：

- 校徽固定小尺寸，放左上或右上
- 校徽只出現一次
- 吉祥物融入內容場景，不重複平鋪
- 其他地方靠色彩與形狀延伸品牌感

### Step 5. Gemini prompt 的固定骨架

建議每頁 prompt 都用相同骨架，只替換主題內容。

```text
Create a polished 16:9 educational presentation slide.

Topic:
[這頁主題]

Main message:
[這頁中心句]

Required visible text:
- [大標題]
- [短句 1]
- [短句 2]
- [短句 3]

Visual direction:
- [場景]
- [色彩]
- [角色/品牌元素]
- [版面語氣]

Brand rules:
- small school logo only once, in the top-left or top-right corner
- mascots may appear naturally in the scene
- do not repeat logos as wallpaper, watermark, or pattern
- keep original brand colors

Design rules:
- premium infographic presentation style
- strong hierarchy
- clear title area
- avoid long text blocks
- no watermark
- no extra school names, dates, presenters, or fake English subtitles
```

### Step 6. Prompt 寫法的實務原則

固定保留：

- `16:9`
- `educational presentation slide`
- `clear title area`
- `avoid long text blocks`
- `no watermark`

若有品牌參考圖：

- 明講 `use the reference as brand inspiration`
- 明講 `keep original brand colors`
- 若校名不能亂生，明講：
  - `do not invent school name text`
  - `do not invent English subtitles`

若要控制品牌濫用：

- 不要只寫 `logo only once`
- 比較好的寫法是：
  - one primary logo appearance only
  - mascots can appear naturally in the content scene
  - do not repeat logos as decorative wallpaper or watermark

### Step 7. 檔案與執行方式

提示詞一律放在 UTF-8 文字檔，例如：

- `automation/prompts/gemini-brand-cover-no-text.txt`
- `automation/prompts/gemini-brand-balance-medium.txt`

不要把中文 prompt 直接寫進 PowerShell inline script。

若用 Drive 品牌圖：

1. 先開新對話
2. 切換到 `建立圖像`
3. 點 `+ -> 加入雲端硬碟檔案`
4. 若跳出 Google Workspace 視窗：
   - 有出現才按 `連結`
   - 沒出現就直接略過
5. 再切到對應頁籤，例如：
   - `近期`
   - `已加星號`

### Step 8. 這條流程目前已驗證到哪裡

目前已驗證穩定或接近穩定的段落：

- 新對話導航
- `建立圖像` 模式切換
- Drive 品牌圖掛入
- Google Workspace 視窗 `if present` 處理
- `已加星號` 頁籤切換
- 生成本身

目前不穩定的段落：

- Gemini 圖片下載
- 教育版與一般版帳號都曾出現下載失敗
- 因此目前不能把「正式下載原圖」視為穩定依賴

### Step 9. 建議工作分工

最穩的實務流程通常是：

1. 先整理原始文件成簡報頁面表
2. 為每頁寫短版 `page_goal / headline / supporting_points`
3. 先做 1 到 2 張風格測試
4. 確認品牌濃度與語氣
5. 再批量生成剩餘頁面

不要一開始就把整份文件一次丟給 Gemini，否則很容易：

- 每頁文字過多
- 品牌元素失控
- 頁面彼此風格不一致
- 後面難以修正

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
