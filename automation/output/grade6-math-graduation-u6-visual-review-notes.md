# 六年級數學畢業考第 6 單元圖表審查紀錄

更新日期：2026-05-17

## 人工複核結論

本輪圖題流程判定需重跑。雖然多張圖片曾通過 Gemini CLI 與 Claude CLI 視覺審查，但人工複核發現高風險立體圖缺少 `structureDraft`，且 AI 審查偏向檢查標籤與數字，未充分檢查幾何物件本身是否成立。

目前已確認不合格：

- Q6：原圖三角柱結構不成立/不清楚；已改用 SVG structureDraft，CLI 複核通過，人工看圖 PASS。
- Q10：原圖 `柱高 5 cm` 標示端點不精確；已改用 SVG structureDraft，CLI 複核通過，人工看圖 PASS。
- Q12：半圓柱立體語意不安全；已改用 Gemini SVG structureDraft 與 SVG export，CLI 複核通過，人工看圖 PASS。
- Q13：原圖三角柱結構不成立/不清楚；已改用 SVG structureDraft，CLI 複核通過，人工看圖 PASS。

處理原則：

- 上述題號不得發布。
- 重跑前必須先建立 SVG/structureDraft。
- 重跑審查必須檢查幾何拓撲，不可只檢查標籤。

## 流程原則

- 精準數學圖一律先建立 SVG `structureDraft`，先固定幾何拓撲、可見邊、隱藏邊、標籤位置與箭頭端點。
- SVG `structureDraft` 優先請 Gemini CLI 參與或複核；Gemini CLI 對 deterministic SVG 與幾何投影較適合。
- `imagegen` 只作為選用的美化或重繪工具；若造成半圓變形、箭頭漂移、標籤偏移或幾何誤讀，立即停止使用 `imagegen` 作正式圖。
- 若 `imagegen` 不穩，允許直接使用通過審查的 SVG export 作正式圖。
- 正式圖檔需存入 `automation/figures/grade6-math-graduation-u6/`，不得只保留在 Codex 預設生成資料夾。
- 圖檔須同時通過 Gemini CLI 與 Claude CLI 視覺審查。
- 任一審查 FAIL 時，不得進 Wayground，也不得上傳 Cloudinary 作正式連結。
- 新流程剛啟用，AI 視覺審查通過後仍保留發布前人工看圖確認。

## Q2 圓柱展開圖選擇題

圖檔：`automation/figures/grade6-math-graduation-u6/u6-q02-cylinder-net.png`

目前狀態：Gemini PASS、Claude PASS，可進入後續 Cloudinary 上傳與 Wayground 草稿流程。

審查紀錄：

- v1：Claude 指出 D 選項兩個圓大小差異不夠明顯，已另存 rejected。
- v2：Gemini PASS；Claude FAIL，仍認為 D 選項兩圓差距不夠一眼可辨。
- v3：Gemini PASS；Claude PASS。D 選項改成上方小圓、下方大圓，差距已能一眼辨識。

通過版確認：

- D 選項上方圓明顯小、下方圓明顯大。
- A 選項兩圓必須維持全等。
- B 選項只能有一個圓。
- C 選項維持扇形加圓，作為圓錐展開圖誘答。
- 全圖不得出現尺寸、陰影、色塊或額外文字。

## Q5 圓柱體積圖

圖檔：`automation/figures/grade6-math-graduation-u6/u6-q05-cylinder-r4-h10.png`

目前狀態：Gemini PASS、Claude PASS，可進入後續 Cloudinary 上傳與 Wayground 草稿流程。

審查結論：

- 直立圓柱黑色輪廓清楚。
- 無誤導性填色、陰影或液體感。
- 紅色半徑箭頭由頂面中心指向圓周，標示 `r = 4 cm`。
- 藍色高度雙向箭頭在右側，跨越頂到底，標示 `h = 10 cm`。
- 無多餘文字或錯誤標籤。

## Q6 三角柱體積圖

圖檔：`automation/figures/grade6-math-graduation-u6/u6-q06-triangular-prism.png`

目前狀態：SVG structureDraft 已重跑；Gemini CLI PASS、Claude CLI PASS，人工看圖 PASS。Cloudinary 已重新上傳，Wayground 舊圖已替換並驗證通過。

審查紀錄：

