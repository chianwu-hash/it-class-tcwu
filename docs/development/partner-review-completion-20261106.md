# 夥伴練功：回顧引導與自動結算

狀態：已於臺灣2026-11-06 11:21:42正式發布。

PR55功能、PR56正式快照進main後，從新乾淨main `66b9aef`經官方release-from-main start／deploy／promote，正式部署`dpl_YFLs7rxodob61WM3agfDWjXwahwa`；回滾`dpl_EFDgQZUtQ1gTqaEqewRahFSA2djn`。完整樹ok:true，只有預期8個前端修改，0新增／刪除／非預期／換行例外；候選與正式各8檔SHA256同main。正式頁4項載入檢查及無pageerror、匿名RPC401通過，發布鎖釋放。Supabase管理端一次502已退避60秒後重新live核對153函式通過才promote。

37項Node/SQL、120項合成Chrome與正式PG回滾／增量通過。正式原資料摘要維持，沒有批次替歷史任務確認回顧或領獎。完整公開收據見[驗證JSON](partner-review-completion-verification-20261106.json)。以下保留實作過程與未驗限制，文中的待發布描述屬當時狀態。

使用者定案：共同回顧仍是完成任務必要條件；列表公開詳細進度；全員成功送答後引導大家回顧；最後一人主動確認後自動結算。沒有加入尚未定案的提前結束功能，也沒有帶入未核定的解析卡美化。

## 實作

- `quiz-partner-review-completion.sql`只增量替換team_rooms、action_core及public包裝三個函式，有原MD5與原鎖／分支守衛。沒有資料回填或刪改。原FOR UPDATE下，review明確確認後全員到齊才設finished，包裝同交易claim_award；舊finish及已完成後answer訂正補達保持。
- 清單增加聚合progress、本人確認狀態、成員送出／分配題數與確認狀態，限定auth.uid為成員的小隊；不回傳選項、題目答案、其他人個別正誤或私人草稿。全員送答前不顯示正確總數。
- 列表區分等待集合、答題、待本人回顧、等待具名夥伴、歷史全員已回顧待結算、可訂正補達、紀念已入帳與停用。未達標可訂正房保留接續入口，紀錄冊仍可查看。
- 答題介面持續顯示可達的回顧提示，不是五秒聊天通知，不自動切頁／展開營地／捲動／焦點。主動按前往才進回顧並置頂，原草稿及營地元件保留；營地與巢狀視窗開啟時隱藏背後懸浮提示，不中斷錄音或畫圖。
- 回顧頁首顯示進度、等待者與步驟；確認仍在末端，留言可略過。沒有全員確認前的無說明disabled完成按鈕。舊全員已確認未finish房仍提供手動結算相容入口，不替它們批次結算。
- 最後確認者依伺服器成功回應進紀錄冊，其他人留原畫面並獲結果引導；原server award轉換才慶祝及防重規則保持。

## 驗證及限制

- 21項Node／PGlite SQL於單並行模式通過，含2/3/4人、首人不結算、最後確認自動葉／花、同請求重送、更新回顧、舊finish、60%訂正、同內容同成員防重／換成員可計、自核對不發獎、權限與原任務紀錄保持。初次多檔並行因本機記憶體不足失敗，改逐項跑通，不列為原成功。
- 雙頁合成身分、真正本機SQL與正式app流程通過；不是實體兩台／真人Google登入。原focused/actions/edge通過，outcomes舊版按鈕假設已改為核定的新行為，修後待最終重跑。
- Claude CLI supervisor兩輪完成：初輪`partner-review-completion-code-20261106`指出窄螢幕浮層遮擋P2；修後`partner-review-completion-fix-20261106`無可確認P1/P2，viewerStarted及Git不變通過。Codex獨立補測320/360/650/768/1280三浮層elementFromPoint均可操作、營地開時隱藏及不搶焦，共12項通過。修正更新已完成回顧不跳頁、最後確認進總結焦點與完成式文案。
- 核心SQL擴為6項，含中途僅一人答完仍不提前顯示分數，以及歷史全員已回顧未finish房不自動回填。雙頁SQL流程19項通過，含實際revision增加後才驗更新不跳頁；原outcomes41及focused/actions/edge/read/lightbox通過。
- 尚須正式PG回滾及增量、snapshot/live、PR/main與乾淨main發布腳本、完整檔樹比對與正式資產讀回。真Google兩機、真麥克風／觸控／報讀器及兩個真正PG連線同時提交仍未實測；併發安全目前由原rooms FOR UPDATE與同交易award／重送測試及程式複核支持。
- 另外嘗試兩個歷史考古學習來源測試，因本機缺少對應私有教材產出無法執行，未列為通過；本輪未修改它們，原個人測驗／組卷、權限及夥伴與媒體測試另有實際通過紀錄。
- 私有證據只在ignored `.chat-mode/`，不提交學生資料或憑證。凍結的SQL fixture只有函式定義，保留原CRLF以驗MD5，不包含學生資料。

## 正式DB驗證

功能PR55/main a66d1f0後新乾淨main操作。真PG交易演練先ROLLBACK；首人等待、最後確認自動1葉、重送同獎、舊finish相容、本人清單與非成員拒絕、早期分數不揭露及原OID/ACL/owner保持通過。最初來源及班級不符的合成測試被原權限拒絕，未繞過；調整為已發布老師卷的允許班級空座位合成名冊後通過。所有合成Auth／作答已回滾。

正式套用相同main SQL增量時，以同一repeatable-read交易比較21張原資料表雜湊、原函式權限及非本輪函式定義，確認不變才commit。套用前後正式唯讀摘要亦相同。最大既有成員清單8房，team_rooms約46.805毫秒。schema snapshot/live通過153函式（100表／21policy／13trigger），僅3函式更新，沒有前端發布或替學生確認／發獎。

最新隔離驗證：37項Node/SQL、雙頁SQL＋app19項、五寬浮層12項、原focused17／actions12／edge10／read7／lightbox2／outcomes41通過。尚未真人Google多機、實體媒體／觸控、報讀器或雙PG連線同時提交。兩個歷史教材來源測試缺私有素材不列通過。
