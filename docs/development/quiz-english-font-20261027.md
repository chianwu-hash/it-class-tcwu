# 英語課本字型查核與選用

日期：2026-10-27。使用者要求查明英語課本字型，選相同或相近的字型；延續剛完成的國語題文標楷體設定。

## 教材與實際查核

依 `textbooks/115-1/README.md` 與學校115版本表：三上英語為翰林《Here We Go 1》，六上為康軒《Wonder World 7》。直接檢查已保存的課本PDF文字span、內嵌字型名稱與頁面影像，不用題庫Word字型代替課本字型。

| 樣本 | PDF內字型名稱與用途 |
| --- | --- |
| 三上 `02_HWG1_U1.pdf`，14頁 | 對話與正文有 `hanlinround`、`hanlin-roman`；標題另有 `hanlin-bold-`、`hanlin-bold-round`，字母練習另有其他字型 |
| 六上 `01_國小英語WW7課本_U1_(學).pdf`，14頁 | 英文內文主要出現 `New-MFHeiW7-1-@`，標題另有 `New-MFHeiW9-1-@`；角色姓名等有 `New-ComicSansMS-1-@` 等 |

以上是**樣本PDF內嵌字型名稱**，不能當成已確認可購買／下載的網頁字型家族，也不代表整本所有元素共用單一字型。六上的 `New-...` 名稱尤其可能是PDF處理後名稱，不能單憑名稱說明原始商用字型身分。未確認這些課本字型的公開網頁使用授權。

已視覺檢查三上Unit1 PDF第2頁的對話，以及六上Unit1第1頁、放大的 `I can’t wait to go whale watching.`。比較字形重點為單層小寫a／g、無襯線主體及易辨認的I／l／1。正文、標題、練寫字型需要分開看，不直接套用裝飾標題字型當全文。

## 選擇：Andika 7.000

採用**相近替代字型Andika**，不是宣稱它就是課本原字型。SIL官方說明此字型專為初學閱讀設計，具有單層a／g、可區別的I／l／1與清晰字形；這些特徵符合本次與教材樣本的比對重點。相近程度是視覺選型判斷，沒有主張與課本字形完全相同。

- 官方設計：https://software.sil.org/andika/design/
- 官方下載：https://software.sil.org/andika/download/
- 下載套件：https://software.sil.org/downloads/r/andika/Andika-7.000.zip
- 授權：SIL Open Font License 1.1。保留原版 `OFL.txt`，沒有修改字型或從出版社PDF抽取字型檔。

本機收錄 `shared/fonts/andika/Andika-Regular.woff2`（295,740 bytes）及 `Andika-Bold.woff2`（299,540 bytes），與官方套件位元組相同；詳細SHA在ignored稽核檔。由網站供應字型，不依賴學生電腦另行安裝。

## 套用範圍

沿用已授權選卷資料 `catalog.subject`，英語題目、共用材料、選項、解析與簡答輸入優先用Andika，中文由原本的Noto Sans TC／微軟正黑體備援。原字級與字重邏輯保留，行高1.8。導覽、按鈕、鼓勵語、選項標號及其他科目不改；國語仍是標楷體。

本機 `automation/quiz-cloud-server.mjs` 僅新增這兩個字型檔的明確允許路徑。未改登入、判分、題庫文件、Google Drive圖片、Supabase作答或正式網站部署。

## 驗收

ignored證據在 `automation/output/quiz/english-font-research/`：`pdf-font-audit.json`、課本樣本頁PNG、`font-files.json`、`browser-font-qa.json`、`english-andika-local.png`。

- Chrome實際使用Andika-Bold／custom webfont渲染英文，並非只確認CSS字串。
- `a g I l 1 What’s your name? whale watching`字形探針42字形均由Andika渲染。
- 中文可回退原中文字型；國語DFKai-SB仍保留；導覽不使用Andika；390px無水平溢出。
- 已開本機英語原場次供使用者查看，沒有送答或改既有進度。
- 完成CSS差異檢查、server語法檢查與畫面視覺核對。正式網站尚未發布。
