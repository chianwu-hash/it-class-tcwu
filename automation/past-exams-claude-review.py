"""彙整唯讀Claude複核成獨立本機教師頁；不修改原頁、題庫或教師匯出。"""
import hashlib
import json
from pathlib import Path
import re
import subprocess
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / 'automation/output/past-exams-review-20261030'
PACKET = ROOT / '.chat-mode/pending-review-20261030'
SESSION = '20261030-pending-answers-01'
HEAD = '2084533f9dafde3480d36e6027999f95bc1425eb'
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))


def main():
    assert subprocess.check_output(['git', '-C', str(PACKET), 'rev-parse', 'HEAD'], text=True).strip() == HEAD
    assert not subprocess.check_output(['git', '-C', str(PACKET), 'status', '--porcelain'], text=True).strip()
    manifest = read(PACKET / 'source-manifest.json')
    for path, digest in manifest.items():
        assert hashlib.sha256((PACKET / path).read_bytes()).hexdigest() == digest, path
    reviews, runs = {}, []
    for turn, count, suite in [(1, 13, 'P'), (2, 12, 'C1'), (3, 10, 'C2'), (4, 3, 'A')]:
        prefix = PACKET / '.chat-mode/sessions' / SESSION / f'turn-{turn:04}'
        run = read(Path(str(prefix) + '.run.json'))
        response = Path(str(prefix) + '.response.md').read_text(encoding='utf-8-sig')
        assert run['status'] == 'completed' and run['exitCode'] == 0 and run['conversationViewerStarted']
        assert f'CHAT_MOD_PENDING_{suite}_20261030_DONE' in response
        items = json.loads(re.search(r'```json\s*(.*?)```', response, re.S)[1])
        assert len(items) == count
        for item in items:
            assert item['id'] not in reviews
            for path in item['viewedEvidence']:
                assert (PACKET / path).is_file(), path
            reviews[item['id']] = item
        runs.append({k: run[k] for k in ['turnId', 'status', 'completedAt', 'totalElapsedSeconds', 'readToolUseCount', 'conversationViewerStarted']})
    proposals = read(ROOT / 'automation/past-exams-claude-review-20261030.json')
    data = read(BASE / 'review-data-audio-update.private.json')
    # P04已上線，確認其他題組逐字不變後，將同卷C06轉接到目前SHA。
    receipt = read(BASE / 'applied-decisions/P04-20261030.private.json')
    prior = read(ROOT / 'automation/output/past-exams-teacher-p04-20261030/before-bundle.private.json')
    current = read(ROOT / 'automation/output/past-exams-teacher-p04-20261030/bundle.private.json')
    unchanged = lambda b: [g for g in b['document']['groups'] if g['id'] != receipt['questionId']]
    assert unchanged(prior) == unchanged(current)
    assert current['sha256'] == receipt['applied']['sha256']
    for card in data['cards']:
        if card['paperId'] == receipt['applied']['paperId']:
            assert card['bundleSha256'] == receipt['previousSha256']
            card['previousBundleSha256'] = card['bundleSha256']
            card['bundleSha256'] = current['sha256']
    for paper in data['papers']:
        if paper.get('sha256') == receipt['previousSha256']:
            paper['previousSha256'] = paper['sha256']
            paper['sha256'] = current['sha256']
    original = {c['id']: c for c in data['cards']}
    cards = []
    for category, items in proposals.items():
        for id_, recommendation in items.items():
            card = original[id_]
            card['originalCategory'] = card['category']
            card['category'] = category
            card['proposal'] = recommendation
            card['claudeReview'] = reviews[id_]
            card['ask'] = '是否同意上方建議？不同意或需調整時，請在下方註記範圍。'
            card['citations'] = {
                'P01': [('教育部：亂', 'https://dict.revised.moe.edu.tw/dictView.jsp?ID=3850&q=1&word=%E4%BA%82')],
                'P02': [('教育部：露出', 'https://dict.revised.moe.edu.tw/dictView.jsp?ID=60835&q=1&word=%E9%9C%B2')],
                'P11': [('國家教育研究院：浮力', 'https://stv.naer.edu.tw/watch/299846')],
                'P14': [('中央氣象署：季風', 'https://edu.cwa.gov.tw/PopularScience/wt/wt_3.html'), ('中央氣象署：鋒面', 'https://pweb.cwa.gov.tw/PopularScience/kids/wt/wt_16.html')]
            }.get(id_, [])
            cards.append(card)
    assert len(cards) == 37 and len({c['id'] for c in cards}) == 37
    assert 'P04' not in {c['id'] for c in cards} and 'A02' not in {c['id'] for c in cards}
    data.update(cards=cards, createdAt=datetime.now(timezone.utc).isoformat(), blockedFields=40,
                nonAudioBlockedFields=13, audioFields=27,
                scope='113、114上學期期中・三、六年級。40個暫停欄位：13個非聽力＋27個聽力；本頁37張卡含額外覆核事項，並非37道停用題。P04已依你確認上線；A02與C07合併。',
                review={'session': SESSION, 'packetHead': HEAD, 'sourceFiles': len(manifest), 'runs': runs,
                        'note': '整合四輪與Codex再核對的提案，尚未取得教師確認，未修改正式題庫。Claude主要查看頁面影像，未宣稱逐份開啟PDF。C06已核對P04以外題組逐字不變並轉接最新SHA，舊來源SHA另存；後續套用不得覆蓋已核准P04。'})
    serial = json.dumps(data, ensure_ascii=False, indent=2)
    data['draftId'] = hashlib.sha256(serial.encode()).hexdigest()
    (BASE / 'review-data-claude.private.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    html = (ROOT / 'automation/past-exams-review-template.html').read_text(encoding='utf-8')
    html = html.replace('考古題有疑義的題目，一起確認', 'Claude複核後，請你確認這些建議')
    html = html.replace('原題與官方解答分開呈現；原頁可放大、旋轉，或開啟PDF核對。確認後再由我依你的指示修正。',
                        '先看11項明確答案建議，再看6項處理方式。原題、官方原記號與AI建議分開保留；你按同意或填寫後才算確認。頁面不會發布或修改正式題庫。')
    html = html.replace('<b>14</b>非聽力暫停欄位', '<b>11</b>明確答案建議').replace('<b>84</b>缺原音聽力欄位', '<b>6</b>處理方式待確認').replace('<b>20</b>已開放期中卷', '<b>26</b>三英缺稿欄位')
    html = html.replace('這是來源與發布版本的審閱快照。官方留白／不完整參考的開放題另列，沒有全部停用。頁面不修改正式資料；輸入只留在目前頁面，離開前請匯出保存。',
                        '四輪唯讀複核完成；已開放的12組人工參考題不重複要求確認。瀏覽器草稿不能直接由我讀取，填完請匯出紀錄交給我。舊審閱頁與已匯出檔均保留。<p id="draftStatus" role="status"></p>')
    html = html.replace("categories=['暫停・待確認','其他待覆核','缺少原音','參考答案','校對歷程'];let selected='暫停・待確認'", "categories=['明確答案建議','需確認處理方式','建議維持現況','缺稿先暫停'];let selected='明確答案建議'")
    html = html.replace("selected='暫停・待確認';drawTabs()", "selected='明確答案建議';drawTabs()")
    html = html.replace('（含校對歷程）', '（含額外覆核事項）')
    html = html.replace('${esc(c.title)}</h2>', '${esc(c.title)}</h2><section class="question answer"><h3>Codex與Claude整合建議｜待你確認</h3><p class="text">${esc(c.proposal)}</p>${c.citations.map(([label,url])=>a(url,label)).join(" · ")}<details><summary>本次Claude實際查閱範圍</summary><p class="small">以下是影像／資料查閱紀錄，不代表PDF全文或未提供的教材也已驗證。四輪後的修正以上方整合建議為準。</p><ul>${c.claudeReview.viewedEvidence.map(p=>`<li>${a(p,p)}</li>`).join("")}</ul></details></section>')
    html = html.replace('<label for="status-${c.id}">你的確認結果</label>', '<button class="primary accept" data-accept="${esc(c.id)}">同意此建議</button><p class="small">按下會將上方完整建議填入你的確認紀錄；仍須匯出交回。</p><label for="status-${c.id}">你的確認結果</label>')
    html = html.replace("dirty=true;filter();", "dirty=true;saveDraft();filter();")
    html = html.replace("dirty=false;filter();alert(`已讀回", "dirty=false;saveDraft();filter();alert(`已讀回")
    extra = (ROOT / 'automation/past-exams-review-draft.js').read_text(encoding='utf-8')
    html = html.replace("window.addEventListener('beforeunload'", extra + "\nwindow.addEventListener('beforeunload'")
    html = html.replace('__REVIEW_DATA__', json.dumps(data, ensure_ascii=False).replace('<', '\\u003c'))
    (BASE / '考古題疑義審閱-Claude複核建議版.html').write_text(html, encoding='utf-8')
    lines = ['# 考古題Claude複核建議總表', '', data['scope'], '', '**全部為待教師確認的提案，未變更正式題庫。** 原題／官方解答／來源頁與SHA見同目錄HTML；本表不是教師確認紀錄。', '']
    for category, items in proposals.items():
        lines += ['## ' + category, '']
        for id_, proposal in items.items():
            lines += [f'- **{id_}｜{original[id_]["paper"]}**：{proposal}']
        lines += ['']
    lines += ['## 查閱限制', '', data['review']['note'], 'A01／A03合計26欄；C16／C17／C18是A03子集，不可重複計數。C07是第27個聽力暫停欄。缺稿指所提供來源沒有完整稿，不宣稱所有外部來源皆無。未採用Claude無原卷依據的拆分配分及數位畫線容差提案。', '', f'唯讀來源包HEAD：{HEAD}；151個來源SHA核對通過；四輪run、完成標記、可見對話檢視窗、Git未改均核對通過。']
    (BASE / 'Claude複核建議總表.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(json.dumps({'cards': len(cards), 'categories': {k: len(v) for k, v in proposals.items()}, 'sourceFiles': len(manifest), 'claudeSeconds': sum(r['totalElapsedSeconds'] for r in runs)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
