# 正確答案與課本同排發布收據

2026-11-12，依使用者對已上線介面的後續要求，把答後課本按鈕移到正確答案列、AI解析之前。桌機同排、窄螢幕可換行；原底部不再重複顯示提示。原課本頁碼、呼吸／減少動態及燈箱操作保留。

PR183合併後從乾淨最新main `48007bb938b16f92ecbc0ba2b2d5893c4dc44dc0` 依發布腳本部署、完整樹比對及promote。正式 `dpl_BrTBJPdhMUbcWzpU3h58UN5BLbJL`，回滾 `dpl_7rhfpW59LxVUcTXHeBkpauibfNAP`，鎖已釋放。

9項study SQL／前端／建置、21生成產物及32項桌機1280／手機390合成身分檢查通過，包含答案與按鈕同排、單一入口在解析之前、課本開啟及考古解析回歸；無頁面錯誤或橫向溢出。不是正式學生OAuth或送答驗收。

完整樹24修改、0新增／刪除、額外差異0，正式29來源SHA讀回一致。未更動解析文字、答案、判分、保存、資料庫、教材權限或考古卷enabled。

[變更與來源](quiz-answer-textbook-row-20261112.md)／[機器可讀收據](quiz-answer-textbook-row-release-20261112.json)。私有證據在`C:/Users/user/ai-now/answer-textbook-row-20261112/`。
