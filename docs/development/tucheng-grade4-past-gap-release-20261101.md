# 土城四年級考古題：補齊國語與英語

2026-11-01，依使用者授權及[考古題製作上線指南](past-exam-playbook.md)，補上澎湖文澳國小114上四年級期中國語、英語。現在五科各2份，共10份；原先8份的內容、暫停項目與計分限制均保留。

入口：[四年級考古題專區](https://it-class-tcwu.vercel.app/grade4/115-1/quiz-library.html#past-exams)。

| 新增原卷 | 版本 | 題組／欄位 | 自動／自核對／暫停配分 |
| --- | --- | --- | --- |
| 文澳114上期中國語 | 康軒 | 38／43 | 48／52／0 |
| 文澳114上期中英語 | 翰林 Here We Go 3 | 41／50 | 100／0／0 |

本輪79題組、93個作答欄位、55張必要局部圖、4段原聽力音檔。與原8卷合計294題組、487個可作答欄位。題組數、欄位數與原卷小題數不同；國語開放題以題組保存作答，不能把自動48分當成整卷100分。

## 來源、版本與逐題核對

[文澳官網](https://wops.phc.edu.tw/)的試卷分享連至[官方試卷資料夾](https://drive.google.com/drive/folders/12IBIpgJSE5ersf_WFAZgvGifRdtb92Ty)。114上期中題目卷與解答卷各取相同年級科目，兩卷及配對解答均完整2頁；英語另取得同目錄原音。出版社依[文澳114學年度官方版本表](https://wopsweb.my.canva.site/dagwyx32sjm/114)目視核對四年級國語康軒、英語翰林 Here We Go，沒有用115表反推114。原卷內容與目前教材交叉核對；英語另含原校口袋書與在地詞彙，目錄範圍已明示。

- 國語：[原卷](https://drive.google.com/file/d/1Z6rHYtYhre0bwEmMDa2cDHe4HrhwLjRf/view)、[配對解答](https://drive.google.com/file/d/1jOrCsc1k45zCxrBK3IOXnWNacqJY146f/view)。
- 英語：[原卷](https://drive.google.com/file/d/17XV-RJt09c7Vr1hA4Bplt2ungQ1x23UE/view)、[配對解答](https://drive.google.com/file/d/16zhhBLq0rPW_Lq9zH51D5m6XRWJZ4Sp8/view)、[原聽力](https://drive.google.com/file/d/12Nx1Z6k_qivTKSMe-kKwOm17ikPsHSpw/view)。

全部題文、選項、共同題幹、原配分、官方記號與裁圖均完成第二遍AI目視對照，逐欄留下校對紀錄、來源頁及SHA-256，qc為verified；這不是宣稱真人教師簽核。修正國語「氧」字、選項轉錄、多音字與完整閱讀欄界，英語情境圖保留溫度、電量、數字及提示細節。直式國語與特殊注音採必要原圖，題面與官方參考圖分流；原卷、整頁解答及字型未公開上傳。

國語短語、多音字、部首造詞、標點、接句與閱讀開放題保留自核對。官方沒有填寫的答案標為未提供或部分提供，不製造唯一標準答案。閱讀短文末尾多印文字保留原圖並加註，依正文作答；原印其他錯字也不默默改寫。英語解答PDF的隱藏文字層與可見版面不同，以實際渲染紅筆記號和同版原卷為準；解答加印的提示不加入學生題面。

英語原音長342.168秒，依A至D大題裁出4段，保留原音SHA、分段起迄與衍生檔SHA。各大題小題共用該段，可拖曳依題號聽；沒有合成語音，也沒有冒稱逐小題音檔。A段去掉前21秒開場說明，四段起迄分別為21–92、92–200.6、200.6–268.3、268.3–342.168秒。音訊轉錄僅輔助核對，官方答案仍取配對解答。

## 驗證與正式開放

1. 離線builder新增可選原音素材與audio SHA校對閘門，沿用現有schema 2與播放器。已驗音檔變更拒絕、無音檔舊qc相容、兩卷已校對bundle可重建；未覆寫既有8份來源。
2. 本機SQL兩卷各三輪0→自動滿分→再次滿分，考古花0→1→1、獨立歷史、冪等、非法缺欄整組零寫入及版本不可變通過。未登入、教師作答、錯年級、他人attempt與提前參考圖均拒絕；本人原音素材授權正常。原音與圖片使用同一私有媒體權限。
3. 私有Storage59個素材逐一回讀，SHA全部一致。新卷先disabled註冊；正式Supabase對明確40730測試身分完成6輪完整作答、歷次及考古花檢查後rollback，沒有保留測試答案。既有答案、版本、獎勵及quiz函式雜湊不變，沒有重裝legacy SQL。
4. 重新取得當時正式部署`dpl_4LsmuQBTztjPS3vvG6a8nXLQd93w`的完整781檔，16個關鍵runtime回讀相符。以這些正式位元組搭配隔離Auth／本機SQL，逐79題組完成1280／390px作答保存、圖片、手機無橫向溢出、目錄篩選及登出清除。四段原音均實際播放前進、暫停、拖曳，時長符合分段manifest；切題與登出停止／清除舊音。截圖已目視，頁面錯誤0。這是隔離合成身分驗收，沒有冒稱真人Google OAuth或正式多人壓測。
5. 本輪只新增資料及離線builder，正式前端與SQL函式均無變更；現有runtime已支援音訊，不建立沒有必要的前端部署。檔案／操作驗收通過後才enabled兩卷，再以正式RPC唯讀核對10卷、國語／數學／自然／社會／英語各2份。

私有來源：主工作區ignored `automation/output/tucheng-grade4-past-gap-20261101/`。製作與發布證據：`automation/output/tucheng-grade4-past-gap-release-20261101/`內各卷reviewed／qc／bundle／素材manifest、`builder-check.json`、`rpc-check.private.json`、`browser/report.json`、`browser/catalog-report.json`、`frontend/live-verified.json`及`cloud/`各階段紀錄。

穩定原卷ID為`wenao-114-1-g4-exam1-chinese`及`wenao-114-1-g4-exam1-english`。後續不得重跑草稿create或初始化腳本覆蓋已發布校對版本。回復先精確停用這兩卷，保留歷次、版本與考古花，不刪學生資料；本輪沒有需要回復的前端部署。
