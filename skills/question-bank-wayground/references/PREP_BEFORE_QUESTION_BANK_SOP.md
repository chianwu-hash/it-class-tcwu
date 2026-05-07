# 教材整理與出題前置 SOP

本 SOP 用在正式產生 Wayground 題庫之前。目標是先把教材、教學目標、課綱或能力指標與出題範圍整理成穩定參考資料，避免 AI 出題時抓錯範圍、用超出年段的延伸內容補難度，或偏廢某些教學目標。

正式出題流程請接續：

- `TEXTBOOK_TO_BANK_SOP.md`
- `WORKFLOW_SOP.md`

## 0. 適用情境

當要為某科某次段考建立題庫時，先執行本 SOP。

尤其適用：

- 有備課用書 PDF / txt / md
- 需要對應課綱、能力指標或學習內容
- 需要整理教學目標
- 需要控制不出超綱內容
- 要給 Gemini / Claude / Wayground 使用一致來源

## 1. 收集來源檔

至少準備下列資料：

- 教材或備課用書原始 PDF
- 教材轉文字檔
- 官方課綱、能力指標或學習內容 PDF 與轉文字檔
- 段考範圍
- 考古題或校內考風筆記

範例，國中自然二段可使用：

- `../../prep-text/04-114國中自然2下備課CH3(114f615553).txt`
- `../../prep-text/05-114國中自然2下備課CH4(114f615554).txt`
- `../references/curriculum/1071102-國民中小學暨普通型高級中等學校-自然科學領域.txt`
- `../references/scope/exam2-scope.md`
- `../references/exams/school-style-notes.md`

## 2. 轉檔規則

### 2.1 中文教材 PDF

中文教材、備課用書、課本 PDF 預設使用 PDF2TXT：

```bash
doc2md "教材.pdf" --engine pdf2txt --format md -o "教材.md"
```

若只需要純文字：

```bash
doc2md "教材.pdf" --engine pdf2txt --format txt -o "教材.txt"
```

### 2.2 複雜表格或圖片題

如果 PDF2TXT 對表格、圖片題或多欄版面不清楚，再使用 MinerU API 做輔助比對。

使用原則：

- PDF2TXT 輸出為主來源。
- MinerU 輸出為表格與版面輔助。
- MarkItDown 不作中文教材 PDF 主流程。

### 2.3 官方課綱

官方課綱 PDF 可用 PDF2TXT 轉成 txt 備查。由於專案 `.gitignore` 可能忽略 `*.pdf`、`*.txt`，真正要進 git 的應是整理後的 `.md` 索引。

## 3. 確認課綱版本

下載課綱後必須核對：

- 來源為教育主管機關、出版社正式配套文件或學校指定版本。
- 檔名、法規頁或公告頁能對應目標科目與學習階段。
- 文件首頁或公告資訊能確認版本，例如：
  - `十二年國民基本教育課程綱要`
  - `國民中小學暨普通型高級中等學校`
  - 目標領域或科目名稱
  - 發布年月、實施年度或版本資訊
- 法規頁、公告頁或教材說明能確認適用年段與版本。

範例，國中自然二段可記錄為：

- 教育部主管法規系統
- `十二年國民基本教育課程綱要國民中小學暨普通型高級中等學校─自然科學領域`
- 公發布日：民國 107 年 11 月 02 日
- 自 108 學年度起逐年實施

## 4. 建立四層整理資料

整理後資料一律放在 `docs/references/`。不要把所有內容塞進同一份檔案。

### 4.1 官方課綱索引層

用途：

- 長期查證
- 統一課綱或能力指標用語
- 確認學習內容、學習表現或能力指標代碼

建議位置：

```text
docs/references/curriculum/
```

範例，國中自然二段：

- `curriculum/108-science-junior-high-keypoints.md`

應包含：

- 課綱或能力指標用語說明
- 與本次範圍相關的學習內容、學習表現或能力指標代碼
- 每個代碼的命題連結
- 不得延伸到超出年段內容的提醒

### 4.2 教材課綱對應層

用途：

- 把教材章節對應到課綱學習內容
- 明確列出不延伸範圍

建議位置：

```text
docs/references/textbooks/
```

範例，國中自然二段：

- `textbooks/ch3-curriculum-mapping.md`
- `textbooks/ch4-curriculum-mapping.md`

應包含：

- 單元與課綱對應表
- 教材明確限制
- 可出題方向
- 不建議出題方向

### 4.3 教學目標層

用途：

- 把課綱與教材轉成學生能達成的能力目標
- 給命題 prompt 使用

建議位置：

```text
docs/references/teacher-guides/
```

範例，國中自然二段：

- `teacher-guides/ch3-teaching-goals.md`
- `teacher-guides/ch4-teaching-goals.md`

應包含：

- 總目標
- 各節學生能做什麼
- 評量重點

### 4.4 出題範圍層

用途：

- 直接餵給 AI 出題
- 控制題型、Bloom 分配與禁區

建議位置：

```text
docs/references/scope/
```

範例，國中自然二段：

- `scope/ch3-question-scope.md`
- `scope/ch4-question-scope.md`

應包含：

- 必考概念
- 常見題型
- 易錯點
- 不出題內容
- 題目風格

## 5. 寫作規則

整理資料時遵守：

- 用短句，方便 AI 讀取。
- 明確分出「可出題」與「不可出題」。
- 保留課綱代碼，但不要只列代碼。
- 不把超出年段或不在本次範圍的延伸內容包裝成高層次 Bloom 題。
- 生活情境要回扣教材概念。
- 教學目標用「學生能……」描述。
- 出題範圍用「必考概念 / 常見題型 / 易錯點 / 不出題內容」描述。

