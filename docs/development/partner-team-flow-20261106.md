# 夥伴練功：隊長／隊員與接續任務

使用者已於2026-11-06授權實作前輪討論、Claude複核後驗證發布。本輪從最新origin/main e38aa78開新worktree；已於臺灣時間 2026-11-06 07:07:45 完成正式發布。來源main `b028484`，正式 `dpl_8NhYoqpAA7mc29n1bm3yjEHR6uQV`，回滾 `dpl_8PdjF5a9zKkhNmXTr1AMrJZSx9pg`。

首頁分為「我當隊長」「我當隊員」，有未完成小隊才顯示置頂接續卡。隊長選卷與人數後分享邀請碼／連結／本機QR，隊員輸碼送出或完成登入後開連結即加入，等隊長出發；完全移除準備步驟。隊長在人數到齊後才能出發，10題葉卷固定2人、20題及考古2～4人不變。隊名／人物主題預設並可展開修改，答題權重與花葉不因隊長身分而改。

接續卡顯示卷名、隊友及等候／練習／回顧階段，按一次接原任務；完成卡放紀錄冊。既有會員與作答不重建、不重配。未出發前明確退出才離隊，隊長退出交給最早加入者並顯示提示；暫離頁面保留隊籍，開始練習後沿用儲存退出。邀請成功或失敗後消耗URL invite參數，避免退回首頁又自動加入；晚回應核對generation／view／serial。

## 權限與資料庫

單一增量SQL `supabase/quiz-partner-team-flow.sql` 在交易內以MD5守衛原地更新函式，保留OID與ACL。只修改lobby_action的host-only出發／人數條件／移除ready reset，以及public quiz_partner_pilot_action的me欄位。新增私有team_rooms只回本人小隊安全metadata，不含邀請碼、正解或私人來源session。舊ready RPC因舊頁相容保留，出發不使用它。沒有任何資料列遷移或自動清理。

Claude第一輪找到freeze_allocation另有ready門檻的P1，已同步只移除該子條件，保持人數／完整題包／凍結與不可重配保護。正式預期新增1函式、修改3函式，152→153；原有allocation與作答／草稿／獎勵不變。

## 複核與本機驗證

- Claude第一輪224秒／12次Read、修後69秒／5次Read；viewer啟動、Git前後不變通過。第二輪確認P1修復、沒有新阻擋。Claude僅讀碼，沒有替Codex跑測試。
- 32項Node／SQL累計通過：個人練習11、原partner穩定性5、Edge6、媒體SQL2、自組卷2、focused3、新team3。新team檢查隊長權限、未滿拒絕、ready忽略、重送去重、交棒、10題上限、私有metadata及原資料；三人20題完成回顧保留每人2葉。真實freeze／owner／snapshot定義加合成4／3／2／1包，2／3／4人皆無ready出發、整包同人，舊房無新增配題。
- 實際production app加兩獨立Chrome頁、合成登入與真PGlite，17檢查通過：條件式待辦、選卷人數、連結跨模擬登入直接加入、同步出發、答題存退接回、完成紀錄、輸碼加入、交棒提示、暫離保留、已出發邀請退路、三人考古觸發器、手機390px與pageerror0。背景分頁測試使用DOM事件，不冒稱真人鍵盤／IME操作。
- 本機預覽 `node automation/partner-team-preview.mjs` → `http://localhost:8822/grade3/115-1/partner-practice.html?actor=5`／actor=6。只合成資料，無外部Auth或正式寫入；QA API需本機標記header。

## 正式發布關卡（已完成）

功能經PR進main後，全新乾淨main以真PG交易內合成名冊角色測考古出發、host/full roster/重送/metadata/草稿並ROLLBACK；原19表摘要與既有配題需不變。確認無他人發布鎖，只套本輪增量SQL；匯出snapshot並live-check，核對僅1新增／3修改後PR回main。再次新乾淨main以release-from-main start/deploy/promote，完整樹比對與正式ID守衛通過再切換；發布登記經PR。

真人Google雙帳號兩台裝置、實體掃碼、真IME／觸控尚未驗證。合成登入不代表真OAuth已實測；原auth.js保持不動，已核對storeLoginReturn保存完整href供返回。

正式結果：PR42／43合併後依序完成真PG交易回滾、單一增量套用、153函式snapshot/live及新乾淨main發布。21表資料摘要（含既有配題）在回滾／套用／前端發布後皆相同，沒有殘留合成Auth。來源、角色與權限檢查通過；額外CLI唯讀核對曾停在登入初始化，停止自己的查詢後改走已驗證同帳號的官方read-only API，取得相同SQL核對結果全通過，沒有放寬權限或改登入設定。

候選與正式各10個runtime檔SHA256同main，完整樹8修改／2新增／無刪除或非預期；正式alias確認、發布鎖釋放。Chrome正式頁載入新版腳本與CSS、教師帳號正確ACCESS_DENIED、pageerror0；這是拒絕路徑驗證。[公開驗證收據](partner-team-flow-verification-20261106.json)。
