from pathlib import Path
P=Path('.chat-mode/adapted-listening-20261101');s='adapted-listening-claude-20261101';old=P/f'.chat-mode/exchange/{s}/turn-0001.request.md';header=old.read_text(encoding='utf-8').split('---',2)[1].replace("turn_id: '0001'","turn_id: '0002'").replace('CHAT_MOD_ADAPTED_LISTENING_CLAUDE_DONE','CHAT_MOD_ADAPTED_NUMBERS_DONE')
body='''26段已用JennyNeural、-12%生成並無提示Whisper small回辨。A/C20段均逐字一致；E裸數字nine/eight/seven/ten/three回辨為數字或拼字，但Six.回辨為sex，不可直接把sex正規化成six冒稱通過。Codex建議E6段統一改成「The number is nine.」等自然短句，維持相同數字、兩次、圖意與答案不變，不加不存在的年齡或物品情境；重製再回辨與播放器驗。你是否同意此小修？總300字內，若有更佳最小方案請明確指出。你沒有聽到音檔，不能宣稱音訊已通過。
另E拼字沿現有逐字清單收小寫/首大寫/全大寫，學生欄位明示請用小寫；不新增全站casefold SQL。這是有限明確容錯，不宣稱任意混合大小寫皆支援。原圖已依embedded image+smask+原仿射矩陣白底擷取，去除頁面疊印數字/框線，原1/2左/右圖標籤由choice-bank提供。回覆只討論上述供給文字，不重讀原頁、不執行命令、不上網、不改檔。最後一行 CHAT_MOD_ADAPTED_NUMBERS_DONE。'''
out=old.with_name('turn-0002.request.md');assert not out.exists();out.write_text('---'+header+'---\n'+body,encoding='utf-8')
