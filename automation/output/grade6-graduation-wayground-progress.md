# 六年級畢業考 Wayground 出題進度

更新日期：2026-05-18

## 總覽

| 科目 | 已發布題組 | 已發布題數 | 網頁狀態 |
| --- | ---: | ---: | --- |
| 數學 | 2 | 30 | 已更新入口頁 |
| 國語 | 4 | 55 | 已在入口頁 |
| 英語 | 3 | 40 | 已在入口頁 |
| 自然 | 4 | 60 | 已在入口頁 |
| 社會 | 1 | 20 | 已更新入口頁 |
| 合計 | 14 | 205 | 已整理於 `grade6/wayground-graduation.html` |

## 數學

| 題組 | 題數 | Wayground | 狀態 |
| --- | ---: | --- | --- |
| 第 5 單元：怎樣解題 | 15 | `6a0911db280042919c2ecf22` | 已發布、已在入口頁 |
| 第 6 單元：角柱與圓柱 | 15 | `6a098060866b3404fec1290e` | 已發布、已在入口頁 |

第 6 單元發布前檢查：

- `npm run wayground:check -- automation/question-banks/grade6-math-graduation-u6.md`：15/15 題通過，無 missing、extra、duplicate、mediaMismatch、tableMismatch。
- `npm run figure:validate-manifest -- automation/figures/grade6-math-graduation-u6/figure-manifest.draft.json`：0 errors、0 warnings。
- Q6、Q10、Q12、Q13 圖形已改走 SVG 定稿與人工審圖，Cloudinary 圖片連結已回寫 Wayground。
- 人工審題已通過，2026-05-18 已發布。

## 國語

| 題組 | 題數 | Wayground | 狀態 |
| --- | ---: | --- | --- |
| 第七課：打開心中的窗 | 15 | `69fe9c9eedd162a3e421ea95` | 已在入口頁 |
| 第八課：努力愛春華 | 15 | `69fe9ce1e2a3543978b79c2b` | 已在入口頁 |
| 第九課：每一個孩子都有一條自己的小路 | 15 | `69fe9cf31cde7f2837dd9384` | 已在入口頁 |
| 語文天地三、閱讀充電站三 | 10 | `69fe9d06ea3adb86384d94f7` | 已在入口頁 |

## 英語

| 題組 | 題數 | Wayground | 狀態 |
| --- | ---: | --- | --- |
| Unit 3：Where Was Kevin? | 15 | `69ff4c713fd2d4eb6ed32db2` | 已在入口頁 |
| Unit 4：Friends Forever | 15 | `69ff4c89e162f8ae0cd4d051` | 已在入口頁 |
| Review 2 / Culture | 10 | `69ff4c9ee162f8ae0cd4d062` | 已在入口頁 |

## 自然

| 題組 | 題數 | Wayground | 狀態 |
| --- | ---: | --- | --- |
| 2-3 製作簡易樂器 | 15 | `6a0144493d5ebbf591d7be11` | 已在入口頁 |
| 3-1 生物與環境 | 15 | `6a014458691a1f133298b367` | 已在入口頁 |
| 3-2 人類活動對生態的影響 | 15 | `6a014465d64f4b7863be54cb` | 已在入口頁 |
| 3-3 資源開發與永續經營 | 15 | `6a0144744ea8d8b9927aaf86` | 已在入口頁 |

## 社會

| 題組 | 題數 | Wayground | 狀態 |
| --- | ---: | --- | --- |
| 第三單元：關懷臺灣與國際議題 | 20 | `6a0a61e9a8f3ee6a532810b5` | 已發布、已在入口頁 |

第 3 單元發布前檢查：

- 題庫：`automation/question-banks/grade6-social-graduation-u3.md`。
- Gemini CLI 二審：PASS WITH MINOR FIXES，已修 Q14、Q19。
- Claude CLI 三審：PASS WITH MINOR FIXES，已修 Q11、Q12、Q17。
- Claude after-fix gate v2：PASS。
- `npm run wayground:check -- automation/question-banks/grade6-social-graduation-u3.md`：20/20 題通過，無 missing、extra、duplicate、mediaMismatch、tableMismatch。

## 待追蹤

- 第 6 單元圖形題新 SOP 已證實可用，但仍需保留人工審圖關卡；目前不可跳過人工審題。
- 後續若再做含圖題單元，先由 Gemini CLI 產出 SVG 初稿，人工確認幾何結構，再視需要進 imagegen 或直接採 SVG 輸出。
