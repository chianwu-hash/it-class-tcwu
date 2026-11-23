# 三年級第13週正式發布

## 英文新進度、帳號卡與教案SOP（2026-11-23後續）

- 使用者要求魔王中英文皆有新進度；中文保持已核新長句，英文原題改Unit4失物招領故事p.55、57，換題改p.60下午招呼及p.54驚呼／感謝／回應。八行英文彼此不同，未重複本週前關或第11／12週；全題107／93字元，各五行。原PDF四頁逐字目視，彎撇號統一鍵盤直撇號。
- 本週起移除獨立帳號確認卡；navbar登入、名冊核對、任務鎖定／保存照常。auth初始化失敗改寫快手狀態列，避免已移除節點造成例外；舊週頁不回改。
- 教案編寫SOP第4.1節加入原題／換題及前週對照、不重複、第5關新長句／標點加難、第6關新中英文整合加難，禁止只重排、改顏色或只換中文。同步教案轉網頁SOP、新頁檢核、三年級風格與本週6列核對表；三年級仍一律快手。
- PR444合併main `6180522b`，由乾淨main及發布腳本部署至`dpl_D54urQaB92NfPD9gZgUNQdUKtgmf`；回滾`dpl_FMJpZfESoJz97SvR3otdqZGDHm86`。完整樹比對4修改／0新增／0移除、`ok:true`；候選三個程式檔SHA與已驗來源一致，正式四檔HTTP200及內容一致，103筆目錄與獎勵設定保持，鎖已釋放。
- 本機新20行次桌手機注音／亮鍵、8卡視覺對照、完整合成Auth／RPC保存／失敗重試／接續／六組換題／登出／努力樹返回通過。首次錯字測試仍替換舊題red，已改為依目前第3行產生錯字，修正測試後完整重跑全過，未因測試問題更改產品判分。
- 正式URL重跑同一guide程式20行次全過，使用合成Auth，正式學生寫入0、pageerror 0；不以此冒稱代替教師真實提交／領獎。
- 私有證據：`C:/Users/user/Documents/pc-master/worktree-evidence/20261123-grade3-week13-english/`，含來源四頁、矩陣、版面、完整保存、候選與正式讀回。下列早期發布記錄為歷程。

## 魔王去重修正（2026-11-23後續）

