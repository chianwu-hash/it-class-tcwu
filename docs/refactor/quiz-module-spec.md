# Quiz Module 規格草案

更新日期：2026-03-18

## 目的

這份文件定義後續 `shared/quiz-module.js` 的責任邊界、設定格式、測試規格與接入方式。

重點：

- 不再直接在大型 HTML 內嵌 script 裡重構 quiz
- 先建立共用 quiz 核心，再由個別頁面提供資料與文案
- 保持現有網址、視覺與互動流程不變

## 為什麼要抽 quiz

`week06` 已證明 quiz 功能具有可重複結構：

- 題目列表
- 單選選項
- 點選狀態
- 送出答案
- 計算分數
- 顯示結果
- 儲存分數
- 已完成狀態回顯

如果未來還會有第 07 週、第 08 週測驗，繼續把 quiz 寫死在各頁，只會重複製造：

- 題目渲染邏輯重複
- 分數保存邏輯重複
- 結果畫面重複
- 錯誤與編碼風險重複

## 不採用的方式

目前明確不採用：

- 直接在 `week06.html` 內嵌 script 上做大段重組
- 用 shell / 終端直接批次替換大量中文字串
- 把 quiz 和 typing 一起抽到同一個共享模組

原因：

- `week06.html` 已證明這樣很容易踩到編碼與壞字串風險
- quiz 與 typing 雖然都是互動任務，但資料模型不同，應拆開

## 模組責任邊界

`shared/quiz-module.js` 應只負責：

1. 渲染題目與選項
2. 管理選取狀態
3. 處理送出
4. 計算分數
5. 顯示完成結果
6. 接收外部 save/load hook
7. 接收 auth 狀態變化

`shared/quiz-module.js` 不負責：

1. 建立 Supabase client
2. 判斷教師身份
3. 頁面 header / navbar
4. Email 任務內容
5. 中打闖關
6. 頁面專屬 lightbox / 浮動工具列

## 頁面端應提供的設定

頁面初始化 quiz 時，應提供：

```js
initQuizModule({
  questions,
  selectors,
  messages,
  loadProgress,
  saveProgress,
  getCurrentUser,
  onRequireLogin,
  onAfterSubmit
});
```

### `questions`

題目資料陣列。

建議格式：

```js
[
  {
    id: 1,
    questionHtml: "題目文字或 HTML",
    options: [
      { text: "選項 A", correct: false },
      { text: "選項 B", correct: true }
    ]
  }
]
```

### `selectors`

頁面上既有 DOM 的選擇器或節點 ID。

建議至少包含：

```js
{
  lock: "quiz-lock",
  content: "quiz-content",
  container: "quiz-container",
  statusBanner: "quiz-status-banner",
  statusText: "quiz-status-text"
}
```

### `messages`

頁面專屬文案。

建議包含：

```js
{
  questionLabel: (index) => `第 ${index} 題`,
  submitButton: "送出我的答案！",
  submittedButton: "已提交測驗",
  unansweredAlert: (remaining) => `還有 ${remaining} 題沒有作答，先把全部選完再送出喔！`,
  scoreLabel: (correct, total) => `得分：${correct} / ${total} 分`,
  resultMessages: {
    perfect: ["🏆", "全部答對了！你把網路安全觀念記得很清楚。"],
    great: ["🌟", "答得很好，已經掌握大部分重點，再複習一下就更穩了。"],
    good: ["👍", "這次有抓到不少重點，回頭看看錯的地方會更進步。"],
    retry: ["💪", "先別灰心，知道哪裡不熟就是下一次進步的起點。"]
  },
  completedBanner: (score) => `你已經完成這份測驗，分數是 ${score ?? "?"} / 5 分。`,
  unauthenticated: "尚未登入時，練習不會保存；登入後會自動記錄進度。"
}
```

### `loadProgress`

頁面提供的 async hook，回傳：

```js
{ completed: boolean, score: number | null }
```

或：

```js
null
```

### `saveProgress`

頁面提供的 async hook，簽名：

```js
async function saveProgress(score) => boolean
```

模組不直接碰 Supabase，只呼叫這個 hook。

### `getCurrentUser`

由頁面提供目前使用者。

### `onRequireLogin`

當模組需要登入但尚未登入時，交由頁面處理。

### `onAfterSubmit`

可選。提交後若頁面還要做額外效果，透過 callback 處理。

## 模組對外 API

建議 `shared/quiz-module.js` 輸出：

```js
export function initQuizModule(config)
```

回傳物件：

```js
{
  handleAuthChange,
  render,
  selectOption,
  submit,
  showCompletedState
}
```

## 狀態模型

模組內部管理：

- `selectedOptions`
- `submitted`
- `rendered`
- `progressLoaded`

頁面外部管理：

- `currentSession`
- `WEEK_CODE`
- `QUIZ_KEY`
- `supabase`

這樣責任邊界比較乾淨。

## 驗證規格

### Phase Q1：模組本體

只驗證 `shared/quiz-module.js` 自己：

1. 可渲染題目
2. 可選單選項
3. 題目未答完時可阻止提交
4. 可算分
5. 可顯示結果
6. 可切已完成狀態

### Phase Q2：接入 `week06`

只在 `week06` 驗證：

1. quiz 區塊在登入後解鎖
2. 可正常送出
3. 分數正確
4. 可保存
5. 重新整理後可顯示已完成
6. typing / Email 不受影響

## 風險控制

為避免再次踩到 `week06` 的編碼坑：

1. 先新增 `shared/quiz-module.js`
2. 先在獨立檔案內完成重構
3. 讓 `week06.html` 只改最小掛接程式
4. 不直接在內嵌大段 script 中做大規模字串搬移

## 下一步

1. 新增 `shared/quiz-module.js`
2. 先做最小可用版，不接頁面
3. 做語法檢查
4. 再決定何時接回 `week06`
