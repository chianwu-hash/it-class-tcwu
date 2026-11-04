# 六年級第09週正式發布紀錄

2026-10-30，使用者明確授權commit、push，讓六年級第09週上線。

- 正式入口：https://it-class-tcwu.vercel.app/grade6/115-1/week09.html
- 功能提交：`404ed65`，分支 `codex/grade6-week09-release`，已推送同名遠端分支。主工作區其他修改未提交、未重設；沒有用舊main整包重新部署。
- 本次範圍：期中複習週頁與資訊圖卡、會旗票選、普通5關獨立進度、國語格言與英語賞鯨兩魔王、花園移除固定第05週連結、首頁／導覽／後台週次／努力樹設定，以及教案與查核紀錄。
- 第08週頁面、資產與學生紀錄保留；首頁及navbar移除08入口，正式week_visibility為08隱藏／09顯示。原班徽課程留待第10週轉製。

## 發布基礎與保留範圍

Vercel專案 `it-class-tcwu`／`prj_eJ1qle57xyilS5MKy6ZS6OuYtyFb`，團隊 `chianwu-4755s-projects`／`team_SOhQ0oysg6ZGV9vs3RryW2CB`，CLI使用者 `chianwu-4755`。已核對專案、團隊與部署目標。

發布前正式版為 `dpl_BygWat1GWL5VHPQ3UGnL3QG8MDoH`，包含較新的考古題音訊及身分同步更新；Git main尚未完整收錄。此次由該部署的完整凍結發布包開始，只加入本次16個runtime檔案，不整包部署dirty主工作區。

以Vercel來源檔UID（SHA1）核對基底，既有來源相符；新候選450個來源檔全部與預備發布包相符，434個非本次範圍的既有來源保持原摘要。既有lambda的輸出二進位不作為本機來源檔核對；其 `api/quiz-diagnostics.js` 原始碼保持不變，由Vercel正常建置。

`my-tree.html`只更新reward-tree-config快取版本，保留正式版其他功能；navbar以正式版為底只調整activeWeeks。Git提交的這兩檔也僅包含本次必要差異，沒有納入本機尚未發布的花園動畫等改動。

候選 `dpl_3Ab6ZKnw7M8oLkC8R6ikUAuG4GJL`／`it-class-tcwu-cwaf1cj6g-chianwu-4755s-projects.vercel.app`，使用production加skip-domain建立；以Vercel CLI驗證16個runtime回應SHA256後，promote至正式網址。正式inspect確認READY且指向同一部署。

## 驗證

- 正式完整發布包上，普通5關與兩個魔王的合成帳號回歸均通過：匿名鎖定、登入委派、草稿保存與接回、精準錯誤提示、保存失敗重試、完成重開接回、獎勵與重設隔離。沒有正式學生作答寫入。
- 正式網址16個runtime檔全部HTTP成功且SHA256與候選相同。
- 正式Chrome驗證：週頁、資訊圖卡燈箱、票選正式連結、普通5關、兩個新魔王（國語8行／英語24行）、花園8張卡、移除第05週連結、首頁第09週最新／無08入口、navbar無08入口，均通過。
- 正式390／360px尺寸無水平溢出，頁面零JavaScript錯誤；尺寸模擬不等同實體手機。
- 本週reading period已建立，2026-10-26～2026-11-01，enabled=true；正式API再次確認可見。此次工作瀏覽器為教師身分，因此這一項是教師查核，不宣稱已驗證真實名冊學生入口，也未代送閱讀小卡。
- 發布前確認正式六年級已有考古題專區，週頁改連 `quiz-library.html#past-exams`，撤除先前尚未開放的提示。
- 正常pre-commit成功執行PowerShell ASCII與agent state檢查，未停用hook。只stage本次22個功能與文件檔，後續文件提交單獨保存發布結果。

## 回復與後續

必要時可promote回 `dpl_BygWat1GWL5VHPQ3UGnL3QG8MDoH`；本次不含資料庫schema變更，不需回滾學生資料。閱讀與可見性為本次先前已完成的設定，前端回復不自動更動它們。

待後續：第10週班徽轉製、真實六年級學生閱讀入口確認。勿以main舊快照重新部署覆蓋目前正式版。

私有／暫存證據位於主工作區ignored `tmp/week09-release-plan.json`、`tmp/week09-release-hashes.json`、`tmp/week09-candidate-source-check.json`、`tmp/week09-candidate-check/`、`tmp/week09-live/`及`tmp/week09-live-hashes.json`。凍結發布包在本分支工作區ignored `tmp/production-release/`，不提交其他考古題來源或帳號憑證。
