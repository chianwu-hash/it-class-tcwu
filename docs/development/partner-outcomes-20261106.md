# 夥伴練功：送出提醒、結束引導與夥伴紀念

已正式發布：PR45進main `0543996`，臺灣時間2026-11-06 09:01:23經release-from-main切換 `dpl_FuTwKPGevKufL2To2NiNVyagJmky`。候選及正式各8個runtime檔案與main SHA256相同，完整樹ok:true、發布鎖已釋放，正式載入4檢查及匿名401通過。回滾 `dpl_8NhYoqpAA7mc29n1bm3yjEHR6uQV`。本輪不改資料庫或既有紀錄。

## 功能契約

沿用已發布的答題優先介面、共享 navbar 與登入、既有 RPC／requestId／expectedAttempt／草稿版本。只新增呈現與明確操作引導，不修改 SQL、題庫、配題、名冊、作答紀錄、個人練習或花葉政策；不代送草稿，不以草稿增加完成題數。

1. 每題標示「尚未送出／已選或已填但尚未送出／已送出」。訂正另標尚未送出的訂正。一般選項0、考古否值false都算有作答；空白文字、空陣列與手寫空初始化不算。只辨認本人目前作答版本的草稿。
2. 跳題或切換分頁保留草稿並提醒；階段提示可回到未送題。儲存退出前若有未送答案，原生dialog提供「回去確認並送出」及「只儲存草稿並退出（不會送出）」。Esc回到答案。沿用原保存路徑，只有按送出才寫answer。不新增localStorage或自動存檔。
3. 全員送答後，醒目提示共同回顧；本人回顧後顯示等待人數；全員回顧後，可主動按「完成任務，看看共同總結」。另一人完成任務時，只提示翻開紀錄冊，不強迫換頁。更新guide與按鈕，不拆正在作答、組字、畫圖、播放音訊或回覆的DOM。
4. 紀錄冊保留每位夥伴的努力片段、全組正確率與原始紀念圖。未達60%清楚列出還需訂正的可判分欄位數；跳轉只限本人答錯題，不自動開始訂正、不改原紀錄。本人無待訂正題時引導營地支援。全自我核對卷不承諾「訂正0題可得獎」。
5. 慶祝只根據同房同人已觀察到的「無award→server award」且finished、earnedHere=true；用伺服器的實際葉花數量。非模態橫幅不搶焦點、不自動切頁，可關閉；短動畫只播一次，支援prefers-reduced-motion。閉包Set只做本tab顯示去重，換人／換房清基準；初次看到已存在的紀念不誤播，earnedHere=false亦不播。沒有修改努力樹入帳或首次成長已讀狀態。

## Claude協作

- 修改前 `partner-outcomes-plan-20261106`：Claude CLI 2.1.289、subscription oauth_token、只讀Read/Glob/Grep，19turn／6Read／312秒，viewer已啟動、Git基準一致。方案與上述契約一致。Claude沒有執行測試。
- 接受的具體修正：reviewOpen／全員回顧按鈕採獨立狀態更新，不依賴練習題目render key；draftVersions只在answer成功時清除，不能由mark等動作清除；紀錄冊key包含本人attempts與gradedTotal；本人明確finish後強制刷新紀錄冊。
- 修後 `partner-outcomes-final-20261106`：26turn／12Read／398秒、viewer及Git不變通過；無P1/P2阻擋。建議的P3已補：dialog任何關閉均回未送答案、guide更新保留鍵盤焦點、逐題移除重複live region、busy操作有提示；原app的controls短暫恢復後render修正行為維持不變。針對性複核 partner-outcomes-polish-20261106（13turn／2Read／104秒、viewer／Git不變）亦無阻擋。再補返回題目及關閉慶祝焦點；測試預覽限定localhost。

## 驗證與界線

- Node：outcomes 4、focused 3、self 2、stability 5、production 2、team 3，共19項通過；合成資料庫驗證既有任務、草稿、訂正補發、同題同人去重、新成員組合及原個人練習資料保留。
- 修正既有team測試fixture：main的production snapshot已含team-flow，不能再重套需要舊MD5的歷史遷移。fixture改直接安裝現行snapshot的team_rooms／lobby／wrapper／freeze；沒有更改正式SQL或解除基準保護。
- Chrome：新增outcomes 41項、原focused 17／actions 12／edge 10／read 7／lightbox 2項通過，共89項；合成資料隔離preview `http://localhost:8824/`，只使用註冊工作瀏覽器租約與精確target。原生dialog及鍵盤Esc另有實際pointer檢查；注音以CompositionEvent模擬，不冒稱真實IME。媒體整合使用同一新worktree、獨立port8825（preview改支援PORT，測試支援指定兩個精確URL，限定localhost），10項通過（語音、畫圖、草稿與重送、原選答保留、手機版面）；加上媒體共99項。最新DOM快取小修後focused及媒體已再次通過。
- 原focused保存測試依新契約補上「只存草稿」確認，等待保存完成後才接續；actions測試補上明確前景授權以免背景scroll等待。這些是測試流程調整，非弱化驗證。
- 不以合成登入當真人Google兩帳號／兩台裝置；真注音、平板觸控／螢幕閱讀器仍未測。本輪沒有改媒體錄音／傳輸功能。
- 最終驗證及Claude複核通過，已經PR/main及新乾淨main發布完成，結果見頂部及handoff。

- 最後自查重現：直接比較DOM innerHTML與原始字串會因data屬性序列化而每個快照重建橫幅、重播動畫。已改閉包guideKey／celebrationKey，只在原始呈現字串改變時換DOM；clear時重設。新增相同快照保持慶祝節點／guide按鈕節點及關閉後焦點測試，41項outcomes通過。Claude最後針對性複核 `partner-outcomes-cache-20261106`（3turn／2Read／54秒、viewer／Git不變）無P1/P2；最新48項介面與10項媒體再次通過，總計99項browser。已知不阻擋邊界：呼叫者重複focus無資料影響；伺服器若缺award數量則保守不慶祝；真實報讀器未測。
