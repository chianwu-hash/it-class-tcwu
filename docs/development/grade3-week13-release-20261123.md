# 三年級第13週正式發布

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