## 6. 品質檢查

整理完後執行：

```bash
find docs/references -maxdepth 2 -type f | sort
rg -n "不出題內容|教材明確限制|教學目標|課綱學習內容" docs/references
rg -n "學習內容|學習表現|能力指標|核心素養" docs/references
```

檢查清單：

- 課綱索引有對應本次章節的學習內容、學習表現或能力指標代碼。
- 每章都有 curriculum mapping。
- 每章都有 teaching goals。
- 每章都有 question scope。
- 每章都列出不出題內容。
- 檔案沒有只複製原文，必須有命題化整理。

## 7. 完成條件

本前置 SOP 完成後，應至少具備：

```text
docs/references/curriculum/*keypoints.md
docs/references/textbooks/*summary.md
docs/references/textbooks/*curriculum-mapping.md
docs/references/teacher-guides/*teaching-goals.md
docs/references/scope/*question-scope.md
docs/references/scope/exam2-scope.md
docs/references/exams/school-style-notes.md
```

若不是段考題庫，可把 `exam2-scope.md` 改成對應的評量範圍名稱，例如 `unit-scope.md`、`midterm-scope.md` 或 `practice-scope.md`。

完成後才能進入正式題庫產生流程。

## 8. 與出題 SOP 的銜接

正式出題時，prompt 應優先引用：

1. `scope/exam2-scope.md`
2. `scope/*question-scope.md`
3. `textbooks/*summary.md`
4. `textbooks/*curriculum-mapping.md`
5. `teacher-guides/*teaching-goals.md`
6. `exams/school-style-notes.md`

官方課綱原文只在需要查證代碼或範圍時使用，不直接整份餵給出題模型。

## 9. 出題 SOP 調整原則

完成本前置 SOP 後，正式出題 SOP 應改成「先吃整理檔，不直接吃原始教材」。

### 9.1 Prompt 來源順序

正式出題 prompt 應依序使用：

1. `scope/exam2-scope.md`：確認段考總範圍。
2. `scope/*question-scope.md`：確認必考概念、常見題型、易錯點與不出題內容。
3. `textbooks/*summary.md`：補教材內容。
4. `textbooks/*curriculum-mapping.md`：確認課綱或能力指標與不延伸範圍。
5. `teacher-guides/*teaching-goals.md`：確認教學目標。
6. `exams/school-style-notes.md`：對齊校內考風。

原始備課用書、課本或 OCR 文字只作查證，不作 prompt 主體。

### 9.2 不可超出整理檔

出題 prompt 必須包含下列限制：

```text
本次出題必須以 docs/references/ 下的整理檔為主。
原始教材 txt/md 只可用於查證，不可擴張範圍。
若整理檔與模型常識衝突，以整理檔為準。
不得使用整理檔列為「不出題內容」的概念作為正答依據。
```

### 9.3 高層次題來源

高層次 Bloom 題應來自題目推理層次，而不是超綱內容。

建議：

- 記憶：定義、基本判斷、直接資訊。
- 理解：概念解釋、基本比較、原因判斷。
- 應用：生活情境、規則套用、單一變因判讀。
- 分析：多步驟判讀、迷思辨析、多變因比較。
- 評鑑：在明確條件下判斷最佳方法、結論或解釋。

禁止：

- 用超出年段的公式或知識假裝高層次。
- 用課綱禁區假裝高層次。
- 用冷知識或課外資料假裝高層次。
- 用冗長敘述假裝需要分析或評鑑。

## 10. 教學目標覆蓋原則

除非使用者明確指定只練某一節、某一概念或某一題型，否則題庫必須涵蓋本次範圍內所有主要教學目標，不可偏廢。

### 10.1 出題前先做目標配題表

正式產題前，先依 `teacher-guides/*-teaching-goals.md` 建立目標配題表。

範例：

```md
| 教學目標 | 題數 | Bloom 分布 |
| --- | --- | --- |
| 區分電解質與非電解質 | 3 | 記憶1 理解1 分析1 |
| 說明水溶液導電與離子移動 | 2 | 理解1 應用1 |
| 判斷 pH 與酸鹼強弱 | 3 | 理解1 應用1 分析1 |
| 說明酸鹼中和現象 | 3 | 記憶1 理解1 應用1 |
| 判斷反應速率因素 | 4 | 記憶1 理解1 應用1 分析1 |
| 理解可逆反應與動態平衡 | 2 | 理解1 分析1 |
```

題數可依總題數調整，但原則是每個主要教學目標都要有題目覆蓋。

### 10.2 常見偏廢風險

自然科題庫特別容易偏向好出的概念，需主動避免：

- CH3 只出 pH，忽略電解質導電與酸鹼中和。
- CH3 只出定義，忽略實驗觀察。
- CH4 只出反應速率，忽略可逆反應與動態平衡。
- 高層次 Bloom 題全部集中在單一章節。
- 題型過度單一，例如全是名詞定義題。

### 10.3 審題時必查覆蓋率

本地初審、Gemini 二審、Claude 三審都應檢查：

- 每個主要教學目標是否至少有一題覆蓋。
- 是否有章節或概念題數過多。
- 高層次 Bloom 題是否集中在單一教學目標。
- 是否有教學目標完全漏掉。
- 是否每題都能對應到整理檔中的必考概念或教學目標。

建議每題保留或可追溯下列 metadata：

```text
來源章節：
對應概念：
對應教學目標：
對應整理檔：
是否碰到不出題內容：
```

### 10.4 完成判準

題庫不只要每題正確，還要能代表整個教學範圍。

若題庫未涵蓋所有主要教學目標，或明顯偏重單一概念，應先修題庫，不應進入 Wayground。
