# 夥伴練功答題優先、語音與畫圖發布紀錄

臺灣時間2026-11-06 00:01:25已發布。正式來源main `4ba884e`，部署 `dpl_8PdjF5a9zKkhNmXTr1AMrJZSx9pg`，回滾前版 `dpl_8PFEpMsmXtjVoW3iJvz82NBhMf4W`。PR38為答題優先，PR39為私有語音／畫圖，PR40為正式資料庫快照；都已經PR進main。主畫面一次看自己的題目，提示點開營地，回覆後可以收合，沿用個人練習的純選項呈現與既有考古作答元件。

## Claude複核及修正

23:40起兩輪只讀複核（433秒／22次Read，113秒／11次Read），conversation viewer啟動與Git前後一致均通過。第一輪發現staging附件6筆失敗就永久卡額度，已改為最近1小時的暫存數限制；不刪除資料，仍保留每日20MiB位元組上限。新增舊6筆不阻擋、近期6筆第7次拒絕測試。上游HTML／網路錯誤改503可重試；busy送出提示保稿；選中答案的正誤顏色補CSS優先序。第二輪確認前述修正沒有新阻擋；顏色再以Chrome計算樣式確認兩情境通過。

## 實際通過的關卡

- 原輪41項Node／SQL通過，本輪再新增2項回歸，最新相關11項通過；原型Chrome14、合成雙頁整合10、答題回歸17已通過。這些不使用環境麥克風或真學生資料。
- 真正式PostgreSQL17.6交易內建立合成Google名冊角色，跑建房出發、intent、service finalize、私有草稿、送出與replay、草稿跨人拒絕、非成員拒絕及snapshot安全；原snapshot OID保留／複製body一致。全部ROLLBACK，無殘留合成帳號。
- 乾淨main套單一增量SQL，SHA256 `0250e86b277d30ceed25bdda9e674d71ff9a508898a7be7d505e496c8ed59d6e`。函式148→152，只有4新增／learning_snapshot修改，其餘相同。snapshot／live-check通過，19張既有資料表摘要在回滾、套用及前端發布後皆相同。
- 私有bucket `partner-message-media`，上限960044 bytes、僅audio/wav；資料表RLS開啟，anon／authenticated無表權限，finalize僅service可用、學生不可直呼內部snapshot。原Storage兩條policy仍只限homework-thumbnails，沒有新增公開讀取規則。
- 新Edge v1 ACTIVE、verify_jwt=false，由handler自行驗證登入。正式OPTIONS200、匿名401、失效登入401、外站403；瀏覽器確認教師帳號後讀取403 ACCESS_DENIED，pageerror0。
- 發布腳本完整樹比對ok:true：10修改、10新增、無刪除、無非預期或換行例外；候選及正式各20檔SHA256與main相同。正式alias已指向新部署，發布鎖釋放。[公開驗證收據](partner-camp-media-verification-20261106.json)。

## 尚未驗證，明日實機驗收

真正的麥克風授權、Google兩個名冊帳號兩台裝置成功互傳、正式雲端正向附件上傳、iPad/Safari及Android互錄互播、真實IME／觸控仍未驗證。教師403只證明拒絕路徑，不能當作學生上傳成功；合成雙頁與交易內角色也不能替代真人兩機。

建議兩位學生用不同帳號：建立／加入小隊→準備出發→各答一題→請教改用語音→另一端點播放並畫圖回覆→收起營地繼續原題→留一份未送語音或畫圖草稿→儲存退出→重開接續→共同回顧／訂正與紀念葉花。確認答題與文字草稿保留，關閉營地後麥克風指示停止，新訊息不自動播放。麥克風不支援時仍可用畫圖或文字。

音檔保存期限未核定，沒有自動刪除排程；沒有外部AI語音轉錄，花葉規則不隨訊息量改變。原題圈畫仍是後續項目，目前訊息畫板是空白紙。

## 發布過程的專案連結問題

第一次候選在新worktree尚無 `.vercel/project.json` 時，CLI自動建立了同目錄名的專案。發布腳本驗projectId立即擋下，未promote到正式站。已刪除這次誤建的專案 `partner-camp-release-20261106`，明確link回既有it-class-tcwu；CLI產生的.env.local與.gitignore追加亦已移除，保持待發布main乾淨，再由相同發布腳本重跑通過。未更動原正式專案或跳過guard。

以後新發布worktree必須在deploy前確認 `.vercel/project.json` 的projectId是 `prj_eJ1qle57xyilS5MKy6ZS6OuYtyFb`、orgId是 `team_SOhQ0oysg6ZGV9vs3RryW2CB`。不讓CLI依目錄名猜專案；若用link，檢查它是否改.gitignore或產生.env，避免把此副作用帶入發布來源。這次尚未修改發布腳本的前置連結檢查。

回滾先回前端，再處理DB；增量schema可以保留，避免刪除學生附件。不得在新版前端仍使用時移除新RPC，否則儲存退出會失效。