- 教師指出魔王中文重複第5關；PR442改用p.87遠望風光與參觀收穫兩句，逐字目視原課本與注音。原題83、換題92字元，保持五行；新增去重回歸，原題／換題均與前五關不同。
- 新桌手機20行次逐字注音亮鍵、完整合成六關保存／失敗重試／接續／換題不回寫通過。沿原活動鍵、花葉與已保存進度；無SQL或學生進度重設。
- 乾淨main `6b806c7d`經腳本發布到`dpl_FMJpZfESoJz97SvR3otdqZGDHm86`；回滾`dpl_FELoBs3igpDPUcDksKLH6dAjYqQh`。完整樹比對4修改／0新增／0刪除、`ok:true`，候選content／JS／HTML原始檔SHA與本次測試來源一致，正式四檔HTTP200與內容讀回一致，103筆目錄及獎勵設定保持。
- 首次宣告漏列同步教案，候選被完整比較攔下，未promote；中止自己的鎖、補列教案後重新start／deploy／promote全過，未繞過比較器。
- 後續直接以正式URL重跑既有guide驗證：1280／390、原題／換題五行共20行次逐字注音亮鍵全過，正式學生寫入0、pageerror 0。使用合成Auth，不送正式進度。私有證據`C:/Users/user/Documents/pc-master/worktree-evidence/20261123-grade3-week13-unique/live-guide/`。下方初次發布與舊候選識別保留為歷程。
- 驗證程式重用：局部自寫代表helper在背景等待長句／首次初始化停滯，且同URL舊target曾造成目標斷言失敗；已停止自有worker、清理暫存分頁，未以失敗helper作驗收。改回本機已通過的`grade3-week13-guide-browser.cjs`，僅以`WEEK13_BASE_URL`切正式URL，即完整20行次通過。後續沿用此程式，不另寫一套簡化版本。`connectCdp`按URL可能拿到同站舊分頁，須比對本次target；長句先處理「看整段」。[Puppeteer等待文件](https://pptr.dev/api/puppeteer.framewaitforfunctionoptions)列明預設raf輪詢，背景分頁須考慮等待方式與可見性；這是停滯可能因素，未宣稱已單變因確證。既有程式的授權啟用目標分頁及完整等待路徑保留。

- 教師於2026-11-23明確授權正式資料庫登記、PR合併及上線，供本人測試登入、保存與花葉。
- PR440已合併，發布來源為乾淨main `0c5eabba8c911eb24a9a6471715541ed6f2fc63d`；由專案發布腳本start／deploy／promote完成。
- 正式部署：`dpl_FELoBs3igpDPUcDksKLH6dAjYqQh`；回滾基準：`dpl_6LNttUmzxy9DLSTSRNY3djDzqz94`。正式alias已確認，發布鎖已釋放。
- [正式第13週](https://it-class-tcwu.vercel.app/grade3/115-1/week13.html)

## 正式資料庫

以個人CLI明確指定`upxgyusodibaqcrocdzj`，從已合併main讀取`supabase/grade3_week13_typing.sql`；登記前兩列皆不存在。以repeatable-read交易加入前後指紋守衛，只新增：

| 目錄 | 活動 | 設定 |
| --- | --- | --- |
| grade3_google_activities | 13／typing_task_6 | total=6 |
| garden_reward_catalog | grade3-115-1／13／typing_task_6 | typing／6／five-then-flower |

交易內核對student_progress、garden_growth、garden_unlock_notices、全部既有函式，以及其他活動／獎勵列未變。套用後兩列讀回一致。未修改函式、RLS、ACL、學生進度、既有花葉或成長已讀狀態；180函式與ACL的`db-snapshot-check.mjs --live`通過，故無新函式快照。

前後收據及未使用限定的回復SQL保存於repo外。已有學生作答後，不得刪除登記；網站可回滾而保留資料。第一次額外守衛的集合比對寫法誤判，整筆交易回滾；改為前後暫存集合比較後才成功，沒有部分套用。

## 發布及正式讀回

- 11項資料／PGlite／權限／舊讀音回歸通過；原題／換題與新五行魔王注音亮鍵、完整合成保存證據見本週契約。
- 正式獎勵目錄與待發布來源103／103，missing、mismatched、extra均為零；發布後從正式網站取回來源再核對一致。
- 完整檔案樹比較`ok:true`：42修改、8新增、0移除；另4個純換行檔由比較器識別。
- 首次候選比對攔下`shared/quiz-image-item-marks.mjs`。SHA核對正式原檔後，確認僅兩行CRLF／LF差異，正規化後內容完全一致。保持main原檔及比較器；中止原發布鎖，明列此檔後重新start／deploy／promote，第二候選全過。
- 正式站50個本次檔案HTTP200及內容讀回相符，WebP按原始位元組核對，文字允許換行差異；首頁最新週、navbar、後台預設、基礎英打建議、Windows圖示及五行魔王同步。
- 正式站既有Google工作階段載入：本人名冊身分接回、闖關區解鎖、主線可操作，1280／390無橫向溢出，頁面錯誤0。未送出闖關、未進努力樹消耗首次動畫；不將既有工作階段載入宣稱全新OAuth登入流程驗收。
- 頁面初始化沿既有`reconnect_grade3_progress`身分接回流程，本次未另呼叫寫入RPC或提交測試進度。
- 本機checkout含已追蹤課本，直接執行雲端preflight會如預期拒絕；實際CLI依既有`.vercelignore`上傳，候選雲端建置關卡通過，未移除來源或略過檢查。

## 教師正式測試

1. 以學校帳號登入，通過第1關後重新整理，確認接回下一關。
2. 前五關完成得到一片葉子；第六關完成再得到一朵花。
3. 再練習與重新整理不應重領；其他週花葉保持。

實際逐關提交、Google重新登入與首次領獎由教師測試；本收據不冒稱已代為完成。Windows面板與Alt＋Tab仍須實體鍵盤操作。

私有證據：`C:/Users/user/Documents/pc-master/worktree-evidence/20261123-grade3-week13/`。本機3143預覽及原教學討論目錄有使用中服務或未提交成果，保留，不強制清除。
