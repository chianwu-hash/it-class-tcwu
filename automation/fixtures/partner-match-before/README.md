# 候配遷移前的固定測試基準

來源：main e001cc177f1d54792d47ed7f7c743e5bb1e2e764 的 public／partner_pilot 結構與函式定義；不含學生資料列、題目內容或權杖。SHA256：

- functions.sql：`7eed5efdd7fe24e348f8ec21537c0fd04782234ef0e780ca6033d5f8060e145a`
- schema.json：`803dab427116fd004fc3bc891c952dd983ec68fdf44ac39791af736ff3ab68ae`

遷移測試與一次性遷移產生器必須讀此基準，不讀持續更新的 production-snapshot；否則正式套用後更新快照，測試便會拿新版重播一次性遷移而誤報失敗。不可覆寫此基準以讓測試通過。合成測試的auth及realtime邊界仍在production-quiz-db.mjs建立，並明確覆寫合成教師。
