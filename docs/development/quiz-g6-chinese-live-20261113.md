# 六年級國語第7～12課：216題及12份老師卷已上線

2026-11-13 03:30啟用題庫，03:34啟用老師卷；純固定資料更新，沿用現有正式前端，不另部署。

## 實際數量

- 216個完整單選來源，每課36題，均附學生版解析及課本印刷頁對照。
- 全科可用563題；原有第1～6課347題保留，不算入216筆新解析成果。
- 每課10題、20題各一份，共12卷180題，實際難度皆中等，同課兩卷不重複來源。
- 原始2218個來源中，其餘2002個尚待轉化，包含其他題型；不代表全部有內容疑義。本批沒有未解內容疑義。
- 本紀錄是一般題庫；期末考古卷尚未由此批完成。

## 來源與複核

- 康軒115上六年級國語，第7～12課；原題取自SHA核對光碟，課本取自同版原PDF，完整原件保留在私有資料區。
- 12批Notebook產出，使用本體瀏覽器可見thps016帳號；AGY Gemini逐題讀原圖及教材複核，Codex檢查原鍵、語義及課本證據，疑義再與Claude三輪核對。沒有以Notebook或AGY一致視為免審。
- 修正兩AI對讀信前心情與悶字部首的誤判；一般題庫最小改寫消除時點／詞義雙解，清理注音字型殘符；原題原答、勘誤與審查紀錄保留。
- 學生短解析不依賴原選項序號，教師重點保留於教師資料。部首名稱與字典補充不冒稱課本有印；只呈現課本頁圖。
- 課本印刷78–143頁，共66張WebP，含中間完整原頁；108–109是單元引導，不誤標第10課。題目直接或相關觀念頁分別標記。
- 私有Google Drive＋既有Cloudflare Worker，增加66課本圖；Worker程式及原綁定未改。沒有公開PDF或教材目錄。
- 本批尚未獨立核對書商延伸配題，knowledge_reliable=false，如實標記，不硬配。

## 驗證

- 216題前端資料驗證、全部正答、全部錯答回滾；正式資料先停用安裝，216題與66書頁逐筆讀回及固定指紋後啟用。
- 6課實際組卷並驗證課本對照；學生初始回應不洩漏解析／教師重點；同年級其他學生與三年級帳號、匿名者拒絕存取。
- 66張供圖逐張HTTP讀回核對SHA、MIME、大小，匿名／過期／竄改票據回401。此供圖測試用內部簽章票據，另以合成學生測DB授權鏈，不冒稱真人學生OAuth瀏覽器全程測試。
- 12卷180題實際作答回滾、課本學習包、合作題庫索引、六年級可見及跨年級／匿名拒絕通過。
- 原學生作答、進度、舊版本及別名受交易保護；無資料庫函式、RLS或既有作答修改。

## 老師卷入口

- [六上國語第7課 大小剛好的鞋子（中等・10題）](https://it-class-tcwu.vercel.app/grade6/115-1/quiz.html?cloud=1&session=f53923d4-227c-4739-ab4f-033615942001)
- [六上國語第7課 大小剛好的鞋子（中等・20題）](https://it-class-tcwu.vercel.app/grade6/115-1/quiz.html?cloud=1&session=cd4785e5-7097-4ada-9910-563712f1f88b)
- [六上國語第8課 狐假虎威（中等・10題）](https://it-class-tcwu.vercel.app/grade6/115-1/quiz.html?cloud=1&session=f3aa8347-f0d2-4d00-b074-54f702243625)
- [六上國語第8課 狐假虎威（中等・20題）](https://it-class-tcwu.vercel.app/grade6/115-1/quiz.html?cloud=1&session=008aeb6b-5a83-4d71-84d0-28dd76111681)
- [六上國語第9課 空城計（中等・10題）](https://it-class-tcwu.vercel.app/grade6/115-1/quiz.html?cloud=1&session=837131ba-9411-4880-8ca7-d5a3145e3828)
- [六上國語第9課 空城計（中等・20題）](https://it-class-tcwu.vercel.app/grade6/115-1/quiz.html?cloud=1&session=fb54bb0e-bd6b-4f81-8ba5-930d748ec430)
- [六上國語第10課 耶誕節（中等・10題）](https://it-class-tcwu.vercel.app/grade6/115-1/quiz.html?cloud=1&session=7e1d44ae-cb10-420f-ab73-54f11308157e)
- [六上國語第10課 耶誕節（中等・20題）](https://it-class-tcwu.vercel.app/grade6/115-1/quiz.html?cloud=1&session=44230ce3-7bbb-4632-a58d-a306b19cd35b)
- [六上國語第11課 下午茶風波（中等・10題）](https://it-class-tcwu.vercel.app/grade6/115-1/quiz.html?cloud=1&session=eb2accfc-1aa0-4b3c-99c2-5f7ad89107eb)
- [六上國語第11課 下午茶風波（中等・20題）](https://it-class-tcwu.vercel.app/grade6/115-1/quiz.html?cloud=1&session=14533355-c2e6-424e-a4ef-9f03bd41dce8)
- [六上國語第12課 橘子（中等・10題）](https://it-class-tcwu.vercel.app/grade6/115-1/quiz.html?cloud=1&session=a580521e-e43c-418a-9b94-6adaa386a833)
- [六上國語第12課 橘子（中等・20題）](https://it-class-tcwu.vercel.app/grade6/115-1/quiz.html?cloud=1&session=15e26323-753b-4ab6-b4a2-4807538db5de)

## 固定證據

- 啟用SQL SHA-256：`1964eb961209086c7494e8da9c757b1dd17c7d6a1452a5c5d3b38b0be3146a35`。
- 固定候選清冊 SHA-256：`1b050c2efa97d82464590af149f85801d96ae78c59ad165f91c8ae60d06031cc`。
- 私有原題、教材及逐題紀錄置F槽工作目錄，未提交公開repo。
- 自然536＋英語108＋國語216，共860個新解析來源；三科共20卷300題。數學與社會、剩餘題型及考古卷繼續處理，未宣稱六年級全科全部完成。
