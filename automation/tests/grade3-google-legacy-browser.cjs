// Synthetic Google identity only. No production student records are read or written.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { connectCdp } = require(process.env.CDP_SAFE_CLIENT_PATH || 'D:/projects/cdp-tools/packages/cdp-safe-client');
const lease = process.env.LEGACY_LEASE, cdpUrl = process.env.LEGACY_CDP;
const base = process.env.LEGACY_BASE || 'http://127.0.0.1:3038';
if (!lease || !cdpUrl) throw new Error('Acquire an AI Work Browser lease first.');
function heartbeat() {
    execFileSync('pwsh', ['-NoProfile', '-Command', `ai-browser-launch -Heartbeat -LeaseId '${lease}' -WorkerProcessId ${process.pid} -Json`], { stdio: 'pipe' });
}
// Reuse the existing auth fixture, but model each legacy activity's real total.
const source = fs.readFileSync('automation/tests/grade3-week06-browser.cjs', 'utf8');
let fixture = source.match(/const fixture=`([\s\S]*?)`;\r?\n/)[1];
assert.ok(fixture.includes('row.completed=row.score===5;row.current_level=Math.min(row.score+1,5);'));
fixture = fixture.replace('row.completed=row.score===5;row.current_level=Math.min(row.score+1,5);',
    `const total=args.p_activity_key==='typing_task_4'?4:args.p_activity_key.startsWith('quiz_')||args.p_week_code==='02'?5:6;
    row.completed=row.score===total;row.current_level=Math.min(row.score+1,total);
    sessionStorage.setItem('synthetic-test-rows',JSON.stringify(window.fixtureRows));`);