- v1：Gemini PASS；Claude FAIL。`12 cm` 標示雖接近柱體深度邊，但視覺上可能被誤讀成三角形斜邊。
- v2：Gemini PASS；Claude PASS。`12 cm` 改為上方獨立雙向箭頭，平行於前後連接邊，已可清楚表示柱體深度。
- 人工複核：FAIL。圖形不像標準三角柱，未清楚呈現前後兩個全等直角三角形與三條平行對應連接稜；`6 cm` 底邊與柱體延伸方向視覺混淆。
- structureDraft：`automation/figures/grade6-math-graduation-u6/structure-drafts/u6-q06-triangular-prism-structure.svg`。改為明確前後全等直角三角形、三條平行對應連接稜，`12 cm` 放在上方外部雙向箭頭。
- SVG export：`automation/figures/grade6-math-graduation-u6/u6-q06-triangular-prism-svg-export-v1.png`。
- 重審結果：Gemini SVG source PASS；Claude visual PASS；人工看圖 PASS。結論為可作正式 SVG export 圖。
- Cloudinary：`https://res.cloudinary.com/dmqmjfqng/image/upload/v1779028309/it-class-tcwu/wayground/grade6/math/graduation/u6/u6-q06-triangular-prism.png`
- Wayground：已替換 Q6 media URL；`wayground:check` media mismatch = 0。

重跑要求：

- 前方底面必須是直角三角形，兩股清楚標示 `6 cm`、`8 cm`。
- 前後兩個三角形必須全等且可辨識。
- 三條對應連接稜必須互相平行。
- `12 cm` 必須放在獨立雙向箭頭或非常明確的前後連接邊上，表示柱高/深度。
- `12 cm` 不得靠近或平行於三角形斜邊。
- 不得加入公式、表面積提示、額外數字或多餘文字。

## Q10 複合四角柱體積圖

圖檔：`automation/figures/grade6-math-graduation-u6/u6-q10-composite-prisms.png`

目前狀態：SVG structureDraft 已重跑；Gemini CLI PASS、Claude CLI PASS，人工看圖 PASS。Cloudinary 已重新上傳，Wayground 舊圖已替換並驗證通過。

審查紀錄：

- 甲、乙為兩個並排相接的四角柱，無重疊。
- 甲標示 `底面積 24 cm²`，乙標示 `底面積 18 cm²`，對應清楚。
- 無長、寬尺寸，無公式，無表面積提示。
- 人工複核：FAIL。`柱高 5 cm` 標示端點不精確，未清楚對齊共同頂面與共同底面，可能被誤讀為右側斜面高度或只屬於乙柱。
- structureDraft：`automation/figures/grade6-math-graduation-u6/structure-drafts/u6-q10-composite-prisms-structure.svg`。補齊左側柱體後方垂直稜，並讓 `柱高 5 cm` 的外部箭頭以輔助線對齊共同頂面與共同底面。
- SVG export：`automation/figures/grade6-math-graduation-u6/u6-q10-composite-prisms-svg-export-v1.png`。
- 重審結果：Gemini SVG source PASS；Claude visual PASS；人工看圖 PASS。Claude 曾提醒乙的 `cm²` 稍貼右斜邊，已縮小底面積字級修正。結論為可作正式 SVG export 圖。
- Cloudinary：`https://res.cloudinary.com/dmqmjfqng/image/upload/v1779028309/it-class-tcwu/wayground/grade6/math/graduation/u6/u6-q10-composite-prisms.png`
- Wayground：已替換 Q10 media URL；`wayground:check` media mismatch = 0。

重跑要求：

- `底面積 24 cm²`、`底面積 18 cm²` 可標在上底面，但需明確分屬甲、乙。
- `柱高 5 cm` 必須用外部垂直雙向箭頭標示，端點需以輔助線對齊整組共同頂面與共同底面。
- 不得讓高度箭頭端點落在斜邊或透視邊上。
- 需清楚表現兩個四角柱相接且不重疊。

## Q11 空心圓柱體積圖

圖檔：`automation/figures/grade6-math-graduation-u6/u6-q11-hollow-cylinder.png`

目前狀態：Gemini PASS、Claude PASS，可進入後續 Cloudinary 上傳與 Wayground 草稿流程。

審查結論：

