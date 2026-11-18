# 共用勾選選項字級

使用者回報三年級國語41類驗收卷第9題的勾選型態正確，選項文字過小。一般set欄位未套用單選option-body字級，內層preview-content又保留預設大小，不能只放大外層fieldset。

`quiz-fields.css`讓原checkbox label及其題文繼承與單選相同的`clamp(1.2rem,1.75vw,1.55rem)`字級與1.65行高；包含「這些選項都不選」、閱讀勾選、已答欄位、個人與夥伴。回顧的set區塊只新增`quiz-field-preview-set`樣式類別，沿用同一字級，其他欄位不套本規則。只調font-size與line-height，原國語字型、選項內容、勾選框、ID、封包與一次送出保持，無SQL／題目或作答資料變更。

在1280px為22.4px、390px為19.2px，較寬桌機最多24.8px。使用真實安全題目投影，在正式容器／國語樣式與原共用呈現函式檢查個人、閱讀、已答、整份回顧、夥伴原structured-answer輸入及回顧，桌手機12案例；原選取、唯一送出按鈕、來源不變與無橫向溢出通過。45項欄位／閱讀／勾選回歸、21項workshop產物檢查通過。測試為本機合成狀態，不冒稱正式存答。

私有證據：`D:/AI-Work/checkbox-font-evidence-20261118/`。發布後需再核正式第9題桌手機的計算字級、國語字型、原勾選狀態及保存答案不變；發布收據以agent-handoff最新紀錄為準。

## 正式發布收據

PR316合併main，由乾淨`6d1a2521bbca95754e5d4e121c6dc8191e1f66de`發布。正式`dpl_DC7ej9tL7dTmnDHqbg8SLmn6t3it`，回滾`dpl_5BL3LyGK2XY4U4F3dy3STChSTTfB`；完整樹23改0增、0非預期／eolOnly0，候選5及正式23檔HTTP精確SHA通過，鎖已釋放。正式指定帳號原第9題桌機1880px為24.8px、手機390px為19.2px，原國語楷體、勾選狀態、保存答案與自評保持；沒有提交答案。
