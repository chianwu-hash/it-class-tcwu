# 中英打基礎學習地圖花葉圖示 — 2026-11-02

已完成並正式上線，部署 `dpl_2Y3coNLmvKTHsDu7vbU3JX2HoxNB`，前一正式版 `dpl_8XuMsA2hHnNZ1neaFqtW8DbKPfF4`。

每個大關顯示同色系過關葉；英打第4、9、12大關及中打第5、8、12大關，另顯示里程碑花。沿用正式里程碑定義及英打藍／中打紫配色，圖示搭配文字，已取得另有勾選／底色；鎖定關卡仍能清楚看到將來獎勵。

圖例、按鍵無障礙名稱及花朵說明明確指出：花需完成第1關至該里程碑所有大關；不是只完成該端點就開花。圖示讀取目前完成狀態，重設先修後會恢復尚未取得。獎勵規則、登入、進度與關卡鎖定判定均未改；新增顯示元件沒有網路寫入或localStorage。

## 驗證與發布

- 本機與正式三／六年級、中／英打四個入口：每張地圖12葉圖示、3花圖示，位置全部正確；390px手機版無水平溢出或徽章超出按鈕。
- 六種合成顯示狀態通過：英中各驗只有里程碑端點完成但缺先修時未得花、全部先修完成才顯示已取得、重設第一關後收回已取得標記。這些案例只呼叫顯示函式，不改正式成果。
- 本機與正式pageerror皆0；桌面截圖已目視核對。沒有重新執行OAuth或寫入正式學生成果。
- 以當下正式807來源為底，修改8檔、新增共用顯示元件／CSS2檔；其餘799來源原樣保留。809雲端來源SHA1一致；正式公開788檔內容一致、16個原排除PDF維持404。待發布版本驗證後promote，沒有SQL、commit或push。
- 既有新版英打鍵盤、里程碑規則、努力樹配色及其他更新保留。

## 檔案與接續

新增 `shared/typing-foundation-map-rewards.mjs`、`shared/typing-foundation-map-rewards.css`；中英app只在原有學習地圖按鈕上加顯示裝飾與圖例，入口更新快取版本。

實作沿用隔離工作區 `D:/projects/.codex-worktrees/foundation-keyboard-fix-20261102`，已切分支 `codex/foundation-map-rewards-20261102`；主工作區其他修改保留。ignored `tmp/foundation-map-rewards-release-20261102/` 保存完整baseline／manifest／publish、雲端比對、local/live瀏覽器結果與截圖；控制腳本 `tmp/map-rewards-release.mjs`。後續必須整合當下正式來源，不要從舊Git或髒工作區整包覆蓋。回復前先核對project與aliases是否有其他更新。