- 中央孔洞清楚，內孔以虛線表示向下貫通。
- `R = 5 cm` 是從頂面中心點到外圓周的半徑箭頭，不是直徑。
- `r = 3 cm` 是從同一中心點到內孔邊緣的半徑箭頭，不是直徑。
- `h = 8 cm` 在圓柱外側，以垂直雙向箭頭表示高度。
- 無公式、無多餘數字、無誤導性填色。

## Q12 半圓柱體積圖

圖檔：`automation/figures/grade6-math-graduation-u6/u6-q12-half-cylinder.png`

目前狀態：SVG structureDraft 已重跑；Gemini CLI PASS、Claude CLI PASS，人工看圖 PASS。SVG export 圖已重新上傳 Cloudinary，Wayground 舊圖連結已替換並驗證通過。

structureDraft：

- 草圖檔：`automation/figures/grade6-math-graduation-u6/structure-drafts/u6-q12-half-cylinder-structure.svg`
- 檢視頁：`automation/output/grade6-math-graduation-u6-structure-drafts.html`
- v1 人工檢查：FAIL。前方半圓左端點連到後方半圓左端點的深度邊穿過前方半圓面，幾何語意錯誤，會讓 imagegen 誤判形體。
- v2 修正：改為柱體往右下延伸，兩條柱高邊保持在半圓截面外側；半徑箭頭移到左上弧邊，避免與曲面脊線共點或重疊。待人工確認後才可進 imagegen。
- v2 人工檢查：FAIL。後方半圓仍像獨立半圓片，整體不像半圓截面沿同一方向平移形成的半圓柱。
- v3 修正：前方保留唯一主要半圓截面，後端改用虛線半圓弧與虛線直徑暗示；只保留上方曲面邊與下方平切面邊，避免深度邊穿越前方端面。待人工確認後才可進 imagegen。
- v3 人工檢查：FAIL。形體仍不夠穩定，未能清楚呈現半圓截面沿柱高方向推出的立體。
- v4 參考圖 fallback 測試：上網查找半圓柱/semicylinder 參考，採用「半圓截面沿高度方向延伸、包含一個平面矩形面與一個曲半圓柱面」的拓撲，不照抄數字與原圖。SVG 草圖改為前方半圓端面、淡藍曲面、淡灰平切面、後端虛線提示。待人工確認後才可進 imagegen。
- 參考來源：GeoGebra `half or quarter of cylinder`、GeoGebra `Half Cylinder`、Half Cylinder Calculator 的 semicylinder 定義。
- v5 Gemini CLI SVG 測試：請 Gemini CLI 依 Cuemath 參考圖與失敗案例產出 deterministic SVG。Gemini 建議使用 oblique projection：正面半圓保持正投影，柱體用固定斜向向量推出，並以切點開始上方輪廓線，避免深度線穿過前方半圓面。
- v5a：`automation/figures/grade6-math-graduation-u6/structure-drafts/u6-q12-half-cylinder-gemini-v1.svg`。幾何本體明顯較穩，但 `r = 6 cm` 與 `h = 10 cm` 標籤位置仍需微調。
- v5b：`automation/figures/grade6-math-graduation-u6/structure-drafts/u6-q12-half-cylinder-gemini-v2.svg`。Gemini 修標示但新增穿過前方半圓面的虛線，且風格轉為藍色教材插圖，不採用。
- v5c：`automation/figures/grade6-math-graduation-u6/structure-drafts/u6-q12-half-cylinder-gemini-v1b.svg`。保留 Gemini v5a 幾何，手動移開 `r = 6 cm` 與 `h = 10 cm` 標籤；已放入 structureDraft 檢視頁。
- v5c 人工檢查：PASS for geometry。半圓柱形體可接受；`r = 6 cm` 標示再往右下微調後，不再壓線。
- imagegen 後續測試：FAIL。即使提供參考圖與修正提示，半圓形體或右側標示仍會漂移；本題不再用 imagegen 作正式圖。
- SVG export 候選：`automation/figures/grade6-math-graduation-u6/u6-q12-half-cylinder-svg-export-v1.png`。以通過人工幾何檢查的 SVG 直接輸出，待 Gemini CLI 與 Claude CLI 複核。
- SVG export 複核：Gemini CLI PASS；Claude CLI PASS。Claude 僅註記半徑箭頭尾端略靠近底線、柱高輔助虛線端點可再更明確，皆非阻斷。
- Cloudinary：`https://res.cloudinary.com/dmqmjfqng/image/upload/v1779028309/it-class-tcwu/wayground/grade6/math/graduation/u6/u6-q12-half-cylinder.png`
- Wayground：已替換 Q12 media URL；`wayground:check` media mismatch = 0。
- 結論：Q12 改採 SVG export 作為正式圖，人工看圖 PASS；已重新上傳 Cloudinary，待替換 Wayground 舊圖連結。

