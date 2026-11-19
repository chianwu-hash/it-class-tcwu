# 三年級第10～12週找字小幫手修復

## 正式發布收據

- 使用者授權修復上線，Claude只讀複核無阻擋。[PR348](https://github.com/chianwu-hash/it-class-tcwu/pull/348) 進main，唯一來源乾淨 `e15b3f154bd8ee5f7da9e885004740c7e3915f51`；正式 `dpl_7CTEZXmZovPyTni9B3wM7hatiDbK`，回滾 `dpl_Cxv1RroCHdLnBRqCAynBfAY5bRfh`。
- 經指定 `release-from-main.mjs start → deploy → promote`，完整樹兩次ok，6改1增0刪／非預期0／eolOnly0。受保護候選7檔及正式7檔均讀回與main bytes／SHA一致；alias確認，腳本鎖已釋放。
- 正式來源隔離Auth／RPC的三週48情境485字卡再次通過：原題／換題、逐字注音與亮鍵、混合題中英行、焦點保留；1280／390截圖目視，pageerror0、真實學生寫入0。未把此驗收冒稱真人OAuth或實體IME候選窗。
- 21項Node及原第12週保存／草稿矩陣通過，正式進度／草稿／花葉／資料庫未改。完整Claude response／run、測試、截圖與7檔HTTP／SHA收據依SOP私有封存。

## 問題與修正

使用者提供第12週「紅毛城」截圖，字卡顯示注音待確認且鍵盤不亮。第10、11、12週的getter都只傳 `{ lang:'zh', text }`，沒有 `zhuyin`；共用model依原安全契約拒絕缺少／數量錯誤的讀音，因此三週均受影響。不是鍵盤圖載入或登入失敗。

新增本學期 `textbook-keyboard-target.mjs`，以完整固定句子匹配第2、7課讀音；第10～12週getter透過它傳入注音。包含全部原題、換題與混合題中文行；英文仍走原英文模式，按游標所在行切換。未知新句子保留共用待確認提示，不用單字通用字典猜多音字，亦未放寬model驗證。

原題／答案、關卡順序、評分、登入、草稿、正式進度RPC、花葉及原生剪貼邏輯均保持；沒有SQL或正式學生資料異動。三週HTML與第11／12週builder更新runtime快取版本，避免重建後退回舊版。

## 讀音依據

固定原文沿用三週原content模組，漢字與注音逐字配對。商行讀「ㄕㄤ ㄏㄤˊ」，清楚讀「ㄑㄧㄥ ㄔㄨˇ」，參照教育部[商行](https://dict.revised.moe.edu.tw/dictView.jsp?ID=131744&la=0&powerMode=0)、[清楚](https://dict.revised.moe.edu.tw/dictView.jsp?ID=102288&q=1&word=%E6%A5%9A)。課文的「長長」取長度讀音、「快還來」取歸還讀音；輕聲「的」含˙，一聲由既有model加空白鍵。標點與換行不佔漢字音節，不改原文或標點。

## 驗證

- 21項Node測試通過：完整原題／換題中文行覆蓋、漢字數與合法符號、紅毛城具體鍵位、多音字、一聲／輕聲、標點不配音、英文保留、未知中文警示及本週原功能。
- Chrome實際三週48個原題／換題／行次情境、485個字卡逐一點選，驗對應亮鍵、無待確認、正確中文／英文行、焦點保留、換題不寫進度；1280／390無頁面橫向溢出、pageerror0、真實學生寫入0。使用隔離Auth／RPC，不能冒稱真人OAuth或實體IME候選窗已驗。
- 新增課程checklist的中文helper完整注音與實際亮鍵檢核，避免後續週頁複製同一缺漏。
- 第12週原有合成矩陣通過：匿名／本人身分拒絕、逐關保存、首關與魔王保存失敗重試、接回、草稿保存／恢復、六組換題不回寫、登出、首頁可見性與魔王努力樹入口。仍為隔離Auth／RPC，不寫真實學生資料。
- Claude只讀複核無阻擋：字數／音節、讀音與鍵位、換題、混合行與快取／builder比對；測試與瀏覽器由Codex執行，原始response及Git前後一致紀錄封存。

正式發布與補充驗收結果以交接頂部登記為準；Claude原始只讀複核、瀏覽器截圖、逐檔HTTP／SHA及發布收據依SOP封存，不公開學生資料或憑證。
