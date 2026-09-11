# 作業繳交設計討論｜2026-09-11

## 結論

Codex 與 Claude 經兩輪完成的唯讀討論，認為「統一繳交入口＋老師不定期指派作品＋每週自願閱讀分享」可行。老師已於審查後確認週次、舊週修改與第二葉規則，詳見下方定案；共用後台不代表文字小卡必須套用 Drive 檔案資料結構。

## 已定案，不能被舊程式覆蓋

- 老師指派的作業放上方；本週閱讀小卡放下方，採邀請分享，不顯示閱讀缺交或計入待繳統計。
- 閱讀每週一張有效小卡，允許修改並保留歷史。不以修改次數計算獎勵。
- 作品與閱讀：繳交一葉、過關再一葉；不產生花。中英打維持原規則。
- 努力樹只有統一 navbar 入口，不嵌入作業頁。
- 設計審查時為靜態原型；正式實作與驗證紀錄見 [閱讀小卡正式版](reading-release-20260911.md)。

## 審查後建議

1. 閱讀採穩定週期識別；唯一限制應包含課程／學期、週期、學生，不可只有學生與週碼。限制由後端保證，不能只停用送出按鈕。
2. 文字小卡保存不可覆寫的歷次版本，另有目前版本指標。共用評比、回饋、歷史的操作邏輯；不為文字建立假檔案或 Drive 上傳。
3. 最新版、評比、獎勵的關係要一致。建議以目前有效狀態推導葉子，不用事件次數累加。
4. 保留檔案系統既有版本防護：`supabase/homework_review.sql` 的鎖列、目前 upload 比對、annotation 時間戳檢查。這些保護不能概括成完全避免所有多分頁最後寫入覆蓋；新增文字流程仍需明確版本檢查。
5. 保持快速評比；收回評比可立即復原，無需強制增加每次確認對話。

## Claude 初輪建議的修正

- 不採用「一定要更改花色解鎖門檻」：中英打仍會開花，三朵花門檻可以保留。
- 不採用僅 `user_id + week_code` 的唯一鍵，補上課程／學期與穩定週期識別。
- 收回評比的確認視窗降為非必要；優先可逆操作。
- 不強制新增名為 reading 的獎勵分支：獨立分支或共用作業獎勵轉接器屬實作選擇，必要驗收是兩葉不開花、週期隔離與不重複累積。

## 審查後老師定案

- **統一依學期週次對應**：作品與閱讀都使用該學期的原週碼。因放假或活動沒上課，可能沒有該週任務／閱讀小卡，允許缺號，不把之後的任務順延重新編號。正式實作依學期週次與開放週設定，不自行套用 ISO 週數或連續流水號；實際日期對照需使用學校學期行事曆。
- **允許補分享舊週、修改舊週小卡**：針對已提供的歷週閱讀小卡可補分享或修改；缺號週不因補分享而自動建立任務。每位學生在同一課程／學期、同一週只有一張有效小卡，歷次修改保留版本。補分享歸入所選原週，不歸入送出的當週，也不占用當週的小卡名額。
- **第二葉以最新有效狀態為準**：繳交後一葉；過關後共兩葉。過關後重交或收回評比，第一葉保留、第二葉暫時收回；再次過關恢復第二葉，不額外累加。改為再努力時亦不符合過關條件。作品與閱讀均適用，中英打規則不變。

### 驗收例子

- 第 03 週沒上課而未提供小卡，第 04 週仍標第 04 週，不改成第 03 週。
- 第 04 週補分享第 02 週小卡，記在第 02 週；仍能另分享第 04 週小卡。
- 過關小卡的葉數隨修改與評比為 `2 → 1 → 2`，同一小卡最多兩葉、不開花。
- 開放補分享不改變閱讀自願性質，不新增缺交、遲交或待繳統計。

以上為正式實作的驗收規格；審查紀錄仍保留當時狀態。

## 審查紀錄

- Transport: Claude CLI supervisor, Claude Code 2.1.233, claude.ai Pro subscription; medium effort; read-only; no API billing fallback.
- Working tree: `D:/projects/it-class-tcwu`; branch `main`; HEAD `6e5cbf876100d9229351e2b0b4ce6f2a7fe10b75`.
- First attempt: `20260911T035022Z-homework-design-review`, stopped `max_turns` after 77 seconds; no final review; preserved, not resumed.
- Successful session: `20260911T035022Z-homework-design-review-focused`, turn 0001 107 seconds; resumed turn 0002 37 seconds.
- Responses: `.chat-mode/sessions/20260911T035022Z-homework-design-review-focused/turn-0001.response.md` and `turn-0002.response.md`.
- Both successful turns' before/after Git snapshots match. Codex independently compared branch, HEAD, upstream, upstream HEAD and full porcelain status to baseline: unchanged.
- Validation: read-only design review and source inspection; no new application tests, code integration, SQL changes or deployment. Only Codex's handoff and this report were added outside the review window.
