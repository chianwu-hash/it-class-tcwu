# Multi-Agent Sync Notes

本文件記錄 Codex 與 Claude Code 在同一專案中進行「近即時交接」的構想。  
目前只作為設計備忘錄，不代表本專案已經實作自動輪詢或自動接手機制。

## 背景

目前已建立非同步協作方式：

- `AGENTS.md`：Codex 的專案協作規則。
- `CLAUDE.md`：Claude Code 的專案協作規則。
- `docs/development/agent-handoff.md`：兩個 AI 之間的交接紀錄。
- `docs/development/prompt-template.md`：開發任務提示詞模板。

現階段的協作重點是：

- 先讀現有 SOP 與同類型參考頁。
- 修改前確認原有功能契約。
- 用 `rg` 與檔案內容驗證事實，不只依靠口頭摘要。
- 若需求與共享模組、登入、資料庫、週卡顯示邏輯衝突，先停下回報。
- 完成後寫清楚修改檔案、驗證項目與未驗證風險。

## 構想

未來若非同步模式穩定，可以再嘗試「近即時對話模式」。這個模式不是讓兩個 AI 真正直接聊天，而是透過檔案系統建立一個輕量任務協調協定。

初步構想：

1. 使用一個狀態檔標記目前輪到誰工作。
2. 使用交接檔記錄目前任務、已完成事項、待接手事項與風險。
3. 設定一段協作時限，例如 5 分鐘。
4. 在時限內，依任務複雜度設定輪詢間隔。
5. 每個 AI 在自己的回合內工作，完成後更新交接檔，再把狀態交給下一位。
6. 若工具不支援背景輪詢，就改由使用者或目前執行中的 agent 觸發下一輪。

## 建議檔案結構

若未來要實作，可新增：

```text
docs/development/agent-sync/
  state.json
  handoff.md
  log.md
```

### `state.json`

`state.json` 作為機器可讀的狀態檔。

範例：

```json
{
  "mode": "auto_reply",
  "status": "active",
  "current_agent": "codex",
  "next_agent": "claude",
  "task": "檢查三年級 week10 navbar 與闖關紀錄",
  "deadline": "2026-04-15T15:30:00+08:00",
  "poll_interval_seconds": 30,
  "last_updated_by": "codex",
  "last_updated_at": "2026-04-15T15:25:10+08:00",
  "lock": {
    "owner": "codex",
    "started_at": "2026-04-15T15:25:10+08:00",
    "expires_at": "2026-04-15T15:27:10+08:00"
  }
}
```

### `handoff.md`

`handoff.md` 作為人與 AI 都能讀懂的交接檔。

範例：

```md
# Agent Handoff

## Current Task
檢查三年級 week10 navbar 與闖關紀錄是否符合 SOP。

## Current Owner
Codex

## Done
- 已檢查 `grade3/week10.html`
- 已確認 `initTypingChallenge` 存在

## Needs Next
- Claude Code 請檢查 Supabase 寫入流程
- Claude Code 請確認 navbar 登入按鈕是否有事件綁定

## Evidence
- `rg "initTypingChallenge" grade3/week10.html`
- `rg "student_progress" grade3/week10.html shared`

## Risk
目前尚未做實際登入測試。
```

### `log.md`

`log.md` 記錄每次交接，方便事後追蹤。

範例：

```md
## 2026-04-15 15:25 Codex
接手任務：檢查 week10.html。
結果：確認 warmup 使用 initTypingChallenge。
下一步：交給 Claude Code 檢查 Supabase 寫入。

## 2026-04-15 15:28 Claude Code
接手任務：檢查 Supabase 寫入。
結果：尚待填寫。
```

## 輪詢建議

第一版不要追求完全自動化。建議先採「人工啟動、檔案交接、明確 flag」。

若未來要試行輪詢，可用以下間隔：

- 簡單檢查任務：每 30 秒檢查一次。
- 一般修改任務：每 60 秒檢查一次。
- 需要跑測試、登入或資料庫驗證：每 90 秒檢查一次。

在 5 分鐘時限內，應避免兩個 AI 同時修改檔案。較安全的流程是：

```text
Codex 檢查或修改
Codex 寫 handoff
Codex 把 flag 交給 Claude
Claude 檢查或修改
Claude 寫 handoff
Claude 把 flag 交給 Codex
Codex 收斂、驗證、提交
```

## 防呆規則

若未來實作近即時模式，至少需要以下規則：

1. 開始前必須讀取狀態檔與交接檔。
2. 只有 `current_agent` 可以修改業務程式碼。
3. 交接前必須寫明改了哪些檔案、驗證了什麼、還沒驗證什麼。
4. 若 lock 過期，下一位可以接手，但必須先在 `log.md` 註記。
5. 若對方說法與程式碼不一致，以 `rg`、檔案內容與實際驗證結果為準。
6. 涉及共享模組、navbar、登入、資料庫寫入、週卡顯示的修改，不可靜默繞路。
7. 若需求與現有系統契約衝突，先停下回報，不自行改成另一種流程。
8. 不同 AI 不應同時修改同一檔案或同一功能邊界。

## 暫不實作的原因

目前先不實作自動輪詢，原因如下：

- Codex 與 Claude Code 的執行環境不一定都支援背景定時輪詢。
- 自動切換 ownership 若設計不完整，可能造成互相覆蓋或漏驗證。
- 現階段更重要的是讓非同步交接穩定，包括讀 SOP、查證現有功能、寫清楚 handoff。
- 先讓檔案交接模式成熟，再加入自動輪詢，風險較低。

## 未來實作條件

可在以下條件成熟後再考慮實作：

- `agent-handoff.md` 已被穩定使用。
- Codex 與 Claude Code 都能遵守 file ownership。
- 修改前會固定查閱同類型參考頁與 shared modules。
- 完成任務後會固定留下 evidence 與 remaining risk。
- 已建立清楚的 high-risk change 清單。
- 使用者確認需要更高頻的 AI 對 AI 接力流程。

## 初步結論

這個模式可行，但第一版應保持保守。  
目前先把它視為「下一階段協作能力」的設計備忘錄，而不是當前開發流程的一部分。

