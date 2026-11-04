# 六年級115-1第09週功能契約與驗收

日期：2026-10-30。前端尚未發布；已核對正式教師帳號並完成閱讀週次、08隱藏／09顯示設定。

## 基本資訊與視覺

- [x] 六年級115-1；頁面 `grade6/115-1/week09.html`，C類課程說明＋中英打。
- [x] 固定視覺基準 `grade6/week17.html`，已取得桌面渲染供比對；功能參考本學期 `week07.html` 的 navbar、登入與共用入口。
- [x] 延續 Noto Sans TC、漸層頁首、彩色圖示、圓形編號、白底圓角卡片、柔和彩色邊框及48px以上按鈕。本週以紫、藍綠、橘色區分活動。
- [x] 資訊圖卡使用內建 imagegen 生成，WebP約225KB；原圖1672×941。提示詞保留在 `grade6/115-1/images/week09/prompt.txt`。
- [x] 本週圖卡沿用 `shared/image-lightbox.css` 與 `initImageLightbox()`；不依賴登入、不新增進度。
- [x] 桌機1366px、手機390／360px無水平溢出；字型載入檢查通過。
- [x] 燈箱開啟、縮放、重設、Esc關閉通過，頁面無JavaScript錯誤。此為自動瀏覽器測試，非實體手機驗收。

## 導覽、登入與進度

- [x] 使用當學期 `navbar.js?v=20261030-week09`，不手刻navbar。
- [x] 呼叫 `initNavbarAuth()`；沒有直接綁定navbar按鈕或自行呼叫OAuth。
- [x] 第09週導覽加入；第08週從activeWeeks移除，首頁以第09週卡取代並設最新週。
- [x] 保留第08週HTML、所有資產、打字與學生紀錄，尚未轉製第10週。
- [x] 後台 `grade6-115-1` visibilityDefaults加入09並保留08供管理。
- [x] 本頁新增普通5關，使用initTypingChallenge與initTypingTools，沿用草稿模組、登入鎖定與精準錯誤提示；進度寫入student_progress，沒有localStorage進度。
- [x] 原第08週已核對的普通5關素材複製至第09週資料檔；`courseId: grade6-115-1`、`weekCode: 09`、`activityKey: typing_task_5`，與第07／08週獨立。reward-tree-config新增5關設定，my-tree更新快取版本；花園舊活動週碼與獎勵不改。
- [x] 考前練功房連本年級共用頁，自組卷帶 `#mine`；不重寫組卷、判分或保存。
- [x] 合成帳號驗證navbar登入點擊會委派共用登入入口；未執行真實OAuth跳轉。
- [x] 正式後台第08週已透過既有 `admin_set_week_visibility` 設為false，第09週設為true；`admin_list_week_visibility`重新讀取確認，只影響 `grade6-115-1`。本機首頁與navbar同步移除08。
- [ ] 正式第09週可見性切換測試與恢復待執行。

## 作業、閱讀與外部活動

- [x] 本週無新作品作業，不開放班徽完成作業；保留第05週原作業。
- [x] 閱讀連 `homework.html#reading`，自由分享、不列缺交，每週一張可修改，分享一葉、過關再一葉；週頁不硬寫period ID或動態活動鍵。
- [x] 第09週reading period：2026-10-26～2026-11-01，已透過既有 `readingRequest(..., 'configure')` 建立，重新list確認enabled為true。
- [x] 使用者重新登入後，正式後台可見身分與session皆為 `chianwu@gmail.com`，`isTeacher()`確認通過；才執行正式設定。未繞過學生／教師權限。
- [ ] 真實名冊學生入口驗證尚未執行；未借用真實學生帳號，也未代送閱讀或作答。
- [x] 校慶會旗入口沿用三年級第09週的 https://forms.gle/6EYf7aSkYvq7PBwz7，另開分頁並加noopener noreferrer；未代為投票或送出表單。
- [x] 考古題先介紹用途與範圍核對；依庫內發布紀錄，六年級專區尚未開放，沒有放三年級入口或錯誤連結。

## 驗證紀錄與交付邊界

- 自動化紀錄：ignored `tmp/week09-qa/result.json` 與桌機／手機截圖。
- 本機首頁確認沒有第08週卡且僅第09週卡有最新週標記；navbar無第08週入口。
- 尚未commit、push或部署。主工作區有其他尚未提交及正式部署中的變更，不可直接整包部署覆蓋。
- 正式閱讀週次與可見性設定已完成；真實學生閱讀可見性與前端發布仍待完成，不回報全部發布完成。

## 本次修訂

- 依教師要求，第09週改用原第08週的珍珠奶茶與Review 1素材，頁內獨立闖關、進度及草稿。
- 圖卡v2將「接續第07週」改為「本週獨立闖關」，由內建imagegen精準修改；提示詞保留prompt-revision.txt。
- 魔王花園覆蓋評估已補入教案：國語第1～3課尚無獨立魔王；英語Unit 1 Story可作未用篇章，原頁核對後已新增第09週兩個獨立魔王，詳見grade6-week09-boss-source-review.md。

- 本次進度回歸：合成帳號匿名鎖定、登入委派、第08／09週隔離、草稿寫入與回復、錯字提示、保存失敗重試、五關完成與重新載入接回均通過。攔截到5筆第09週student_progress寫入，沒有第08週寫入；未代真實學生送答。
- 靜態比對第08／09週普通5關文字完全一致，欄位均為id／ans。未改既有shared typing與草稿保存實作，沒有執行資料庫schema變更。

- 新增闖關後重新檢查1366px桌面與390／360px手機版，圖卡v2、頁內普通關與燈箱均正常，無水平溢出與JavaScript錯誤。
