# 三年級115-1第12週正式發布收據

## 2026-11-18 追加Ctrl＋拖曳複製

- 使用者明確要求改完上線。[PR312](https://github.com/chianwu-hash/it-class-tcwu/pull/312) 經Claude只讀複核無阻擋後合併，來源乾淨main `b652314d296b151b2c1fc3714e5e80472f2068c7`，正式 `dpl_E23V5KdC7e7n3p9asCZANtkoVAKt`，回滾 `dpl_8gQ2si8DKeiqqAEWMeEYRxatsQ25`。
- 指定main發布腳本完成2改0增0刪，完整樹兩次ok／unexpected0／eolOnly0；受保護候選HTML與main一致，正式HTML及教案HTTP200、bytes／SHA相符；alias確認、鎖已釋放。
- 五關最後的進階區加入直接拖曳搬移與先按Ctrl再拖曳複製，強調先放滑鼠、再放Ctrl。自由框「桌上：彩色鉛筆／筆筒：」可復原後比較；仍預設收合、不要求一定要會、不計五關／花葉，明列教師補充。
- 12項本週既有測試通過。本機及正式來源隔離Auth的Chrome原生pointer／鍵盤實測：直接拖曳移除來源、Ctrl＋拖曳保留來源且目的地多一份、兩者Ctrl＋Z復原、五關計數不變；1280／390無溢出，pageerror0、真實學生寫入0。
- Claude review `20e66f7f`、session `20261118-g3-week12-ctrl-drag` completed，viewer啟動且Git前後一致；Claude只讀文案及程式差異，未親自重跑實機。本次無JS／CSS、課本頁碼、auth／progress／reward或SQL變更。完整原始review與瀏覽器／發布證據依SOP私有封存。

## 2026-11-18 課本頁碼與進階選練更新

- [PR310](https://github.com/chianwu-hash/it-class-tcwu/pull/310) 經Claude只讀複核無阻擋後合併；正式來源乾淨main `74e2217d835ca52c48873f062c676b83e4f83749`，部署 `dpl_8gQ2si8DKeiqqAEWMeEYRxatsQ25`，回滾 `dpl_DDWAD2YHDAeNR7Lwffq3NcJPfrn7`。
- 使用既有main發布腳本，完整樹4改0增0刪、unexpected0、eolOnly0；受保護候選HTML與main一致，正式4檔HTTP200與SHA／bytes相同，alias確認且鎖已釋放。
- 課本原頁p.88、89、126～128由Codex目視；四技能卡及五關顯示頁碼，教案另列完整對照。檔案剪下／拖曳延伸到文字、反白取代為教師補充，均明確標註。
- 五關後新增預設收合進階文字拖曳練習，不要求一定要會、不檢查過關、不計五關、不給花葉。Chrome原生pointer拖曳選取、拖動反白文字至第二行、Ctrl＋Z復原與五關計數隔離，在本機及正式來源通過；1280／390無溢出、pageerror0、真實學生寫入0。
- 12項既有本週測試與十組原生剪貼／動畫回歸通過；本次無SQL、auth/progress或獎勵規則變更，未重寫或清除學生進度。Claude依提供的原頁摘要檢查實際程式，未獨立檢閱私有課本或重跑瀏覽器，完整run及原始response封存。

以下為2026-11-17首次發布紀錄。

- 授權：使用者指示「先給Claude複核，沒問題後上線」。[課程契約](grade3-week12-contract.md)、[PR302](https://github.com/chianwu-hash/it-class-tcwu/pull/302)、[發布登記PR303](https://github.com/chianwu-hash/it-class-tcwu/pull/303)。
- 正式入口：https://it-class-tcwu.vercel.app/grade3/115-1/week12.html
- 唯一發布來源：乾淨 `origin/main`，commit `79eedbdc6dabf100d4a0504c4ea2ea50a088e16c`。
- 正式部署：`dpl_BiwL27rdTrEZZcqJKrgqCo5pj9bR`；上一版／回滾識別：`dpl_3sTeS8gip6gdsUFdt7FVA5DcF9tA`。
- 使用指定 `release-from-main.mjs start → deploy → promote`，完整樹比對兩次均 `ok:true`，51改、11增、0刪、0非預期差異；正式alias確認後腳本釋放本次鎖。發布時間與逐檔清單見交接頂部登記。

## Claude複核

Claude Code 2.1.323，session `20261117-g3-week12-release-review`，reviewed `ae003c3d`。只讀實際程式、SQL、共用auth／progress與測試；run completed、完成標記完整、Git前後一致。結論：沒有阻擋上線的程式問題。審查範圍與未逐檔閱讀部分如實保留在原response；圖卡、manifest與草稿功能另由Codex瀏覽器／原始碼證據負責。

## 正式驗收

- 62個變更及新增檔透過正式網址逐一HTTP讀回，全部200且SHA256／bytes與發布main來源一致。候選站以既有Vercel CLI授權讀取，HTML與main完全相同；未停用部署保護。
- SQL僅本週 `grade3_google_activities` 與 `garden_reward_catalog` 各一列，來自main `96afccd4`，附正式garden_growth版本守衛與交易內postcondition。活動14→15、目錄98→99；函式、RLS、其他學生資料未改。180函式live snapshot一致。發布後公開目錄99／99，missing與mismatched均0。
- 專用307班30號測試帳號先核可見Google帳號及身分、確認本週原本0列；實際鍵盤輸入六關、逐關RPC讀回score1～6。第3關重新整理接第4關，第6關重新整理仍全過。前四關0葉0花、第五關1葉0花、第六關1葉1花，由正式進度和共用前端reward model驗證；伺服器garden_growth函式與正式快照一致，0～6關規則另經隔離PostgreSQL實跑。
- 可見教師帳號後台篩選專用帳號與本週，完成狀態／分數6回讀通過。教師切換本週隱藏，首頁與navbar均隱藏，再恢復顯示與本週徽章；最後保持顯示。
- 測試後僅刪除該專用帳號 `grade3-115-1 / 12 / typing_task_6` 的新列，附帳號、名冊、完成分數守衛；deleted1、remaining0。未進努力樹、未呼叫成長已讀寫入，保留學生首次體驗。
- 正式站原生pointer選取與OS剪貼快捷鍵10組通過：結果與操作證據、復原／重做、錯貼改正、重打拒絕、換題隔離。五關成功時badge及六星實際動畫播放、位移、約1.1秒停止，重複檢查不重播；減少動態效果保留文字。1280／390無橫向溢出、pageerror0、此矩陣真實學生寫入0。
- 17項本週單元／隔離DB通過；同次main帶入已合併而未發布的手寫共用支援，補跑26項回歸通過。21項練功坊產物檢查通過；不啟用新數學題或新增題庫資料。
- 圖卡、燈箱、草稿、保存失敗重試、匿名／他人隔離、重練不倒退與舊活動獎勵已在契約列明的本機／合成矩陣通過，不冒稱全部是正式帳號驗收。

## 限制與可重用診斷

Windows原生右鍵選單、實體Microsoft注音候選窗及真正兩裝置仍屬人工檢核；已驗原生剪貼快捷鍵與合成組字事件鎖定。

背景QA分頁曾造成Puppeteer等待與DOM操作停滯。選對學年度／課程後仍等待逾時，授予一次前景權限並對精確目標呼叫 `Page.bringToFront` 後，同一程式／相同正式網站立即通過教師控制與六關保存，無需修改產品程式。後台Google進度列的 `data-student-code` 不保證有值，驗收改用專用email篩選後核對分數；不把測試選擇器假設當產品失敗。

## 證據與收尾

完整Claude request／response／run、SQL前後回讀、正式逐檔雜湊、六關回讀、教師驗收、剪貼與動畫截圖保留於本機私有封存，公開repo只保存本收據。封存及工作目錄清理使用SOP逐檔SHA256驗證、正常git worktree remove；未提交的原始教案草稿保留。純清理收據留repo外，避免循環建立發布。