const cases = [
    { name: 'week02', week: '02', key: 'typing_task_4', total: 4 },
    { name: 'week03', week: '03', key: 'typing_task_6', total: 6, answers: ['mia', 'hat', 'fish', 'name', 'fine', 'goat'] },
    { name: 'week04', week: '04', key: 'typing_task_6', total: 6, answers: ['Leo', '6', 'Abu', 'MIA', 'Mia, Abu', 'My name is Mia.'] },
    { name: 'week05', week: '05', key: 'typing_task_5', total: 6, answers: ['l1o0', 'Hi', 'A0o1', 'synthetic', 'A123456780', 'apple1234'] },
    { name: 'week02-mail', week: '02', key: 'typing_task_5', total: 5 }
];
const prerequisites = ['typing_task_4', 'quiz_posture_5', 'window_practice_5'].map(key => ({
    course_id: 'grade3-115-1', week_code: '02', activity_key: key, score: key === 'typing_task_4' ? 4 : 5,
    current_level: key === 'typing_task_4' ? 4 : 5, completed: true
}));
(async () => {
    heartbeat();
    const connection = await connectCdp({ cdpUrl, targetUrl: base + '/grade3/115-1/week03.html' });
    const timer = setInterval(heartbeat, 45000);
    const errors = [];
    async function open(test, state = {}) {
        const context = await connection.browser.createBrowserContext();
        const page = await context.newPage();
        page.on('pageerror', e => { errors.push(`${test.name}: ${e.message}`); console.error('PAGE ERROR', test.name, e.message); });
        await page.setRequestInterception(true);
        page.on('request', req => req.url().includes('/shared/auth.js')
            ? req.respond({ contentType: 'application/javascript', body: fixture })
            : req.url().includes('/fake/rest/v1/rpc/typing_foundation_action')
                ? req.respond({ contentType: 'application/json', body: '[]' }) : req.continue());
        await page.evaluateOnNewDocument((initial, rows) => {
            Object.assign(window, initial);
            if (!sessionStorage.getItem('synthetic-test-rows')) sessionStorage.setItem('synthetic-test-rows', JSON.stringify(rows));
        }, state.flags || {}, [...(test.name === 'week02-mail' ? prerequisites : []), ...(state.rows || [])]);
        await page.goto(base + '/grade3/115-1/' + test.name + '.html', { waitUntil: 'networkidle2' });
        return { context, page };
    }
    const button = n => `#block-level${n} button[onclick="checkLevel(${n})"]`;
    async function enter(page, test, n, wrong = false) {
        assert.equal(await page.$eval('#typing-levels-container', e => e.inert), false, `${test.name}: container locked`);
        assert.equal(await page.$eval(`#input-level${n}`, e => e.disabled), false, `${test.name}: input disabled`);
        assert.equal(await page.$eval(button(n), e => e.disabled), false, `${test.name}: check disabled`);
        if (test.name === 'week02-mail') {
            const boxes = await page.$$(`#block-level${n} .mailbox`);
            for (const box of boxes) {
                const input = await box.$('.mail-answer');
                const answer = await box.$eval('.code', e => e.textContent.trim());
                await input.click(); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
                await input.type(wrong ? '0' : answer);
            }
            if (n === 4) for (const index of [0, 1, 2]) await page.click(`[data-deliver="${index}"]`);
        } else {
            const answer = test.answers?.[n - 1] || await page.$eval(`#block-level${n} .code`, e => e.textContent.trim());
            const input = await page.$(`#input-level${n}`);
            await input.click(); await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
            await input.type(wrong ? '0' : answer);
        }
        await page.click(button(n));
        if (!wrong) await page.waitForFunction(n => document.getElementById('input-level' + n).readOnly && window.fixtureRows.some(r => r.score >= n), {}, n);
    }
    async function next(page, test, n) {
        if (n < test.total) {
            await page.waitForFunction(n => !document.getElementById('block-level' + (n + 1)).classList.contains('hidden'), {}, n);
            if (test.name.startsWith('week02')) {
                await page.waitForFunction(n => !document.getElementById('next-' + n).classList.contains('hidden'), {}, n);
                await page.$eval(`#next-${n}`, e => e.focus());
                await page.keyboard.press('Enter');
                await page.waitForFunction(n => document.getElementById('block-level' + (n + 1)).classList.contains('current'), {}, n);
            }
        }
    }
    try {
        // Fresh account, actual controls, wrong answer, save error, reload/resume, all levels, effort tree.
        for (const test of cases) {
            const { context, page } = await open(test);
            try {
                await page.waitForFunction(() => typeof window.checkLevel === 'function');
                await enter(page, test, 1, true);
                assert.equal(await page.evaluate(() => fixtureSaves.length), 0);
                await page.evaluate(() => window.fixtureSaveFail = true);
                // A failed write must keep the same level editable; do not wait for completion here.
                const answer = test.answers?.[0] || await page.$eval('#block-level1 .code', e => e.textContent.trim());
                if (test.name === 'week02-mail') {
                    await page.$$eval('#block-level1 .mailbox', boxes => boxes.forEach(box => {
                        const input = box.querySelector('input'); input.value = box.querySelector('.code').textContent;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }));
                } else await page.$eval('#input-level1', (e, value) => { e.value = value; }, answer);
                await page.click(button(1));
                await page.waitForFunction(() => document.querySelector('#msg-level1').textContent.includes('⚠️'));
                assert.equal(await page.$eval('#input-level1', e => e.readOnly), false);
                assert.equal(await page.$eval('#block-level2', e => e.classList.contains('hidden')), true);
                await page.evaluate(() => window.fixtureSaveFail = false);
                await enter(page, test, 1);
                assert.equal(await page.evaluate(() => fixtureSaves[0].p_week_code), test.week);
                assert.equal(await page.evaluate(() => fixtureSaves[0].p_activity_key), test.key);
                await page.reload({ waitUntil: 'networkidle2' });
                assert.equal(await page.$eval('#input-level1', e => e.readOnly), true);
                for (let n = 2; n <= test.total; n++) { await enter(page, test, n); await next(page, test, n); }
                const saved = await page.evaluate((week, key) => fixtureRows.find(r => r.week_code === week && r.activity_key === key), test.week, test.key);
                assert.equal(saved.score, test.total); assert.equal(saved.completed, true);
                assert.deepEqual(await page.evaluate(() => fixtureSaves.map(r => r.p_score)), Array.from({ length: test.total - 1 }, (_, i) => i + 2));
                assert.equal(await page.evaluate(() => fixtureCalls.some(name => /guest_progress|class_card/.test(name))), false);
                await page.goto(base + '/my-tree.html?course=grade3-115-1', { waitUntil: 'networkidle2' });
                const leaves = test.name === 'week02-mail' ? 9 : test.total - 1;
                const flowers = test.name === 'week02-mail' ? 2 : 1;
                assert.equal(await page.$eval('#leaf-count', e => Number(e.textContent)), leaves);
                assert.equal(await page.$eval('#flower-count', e => Number(e.textContent)), flowers);
                await page.goto(base + '/grade3/115-1/' + test.name + '.html', { waitUntil: 'networkidle2' });
                assert.equal(await page.$eval(`#input-level${test.total}`, e => e.readOnly), true);
                console.log(`PASS ${test.name}: fresh, wrong/write failure, resume, ${test.total} levels, tree, completed reload`);
            } finally { await context.close(); }
        }
        for (const test of cases) {
            for (const flags of [{ fixtureUser: null }, { fixtureImportFail: true }, { fixtureLoadFail: true }]) {
                const { context, page } = await open(test, { flags });
                try {
                    const locked = await page.evaluate(() => {
                        const container = document.querySelector('#typing-levels-container');
                        const input = document.querySelector('#input-level1');
                        return !input || container.inert || input.disabled || !!container.closest('.hidden');
                    });
                    assert.equal(locked, true, `${test.name}: rejected identity/read must lock`);
                    if (test.name === 'week02-mail' && flags.fixtureLoadFail) {
                        assert.match(await page.$eval('#mail-lock', e => e.textContent), /進度讀取失敗/);
                        assert.equal(await page.$eval('#mail-retry', e => e.disabled), false);
                        await page.evaluate(() => window.fixtureLoadFail = false);
                        await page.click('#mail-retry');
                        await page.waitForFunction(() => document.querySelector('#input-level1')?.disabled === false);
                    }
                    if (await page.evaluate(() => typeof window.checkLevel === 'function')) await page.evaluate(() => checkLevel(1));
                    assert.equal(await page.evaluate(() => fixtureSaves.length), 0);
                } finally { await context.close(); }
            }
            console.log(`PASS ${test.name}: anonymous, import failure, read failure`);
        }
        // Other saved challenges in these weeks: posture quiz, window operations, device safety quiz.
        for (const name of ['week02', 'week03']) {
            const { context, page } = await open({ name });
            try {
                if (name === 'week02') {
                    const correct = [1, 0, 2, 1, 2];
                    for (let i = 0; i < correct.length; i++) {
                        const options = await page.$$('#quiz-container .practice-options button');
                        await options[correct[i]].focus(); await page.keyboard.press('Enter');
                        await page.waitForFunction(score => fixtureSaves.some(r => r.p_activity_key === 'quiz_posture_5' && r.p_score === score), {}, i + 1);
                        await page.waitForSelector('#quiz-container > button');
                        await page.$eval('#quiz-container > button', e => e.focus()); await page.keyboard.press('Enter');
                    }
                    const controls = ['win-size', 'win-size', 'win-min', 'win-taskbar', 'win-close'];
                    for (let i = 0; i < controls.length; i++) {
                        await page.$eval('#' + controls[i], e => e.focus()); await page.keyboard.press('Enter');
                        await page.waitForFunction(score => fixtureSaves.some(r => r.p_activity_key === 'window_practice_5' && r.p_score === score), {}, i + 1);
                        await page.waitForFunction(() => !document.querySelector('#window-next').classList.contains('hidden'));
                        await page.$eval('#window-next', e => e.focus()); await page.keyboard.press('Enter');
                    }
                    await page.reload({ waitUntil: 'networkidle2' });
                    assert.match(await page.$eval('#quiz-container', e => e.textContent), /五題完成/);
                    assert.equal(await page.$eval('#win-close', e => e.disabled), true);
                } else {
                    for (const option of await page.$$('#quiz-container [data-correct="true"]')) {
                        await option.focus(); await page.keyboard.press('Enter');
                    }
                    await page.$eval('#quiz-submit-btn', e => e.focus()); await page.keyboard.press('Enter');
                    await page.waitForFunction(() => fixtureSaves.some(r => r.p_activity_key === 'quiz_device_safety_5' && r.p_score === 5));
                    await page.reload({ waitUntil: 'networkidle2' });
                    assert.equal(await page.$eval('#quiz-submit-btn', e => e.disabled), true);
                }
                await page.goto(base + '/my-tree.html?course=grade3-115-1', { waitUntil: 'networkidle2' });
                assert.equal(await page.$eval('#leaf-count', e => Number(e.textContent)), name === 'week02' ? 2 : 1);
                console.log(`PASS ${name}: other saved challenges, completed reload, tree`);
            } finally { await context.close(); }
        }
        assert.deepEqual(errors, []);
    } finally { clearInterval(timer); await connection.browser.disconnect(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