審查紀錄：

- v1：Claude PASS；Gemini FAIL。Gemini 指出正面截面看起來像「半圓形 + 下方長方形」，可能被誤認為複合形體。
- v2：Claude PASS；Gemini FAIL。Gemini 指出右端有垂直短線，可能被看成半圓下方額外厚度。
- v3：Claude PASS；Gemini FAIL。Gemini 仍指出右端點垂直短線造成厚度誤讀。
- v4：Gemini PASS；Claude PASS。改為更簡化的半圓柱線稿，正面截面清楚且下方無長方體底座。
- 人工複核：FAIL。半圓柱立體結構仍不夠可靠；缺少 structureDraft 固定半圓截面、平切面與柱體延伸方向，圖形語意可能被誤讀。

重跑要求：

- 正面截面必須只是一個半圓形，以直徑線作為平切邊。
- 半圓直徑線下方不得出現長方形區域或厚度。
- 半圓左右端點不得形成誤導性長方形底座。
- 可呈現沿直徑線往後延伸的平切面，但不得像額外長方體。
- `r = 6 cm` 必須是從半圓圓心到弧線的半徑箭頭。
- `h = 10 cm` 必須沿柱體延伸方向標示。

## Q13 三角柱表面積輔助圖

圖檔：`automation/figures/grade6-math-graduation-u6/u6-q13-prism-surface-helper.png`

目前狀態：SVG structureDraft 已重跑；Gemini CLI PASS、Claude CLI PASS，人工看圖 PASS。Cloudinary 已重新上傳，Wayground 舊圖已替換並驗證通過。

審查紀錄：

- 圖中為直角三角柱，正面底面有直角符號。
- 三角形兩股標示 `6 cm`、`8 cm`，斜邊標示 `10 cm`。
- `12 cm` 以獨立雙向箭頭標在柱體上方，表示柱體深度，未與三角形邊長混淆。
- 無公式、無面積標籤、無額外數字、無表面積著色。
- 人工複核：FAIL。與 Q6 同類，整體不像可靠的三角柱；後方全等三角形與對應連接稜不清楚，容易被看成斜四邊形貼在三角形上。
- structureDraft：`automation/figures/grade6-math-graduation-u6/structure-drafts/u6-q13-prism-surface-helper-structure.svg`。改為前後全等直角三角形與三條平行對應連接稜；`10 cm` 斜放在前方三角形內並平行斜邊，避免誤讀成柱體深度。
- SVG export：`automation/figures/grade6-math-graduation-u6/u6-q13-prism-surface-helper-svg-export-v1.png`。
- 重審結果：Gemini SVG source PASS；Claude 第一次指出 `10 cm` 模糊，修正後 Claude PASS；人工看圖 PASS。結論為可作正式 SVG export 圖。
- Cloudinary：`https://res.cloudinary.com/dmqmjfqng/image/upload/v1779028309/it-class-tcwu/wayground/grade6/math/graduation/u6/u6-q13-prism-surface-helper.png`
- Wayground：已替換 Q13 media URL；`wayground:check` media mismatch = 0。

重跑要求：

- 前後兩個直角三角形必須全等且可辨識。
- 前方三角形三邊 `6 cm`、`8 cm`、`10 cm` 必須各自貼近正確邊。
- 三條對應連接稜必須互相平行。
- `12 cm` 必須表示柱體深度，不得和三角形任一邊混淆。
- 不得加入公式、面積標籤、額外數字或表面積著色。

## Q14 圓柱表面積輔助圖

圖檔：`automation/figures/grade6-math-graduation-u6/u6-q14-cylinder-net-helper.png`

目前狀態：Gemini PASS、Claude PASS，可進入後續 Cloudinary 上傳與 Wayground 草稿流程。

審查結論：

- 左側為直立圓柱，半徑箭頭 `r = 5 cm` 從圓心指向圓周。
- 高度箭頭 `h = 8 cm` 位於圓柱外側，跨頂到底。
- 右側展開圖由一個長方形與兩個全等圓組成。
- 展開圖未新增數值，未標圓周長，未放公式或表面積計算。
