# 三六年級固定風格與三年級第11週資訊圖卡

2026-11-11 使用者要求六年級固定風格一併進SOP、三六年級每週維持各自原風格，三年級也像六年級每週做資訊圖卡。使用者選定第11週本次就補做，之後每週皆做。Codex唯一寫入者，來源最新 `origin/main ec43afb` 的新工作樹；沿用自驗後發布、免Claude複核指示。

## 固定契約

新增 `grade6-visual-style.md` 與 `weekly-infographic-sop.md`，同步兩年級風格文件、dev-sop、lesson-to-web-sop、new-page-checklist、prompt-template及圖像SOP。三年級保持藍綠／天藍低年級卡通，六年級保持第09／10週紫／靛／藍綠漸層、4px彩框、圓形編號及高年級水彩。兩年級共用製作流程，不互相套風格。新正式上課週頁至少一張圖卡，不能因教案未提而省略；除第11週外不自動擴大回補歷史缺圖週。

## 第11週圖卡

- 文案為四格核心技能：方向鍵移動、Backspace刪左、Delete刪右、Ctrl＋Z復原後繼續；底部F／J定位。圖卡不替代原文字／五題／六關，不新增獎勵或課堂必完要求。
- 提示詞 `automation/prompts/grade3-week11-infographic.txt`，實際上傳三年級第01週滑鼠卡作風格參考。目視核對繁體字、按鍵、箭頭與刪左／右示意正確，人物無明顯異常，保持三年級原風格。
- 生成前核對ChatGPT可見帳號codex THPS。原CLI的舊BrowserStore不識別機器共用租約，因此用其公開生圖函式搭配 `D:/ai-browser/run-background.cjs` 的唯一租約／註冊worker／精確target執行；不另建舊租約、不換分身。前幾次未送出；成功這次僅送一份prompt，1張參考上傳、1張新圖與下載成功，metadata保存在ignored證據。
- 原圖PNG僅保留私人證據；正式 `grade3/115-1/images/week11/week11-infographic-1920x1080-q80.webp`，1920×1080、q80、144,814 bytes。Cloudinary新public ID，不覆蓋舊週；[正式圖片](https://res.cloudinary.com/dmqmjfqng/image/upload/v1794363978/it-class-tcwu/grade3/week11/115-1-week11-infographic-1920x1080-q80.webp)，回讀SHA-256 `1fe83d938359fed8300ed70963391d27a3246c3e8d4c2803938a3c7c37e34cb4` 與本機完全相同。
- 第11週新增獨立 `week11-infographic.mjs`／`.css`，沿用 `initImageLightbox()`。模組獨立於Auth／進度載入，Cloudinary img與同頁燈箱用同網址、alt／尺寸完整；圖卡區也保留彩色圓形小圖示。建置來源、HTML與教案同步。
- 無navbar／Auth／正式六關JS／題目／進度／葉花／SQL改動，無新增活動鍵；六年級正式頁本批不改，只把原風格納入固定SOP。

## 驗證與發布

9項暖身邏輯與練功坊21檔建置核對通過。新圖卡瀏覽器測試使用合成匿名Auth，桌手機圖片與燈箱、縮放／百分比、滾輪、原生mouse拖曳／雙擊、CDP雙指、置中／重設、Esc／關閉／焦點及捲動恢復、重開100%、Auth模組失敗仍可開燈箱均通過；正式六關未登入維持鎖定。原六關回歸也通過：逐關儲存、失敗重試、續作、六關替代重練不寫入、混合語言提示、登出、首頁週卡與努力樹往返。兩套瀏覽器驗證皆真實學生寫入0、pageerror0；1280／390圖卡截圖已確認下載解碼完成並目視。實體手機硬體與Microsoft注音候選窗不冒稱已驗。正式結果與發布收據另補。

發布只從PR合併後的新乾淨main，使用正式發布腳本、完整樹比對、正式讀回；無SQL。收據進main後封存證據與清理本批工作樹。原圖對話供教師核對可保留，測試頁用畢清理。
