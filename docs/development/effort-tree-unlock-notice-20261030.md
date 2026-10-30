# 跨闖關解鎖慶祝與一步前測試（2026-10-30）

使用者要求把30730測試帳號準備到小貓與小屋解鎖前一步，達成後不論在哪裡闖關都應慶祝、明確告知新功能、引導前往努力樹。維持前定學習優先、不提前公告獎勵門檻。

## 通知與觸發

- 新增 garden_unlock_notices／garden_unlock_notice RPC，不覆寫 garden_growth、quiz_action 或 quiz_rewards。只有已確認名冊的三／六年級學生本人可呼叫，匿名與直接表讀寫禁止。
- 成功儲存才檢查：一般打字、共用活動進度、基礎打字完成、練功房真正新增葉片／半葉，以及作業與閱讀資料讀回／提交；SDK直接寫student_progress成功時，由既有diagnosticFetch發出無資料事件交給navbar。未改寫fetch、不讀取診斷回應／學生答案、不攔截失敗或GET當成功。
- 學生頁navbar每次登入身分只讀一次pending；努力樹取得第二級狀態時也檢查。沒有計時輪詢，沒有每題／每鍵重算，第一級在伺服器快速跳過重算；第二級由正式collector重新核實。
- 訊息「新的陪伴來了！」說明「小貓和避雨小屋已經解鎖」，提供「去努力樹看看」與「繼續練習」。使用既有毛絨小貓圖及輕微慶祝動態；減少動態關閉動畫。等待原過關overlay或其他dialog關閉、且頁面可見才出現。
- 伺服器以每人pet-home唯一事件防重複；2分鐘claim租約防多分頁同時顯示，只有持有claim才可ack。確認後不重播，離頁未確認的通知可在租約到期後於下次頁面補看；不是即時跨裝置推播。連線／通知故障不影響已成功儲存的闖關。已經解鎖的舊學生以已讀狀態回填，避免當新功能再次慶祝。

## 測試帳號

307班30號 chianwu@apps.ntpc.edu.tw：原有獨立test setup葉28調至38，setup_id及花9保持，真實紀錄／quiz awards雜湊和成長baseline均相同。正式collector確認升級後新葉11、新花0、petUnlocked=false。總數55葉10花；再得一片新的完整葉才解鎖。這次沒有替使用者闖下一關或搶先生成通知。

## 驗證與發布

- PGlite合成測試11→12葉、未達不預告、pending跨頁、claim互斥、租約／過期claim、防錯人ack、確認後不重播、匿名教師／直接表存取拒絕通過。
- Chrome合成情境：原慶祝後再顯示、解鎖內容與正確課程樹連結、390px、減少動態、關閉確認不重播、零JS錯誤。9個接點檔與通知模組共10檔通過ES module語法檢查。未代答真人測驗以觸發通知，保留給使用者實測。
- 正式30730讀回11/0、55/10、尚無通知、pet未解鎖且無預告；三年級第九週navbar登入載入正常，零頁面JS錯誤。沒有宣稱每一科每一舊週頁都已完成真人端到端闖關。
- SQL新增前後核心函式雜湊不變：garden_growth dd67324a…、quiz_action 7551903b…、quiz_rewards 5ae975c9…。
- 正式 `dpl_CgFNve8sgdHtaykp7u26Suy4PAB9` 以當下 `dpl_92J7dh3fsfuyMQeAeBCjjCcfj2ye` 完整538來源為底，只改9個接點、新增通知模組，529其他檔UID保持。guard確認基準未變後promote，正式內容與關鍵路由核對通過。證據ignored automation/output/quiz/garden-unlock-notice/，測試準備SQL亦在該忽略目錄，不提交指定學生變更腳本。
- Git工作樹與正式練功房模組版本不同，來源同步只對不相同檔案做局部接點修改，保留Claude工作內容。發布包的quiz-server接點包含credit_added_now／earned_now兩種；舊release分支只在原earned_now行加接點，未以整包正式來源覆蓋舊分支。後續整合須比對當下正式來源，不能直接部署該工作樹。
