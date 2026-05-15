# Supabase 分頁切回失效事件紀錄

> 建立日期：2026-05-15
>
> 適用範圍：`shared/auth.js`、`shared/navbar-auth.js`、`shared/typing-challenge.js`、`admin-progress.html`，以及任何會在登入狀態下讀寫 Supabase 的課堂頁面。

## 摘要

這次問題不是單純的「按鈕事件監聽消失」。真正的主因是：瀏覽器分頁切到背景再切回前景時，Supabase auth/session lifecycle 可能重新確認 session、刷新 token、或重新發出 auth event。若頁面在這些事件中重讀資料、重畫 DOM、等待 Supabase SDK request，學生或老師會看到按鈕延遲、表格閃爍、進度寫入 timeout，甚至誤以為按鈕失效。

Supabase 官方文件說明 `SIGNED_IN` 可能在使用者 session 被確認或重新建立時觸發，包含 refocus tab 的情境。不要把每一次 `SIGNED_IN` 都視為「使用者剛登入」。

參考：

- Supabase auth events: <https://supabase.com/docs/reference/javascript/auth-onauthstatechange>

## 觀察到的症狀

1. 中英打闖關：學生打到一半切到別的分頁，再切回來按「檢查答案」，畫面顯示過關，但 `student_progress` 寫入 timeout，後台沒有紀錄。
2. 登出鈕：切回分頁後點登出，不會立即反應，要等 Supabase `signOut()` 回應。
3. 教師後台：切回分頁後表格會短暫顯示「讀取資料中...」，代表頁面有重新跑 `loadProgress()`，不是單純 repaint。
4. 教師後台按鈕：早期用「切回分頁自動重整」當暫時措施，遮住了按鈕與 session lifecycle 的真正問題。

## 根因

### 1. 不應把分頁切回當成整頁重整時機

`pageshow`、`visibilitychange`、`focus` 在切分頁、BFCache 回復、視窗聚焦時都可能觸發。若在這些事件中呼叫 `window.location.reload()` 或重跑完整資料同步，會造成畫面閃爍，也會讓事件監聽、目前操作狀態、尚未完成的請求更難判斷。

後台曾經用切回分頁重整作為 workaround，但這會掩蓋問題來源。修正後，後台不再在 `pageshow`、`visibilitychange`、`focus` 中 reload 或重讀表格。

### 2. Supabase `SIGNED_IN` 可能在 refocus 時重新觸發

`onAuthStateChange` 的 `SIGNED_IN` 不只代表使用者剛完成登入，也可能代表既有 session 被重新確認。若 callback 看到 `SIGNED_IN` 就重跑 `syncSessionAndRender()`，切回分頁就會重讀表格，造成「讀取資料中...」閃一下。

正確做法是比較前後 `user.id`：

- 從未登入變成登入，或換成不同使用者：可以重讀資料。
- 同一個使用者 refocus 觸發 `SIGNED_IN`：只更新 session/UI，不重讀資料。
- `TOKEN_REFRESHED`、`INITIAL_SESSION`：通常只更新 session，不應重畫整張表。

### 3. 進度寫入不應依賴可能卡住的高階 SDK 路徑

中英打闖關的進度保存是課堂核心路徑。切回分頁後，Supabase JS client 的 request/session 狀態可能延遲或 timeout。為了讓學生過關寫入穩定，`shared/typing-challenge.js` 的保存路徑改成：

1. 從 `shared/auth.js` 讀取目前 localStorage 內的 access token。
2. 用 direct REST `fetch()` 寫入 `student_progress`。
3. 使用 `AbortController` 設定明確 timeout。
4. 只要 2xx 成功就視為保存完成，不再把 UI 卡在 SDK retry/verification 流程。

這保留 Supabase RLS，因為 request 仍帶 `Authorization: Bearer <access_token>`。

### 4. 登出 UX 要先完成本機狀態，不等遠端 signOut

登出按鈕是使用者明確操作，不應因背景分頁恢復後的 Supabase request 延遲而卡住。修正後：

1. 先呼叫 `supabase.auth.signOut()`，但不等待它完成。
2. 立即清掉 `AUTH_STORAGE_KEY`。
3. 立即 reload 畫面。

若遠端 signOut 失敗，只記 console warning；課堂 UX 以「本機立即登出」為優先。

## 已採用的解法

### `shared/typing-challenge.js`

- 對 `student_progress` 保存改用 direct REST `fetch()`。
- Header 使用 `apikey` 與目前 access token。
- `Prefer: resolution=merge-duplicates,return=minimal`。
- `on_conflict=user_id,week_code,activity_key`。
- timeout 設為 10 秒。

### `shared/auth.js`

- 新增 `getStoredAccessToken()`，給高可靠度保存路徑使用。
- `signOutAndReload()` 改成先清本機 token 並立即 reload，不等待 `supabase.auth.signOut()`。

### `admin-progress.html`

- 移除切回分頁時的 auto reload。
- 移除切回分頁時的自動 `syncSessionAndRender()`。
- `storage` event 只同步 session/UI，不重讀學生進度表。
- `onAuthStateChange` 只在真的換使用者或從無到有登入時重讀表格；同一個使用者 refocus 觸發 `SIGNED_IN` 不重讀表格。

## 後續開發規則

1. 不要在 `pageshow`、`visibilitychange`、`focus` 中做整頁 reload，除非有明確、可重現、文件化的理由。
2. 不要在 `onAuthStateChange` 中無條件重讀資料。必須先判斷 event 類型與 `user.id` 是否真的改變。
3. 課堂核心寫入路徑（例如 `student_progress`）要能承受分頁切換、背景閒置、token refresh。
4. 看到「切回分頁後按鈕失效」時，先查是否有 auth callback、storage event、focus/visibility handler 在重畫 DOM 或等待 Supabase request。
5. 不要用「切回分頁自動重整」當正式解法。這只能暫時讓頁面恢復，會讓真正問題更難定位。

## 回歸測試清單

每次改 `auth`、`navbar-auth`、`typing-challenge`、`admin-progress` 或 Supabase session 相關流程後，至少做以下測試：

1. 學生登入，進入中英打闖關。
2. 打到一半切到別的分頁，等待 1 至 5 分鐘，切回後按「檢查答案」。
3. 確認畫面解鎖下一關，且教師後台看得到 `student_progress` 更新。
4. 教師後台登入，等待資料載入完成。
5. 切到別的分頁再切回，確認表格不出現「讀取資料中...」。
6. 切回後按「重設」按鈕，確認立即跳確認視窗並可成功重設。
7. 切回後按週卡顯示/隱藏開關，確認可成功更新。
8. 切回後按登出，確認立即反應。
9. 若要驗證上課情境，保持分頁閒置 30 分鐘後再重跑第 2、6、7、8 項。

## 偵錯提示

- 如果切回分頁看到「讀取資料中...」，代表 `loadProgress()` 被呼叫，不是單純瀏覽器 repaint。
- 如果 debug log 出現新的 `page-init`，代表整頁真的重新初始化。
- 如果 debug log 出現 refocus 後的 `auth-state-change`，要看是否為同一個 `user.id`；同一使用者不應觸發完整資料重讀。
- 如果 typing challenge 顯示過關但後台沒資料，優先查 `student_progress` 保存路徑與 access token 是否存在。
