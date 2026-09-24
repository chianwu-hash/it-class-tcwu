const assert = require('node:assert/strict');
const fs = require('node:fs');
const { connectCdp, safeScreenshot } = require('D:/projects/cdp-tools/packages/cdp-safe-client');

const url = 'http://localhost:3000/grade3/115-1/week04.html';
const storageKey = 'it-class-tcwu:class-card:grade3-115-1:v1';
const expectedExpressions = [
    '光精靈 ＋ 火精靈 ＝ ？',
    '樹精靈 － 火精靈 ＝ ？',
    '海精靈 ＋ 光精靈 ＝ ？',
    '火精靈 × 海精靈 ＝ ？',
    '樹精靈 － 光精靈 ＝ ？'
];

function mockAuthModule() {
    return `
export const SUPABASE_URL = 'https://week04-test.invalid';
export const SUPABASE_ANON_KEY = 'test';
export const AUTH_STORAGE_KEY = 'week04-test-only';
export const isTeacher = () => false;
export const getSession = async () => ({ session: null, error: null });
export const getStoredAccessToken = () => null;
export const resolveSession = async () => null;
export const beginCentralizedLogin = () => {};
export const signOutAndReload = async () => {};
export const supabase = {
    auth: { onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; } },
    async rpc(name, params) {
        const response = await fetch('https://week04-test.invalid/rpc/' + name, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        if (!response.ok) return { data: null, error: { code: 'TEST', message: 'test rpc failure' } };
        return { data: await response.json(), error: null };
    }
};
`;
}

async function createPage(connection, seatNo, viewport = { width: 1366, height: 900 }) {
    const context = await connection.browser.createBrowserContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });
    await page.setViewport(viewport);
    if (seatNo) {
        await page.evaluateOnNewDocument((key, seat) => {
            localStorage.setItem(key, JSON.stringify({
                type: 'class-card',
                source: 'sample-roster',
                courseId: 'grade3-115-1',
                profileId: `week04-check-${seat}`,
                classCode: '399',
                seatNo: seat,
                seatLabel: String(seat).padStart(2, '0'),
                displayName: `測試學生${seat}`,
                studentCode: `399${String(seat).padStart(2, '0')}`,
                birthdayCode: '0101'
            }));
        }, storageKey, seatNo);
    }
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('#typing-levels-container');
    return { context, page, errors };
}

(async () => {
    fs.mkdirSync('automation/output', { recursive: true });
    const connection = await connectCdp({ cdpUrl: 'http://127.0.0.1:9232', targetUrl: url });
    const results = { groups: [], anonymousLocked: false, desktop: {}, mobile: {}, progress: {} };
    let progressRecord = null;
    const progressWrites = [];
    let failNextProgressWrite = false;
    try {
        for (let seat = 1; seat <= 5; seat += 1) {
            const { context, page, errors } = await createPage(connection, seat);
            try {
                const expression = await page.$eval('#treasure-expression', element => element.textContent.trim());
                const label = await page.$eval('#treasure-group-label', element => element.textContent.trim());
                assert.equal(expression, expectedExpressions[seat - 1]);
                assert(label.includes(`第 ${seat} 組線索`));
                assert.deepEqual(errors, []);
                results.groups.push({ seat, expression });

                if (seat === 1) {
                    const inputModeReminder = await page.$eval('#input-mode-reminder', element => element.textContent.replace(/\s+/g, ' ').trim());
                    assert(inputModeReminder.includes('右下角顯示「中」'));
                    assert(inputModeReminder.includes('切成「英」再輸入'));
                    assert(inputModeReminder.includes('不用 Shift＋字母'));
                    await page.$eval('.shift-key-hint .typing-key-hint', element => element.focus({ preventScroll: true }));
                    await page.waitForFunction(() => getComputedStyle(document.querySelector('.shift-key-hint .typing-key-popover')).visibility === 'visible');
                    assert.equal(await page.$$eval('.shift-key-hint .is-shift', elements => elements.length), 2);
                    assert((await page.$eval('.shift-key-hint .typing-key-popover-title', element => element.textContent)).includes('左右兩側'));
                    await page.type('#warmup-input', 'mia');
                    await page.click('[data-typing-tool-toggle="keyboard"]');
                    assert.equal(await page.$eval('#floating-letter-key-guide .typing-letter-sequence', element => element.textContent.trim()), 'M → I → A');
                    assert.deepEqual(
                        await page.$$eval('#floating-letter-key-guide .typing-letter-key.is-target', elements => elements.map(element => element.dataset.key).sort()),
                        ['a', 'i', 'm']
                    );
                    await page.click('[data-typing-tool-close="keyboard"]');
                    await page.click('#warmup-check');
                    await page.click('[data-typing-tool-toggle="keyboard"]');
                    assert.equal(await page.$eval('#floating-letter-key-guide .typing-letter-sequence', element => element.textContent.trim()), 'A → B → U');
                    assert.deepEqual(
                        await page.$$eval('#floating-letter-key-guide .typing-letter-key.is-target', elements => elements.map(element => element.dataset.key).sort()),
                        ['a', 'b', 'u']
                    );
                    await page.click('[data-typing-tool-close="keyboard"]');
                    await page.waitForSelector('#warmup-backspace-hint .typing-key-hint');
                    await page.$eval('#warmup-backspace-hint .typing-key-hint', element => {
                        const navHeight = document.querySelector('body > nav')?.getBoundingClientRect().height ?? 0;
                        document.documentElement.style.scrollBehavior = 'auto';
                        window.scrollTo(0, element.getBoundingClientRect().top + scrollY - navHeight - 12);
                    });
                    await new Promise(resolve => setTimeout(resolve, 100));
                    await page.$eval('#warmup-backspace-hint .typing-key-hint', element => element.focus({ preventScroll: true }));
                    await page.waitForFunction(() => getComputedStyle(document.querySelector('#warmup-backspace-hint .typing-key-popover')).visibility === 'visible');
                    const backspaceHint = await page.$eval('#warmup-backspace-hint .typing-key-popover', element => {
                        const rect = element.getBoundingClientRect();
                        const navBottom = document.querySelector('body > nav')?.getBoundingClientRect().bottom ?? 0;
                        return { top: rect.top, bottom: rect.bottom, navBottom, placedBelow: element.classList.contains('is-below-center') };
                    });
                    assert.equal(backspaceHint.placedBelow, true, JSON.stringify(backspaceHint));
                    assert(backspaceHint.top >= backspaceHint.navBottom);
                    assert(backspaceHint.bottom <= 900);
                    await safeScreenshot(page, { path: 'automation/output/grade3-week04-backspace-near-top.png', fullPage: false });

                    assert.equal(await page.$$eval('.caps-lock-location-hint', elements => elements.length), 2);
                    await page.$eval('.caps-lock-location-hint', element => element.scrollIntoView({ block: 'center' }));
                    await page.hover('.caps-lock-location-hint');
                    await page.waitForFunction(() => getComputedStyle(document.querySelector('.caps-lock-location-hint .typing-key-popover')).visibility === 'visible');
                    const capsLockHint = await page.$eval('.caps-lock-location-hint .typing-key-popover', element => ({
                        title: element.querySelector('.typing-key-popover-title')?.textContent.trim(),
                        highlightedKey: element.querySelector('.is-capslock')?.textContent.trim(),
                        rect: (() => {
                            const rect = element.getBoundingClientRect();
                            return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
                        })()
                    }));
                    assert.equal(capsLockHint.title, 'Caps Lock 在鍵盤左側、A 鍵旁邊');
                    assert.equal(capsLockHint.highlightedKey, 'Caps Lock');
                    assert(capsLockHint.rect.left >= 0 && capsLockHint.rect.right <= 1366);
                    assert(capsLockHint.rect.top >= 0 && capsLockHint.rect.bottom <= 900);
                    await safeScreenshot(page, { path: 'automation/output/grade3-week04-capslock-location.png', fullPage: false });
                    assert.equal(await page.$eval('#block-level2', element => element.classList.contains('hidden')), true);
                    assert.equal(await page.$eval('#block-level1 .word', element => element.textContent.trim()), 'Leo');
                    assert.equal(await page.$eval('#block-level3 .word', element => element.textContent.trim()), 'Abu');
                    assert.equal(await page.$eval('#block-level4 .word', element => element.textContent.trim()), 'MIA');
                    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
                    await page.$eval('#block-level2', element => element.classList.remove('hidden'));
                    assert((await page.$eval('#block-level2', element => element.innerText)).includes('老師上課前用電腦教室管理系統放好的'));
                    await page.click('[data-typing-tool-toggle="keyboard"]');
                    const targetKeys = await page.$$eval('#floating-letter-key-guide .typing-letter-key.is-target', elements => elements.map(element => element.dataset.key).sort());
                    assert.deepEqual(targetKeys, []);
                    await page.click('[data-typing-tool-close="keyboard"]');
                    await page.$eval('#input-level2', element => { element.disabled = false; });
                    await page.$eval('#check-2', element => { element.disabled = false; });
                    await page.type('#input-level2', '5');
                    await page.click('#check-2');
                    await page.waitForFunction(() => document.querySelector('#msg-level2')?.textContent.includes('數字答案還不正確'));
                    const wrongAnswerHint = await page.$eval('#msg-level2', element => element.textContent.trim());
                    assert.equal(/\d/.test(wrongAnswerHint), false);
                    assert.equal(wrongAnswerHint.includes('6'), false);
                    await safeScreenshot(page, { path: 'automation/output/grade3-week04-treasure-desktop.png', fullPage: true });
                    results.desktop = {
                        noHorizontalOverflow: true,
                        treasureInitiallyLocked: true,
                        backspaceHintFlipsBelowNearNavbar: true,
                        capsLockLocationHint: true,
                        shiftInputModeReminderAndLocationHint: true,
                        keyboardGuideDoesNotTargetLetters: true,
                        wrongAnswerHintHidesAnswer: true
                    };
                }
            } finally {
                await context.close();
            }
        }

        const anonymous = await createPage(connection, null);
        try {
            assert.equal(await anonymous.page.$eval('#warmup-input', element => element.disabled), true);
            assert.equal(await anonymous.page.$eval('#input-level1', element => element.disabled), true);
            assert.equal(await anonymous.page.$eval('#typing-levels-container', element => element.inert), true);
            assert.deepEqual(anonymous.errors, []);
            results.anonymousLocked = true;
        } finally {
            await anonymous.context.close();
        }

        const mobile = await createPage(connection, 5, { width: 390, height: 844 });
        try {
            const fillWarmup = async value => {
                await mobile.page.$eval('#warmup-input', element => { element.value = ''; });
                await mobile.page.type('#warmup-input', value);
            };
            const warmupBounds = await mobile.page.evaluate(() => {
                const card = document.querySelector('.mission-content').getBoundingClientRect();
                const input = document.querySelector('#warmup-input').getBoundingClientRect();
                const button = document.querySelector('#warmup-check').getBoundingClientRect();
                return { cardRight: card.right, inputRight: input.right, buttonRight: button.right };
            });
            assert(warmupBounds.inputRight <= warmupBounds.cardRight + 1);
            assert(warmupBounds.buttonRight <= warmupBounds.cardRight + 1);

            await fillWarmup('mia');
            await mobile.page.click('#warmup-check');
            await mobile.page.waitForSelector('#warmup-backspace-hint .typing-key-hint');
            await mobile.page.focus('#warmup-input');
            await mobile.page.keyboard.press('Backspace');
            await mobile.page.keyboard.press('Backspace');
            await mobile.page.keyboard.press('Backspace');
            await mobile.page.type('#warmup-input', 'Abu');
            await mobile.page.click('#warmup-check');
            assert.equal(await mobile.page.$eval('#warmup-input', element => element.value), 'Abw');
            assert((await mobile.page.$eval('#warmup-feedback', element => element.textContent)).includes('只刪掉最後的 w'));
            await mobile.page.focus('#warmup-input');
            await mobile.page.keyboard.press('Backspace');
            await mobile.page.type('#warmup-input', 'u');
            await mobile.page.click('#warmup-check');
            assert((await mobile.page.$eval('#warmup-feedback', element => element.textContent)).includes('兩關暖身完成'));

            await mobile.page.$eval('#warmup-backspace-hint .typing-key-hint', element => element.focus({ preventScroll: true }));
            await mobile.page.waitForFunction(() => getComputedStyle(document.querySelector('#warmup-backspace-hint .typing-key-popover')).visibility === 'visible');
            const mobileHintBounds = await mobile.page.evaluate(() => {
                const navBottom = document.querySelector('body > nav')?.getBoundingClientRect().bottom ?? 0;
                const hint = document.querySelector('#warmup-backspace-hint .typing-key-popover').getBoundingClientRect();
                return { navBottom, hintTop: hint.top, hintBottom: hint.bottom, viewportHeight: innerHeight };
            });
            assert(mobileHintBounds.hintTop >= mobileHintBounds.navBottom);
            assert(mobileHintBounds.hintBottom <= mobileHintBounds.viewportHeight);
            await safeScreenshot(mobile.page, { path: 'automation/output/grade3-week04-mobile-backspace-hint.png', fullPage: false });

            const capsPracticeBounds = await mobile.page.evaluate(() => {
                const card = document.querySelector('.caps-practice-card').getBoundingClientRect();
                const input = document.querySelector('#caps-practice-input').getBoundingClientRect();
                const button = document.querySelector('#caps-practice-check').getBoundingClientRect();
                return { cardLeft: card.left, cardRight: card.right, inputLeft: input.left, inputRight: input.right, buttonLeft: button.left, buttonRight: button.right };
            });
            assert(capsPracticeBounds.inputLeft >= capsPracticeBounds.cardLeft - 1 && capsPracticeBounds.inputRight <= capsPracticeBounds.cardRight + 1);
            assert(capsPracticeBounds.buttonLeft >= capsPracticeBounds.cardLeft - 1 && capsPracticeBounds.buttonRight <= capsPracticeBounds.cardRight + 1);

            await mobile.page.$eval('#block-level2', element => element.classList.remove('hidden'));
            assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            await safeScreenshot(mobile.page, { path: 'automation/output/grade3-week04-treasure-mobile.png', fullPage: true });
            assert.deepEqual(mobile.errors, []);
            results.mobile = {
                noHorizontalOverflow: true,
                warmupControlsStayInsideCard: true,
                inlineCapsPracticeStaysInsideCard: true,
                clearingAndRetypingWarmupIsRejected: true,
                keyboardHintStaysBelowNavbar: true
            };
        } finally {
            await mobile.context.close();
        }

        const progressContext = await connection.browser.createBrowserContext();
        const progressPage = await progressContext.newPage();
        const progressErrors = [];
        progressPage.on('pageerror', error => progressErrors.push(error.message));
        progressPage.on('console', message => {
            if (message.type() === 'error') progressErrors.push(message.text());
        });
        await progressPage.setRequestInterception(true);
        progressPage.on('request', async request => {
            try {
                const requestUrl = new URL(request.url());
                if (requestUrl.origin === 'http://localhost:3000' && requestUrl.pathname === '/shared/auth.js') {
                    await request.respond({ status: 200, contentType: 'text/javascript', body: mockAuthModule() });
                    return;
                }
                if (requestUrl.hostname === 'week04-test.invalid') {
                    if (request.method() === 'OPTIONS') {
                        await request.respond({
                            status: 204,
                            headers: {
                                'Access-Control-Allow-Origin': '*',
                                'Access-Control-Allow-Headers': 'content-type',
                                'Access-Control-Allow-Methods': 'POST,OPTIONS'
                            }
                        });
                        return;
                    }
                    const params = JSON.parse(request.postData() || '{}');
                    if (requestUrl.pathname.endsWith('/upsert_guest_progress')) {
                        if (failNextProgressWrite) {
                            failNextProgressWrite = false;
                            await request.respond({
                                status: 500,
                                headers: { 'Access-Control-Allow-Origin': '*' },
                                contentType: 'application/json',
                                body: JSON.stringify({ message: 'simulated save failure' })
                            });
                            return;
                        }
                        assert.equal(params.p_course_id, 'grade3-115-1');
                        assert.equal(params.p_week_code, '04');
                        assert.equal(params.p_activity_key, 'typing_task_6');
                        progressRecord = {
                            current_level: params.p_current_level,
                            score: params.p_score,
                            completed: params.p_completed
                        };
                        progressWrites.push({ ...params });
                        await request.respond({
                            status: 200,
                            headers: { 'Access-Control-Allow-Origin': '*' },
                            contentType: 'application/json',
                            body: 'null'
                        });
                        return;
                    }
                    if (requestUrl.pathname.endsWith('/get_guest_progress')) {
                        await request.respond({
                            status: 200,
                            headers: { 'Access-Control-Allow-Origin': '*' },
                            contentType: 'application/json',
                            body: JSON.stringify(progressRecord ? [progressRecord] : [])
                        });
                        return;
                    }
                }
                await request.continue();
            } catch (error) {
                progressErrors.push(`intercept: ${error.message}`);
                await request.abort().catch(() => {});
            }
        });
        await progressPage.evaluateOnNewDocument(key => {
            localStorage.setItem(key, JSON.stringify({
                type: 'class-card',
                source: 'rpc',
                courseId: 'grade3-115-1',
                profileId: 'grade3-115-1:399:01',
                classCode: '399',
                seatNo: 1,
                seatLabel: '01',
                displayName: '測試學生',
                studentCode: '39901',
                birthdayCode: '0101'
            }));
        }, storageKey);
        try {
            const fillProgressInput = async (selector, value) => {
                await progressPage.$eval(selector, element => {
                    element.value = '';
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                });
                await progressPage.type(selector, value);
            };
            const completeRetryWithoutWrite = async (level, expectedQuestion, answer, expectedWriteCount) => {
                await progressPage.waitForFunction(currentLevel => !document.querySelector(`#practice-actions-level${currentLevel}`)?.classList.contains('hidden'), {}, level);
                await progressPage.click(`#retry-level${level}`);
                if (level === 2) {
                    assert.equal(await progressPage.$eval('#treasure-expression', element => element.textContent.trim()), expectedQuestion);
                } else {
                    assert.equal(await progressPage.$eval(`#block-level${level} .typing-prompt .word`, element => element.textContent.trim()), expectedQuestion);
                }
                assert.equal(await progressPage.$eval(`#input-level${level}`, element => element.readOnly), false);
                await fillProgressInput(`#input-level${level}`, answer);
                await progressPage.click(`#check-${level}`);
                await progressPage.waitForFunction(currentLevel => document.querySelector(`#msg-level${currentLevel}`)?.textContent.includes('再練習完成'), {}, level);
                assert.equal(progressWrites.length, expectedWriteCount);
            };

            await progressPage.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await progressPage.waitForFunction(() => !document.querySelector('#input-level1')?.disabled);
            assert.equal(await progressPage.$$eval('.level-retry-button', elements => elements.length), 6);
            assert.equal(await progressPage.$eval('#mia-input-jump', element => element.classList.contains('hidden')), true);
            await fillProgressInput('#caps-practice-input', 'mia');
            await progressPage.click('[data-typing-tool-toggle="keyboard"]');
            assert.equal(await progressPage.$eval('#floating-letter-key-guide .typing-letter-sequence', element => element.textContent.trim()), 'M → I → A');
            assert.deepEqual(
                await progressPage.$$eval('#floating-letter-key-guide .typing-letter-key.is-target', elements => elements.map(element => element.dataset.key).sort()),
                ['a', 'i', 'm']
            );
            await progressPage.click('[data-typing-tool-close="keyboard"]');
            await progressPage.click('#caps-practice-check');
            assert((await progressPage.$eval('#caps-practice-feedback', element => element.textContent)).includes('第一個字母還是小寫'));
            await fillProgressInput('#caps-practice-input', 'MIA');
            await progressPage.click('#caps-practice-check');
            assert((await progressPage.$eval('#caps-practice-feedback', element => element.textContent)).includes('ia 也變成大寫'));
            await fillProgressInput('#caps-practice-input', 'Mia');
            await progressPage.click('#caps-practice-check');
            assert((await progressPage.$eval('#caps-practice-feedback', element => element.textContent)).includes('下一關請把方法換到 Leo'));
            assert.equal(await progressPage.$eval('#caps-practice-input', element => element.readOnly), true);
            assert.equal(await progressPage.$eval('#mia-input-jump', element => element.classList.contains('hidden')), false);
            assert.equal(progressWrites.length, 0);
            assert((await progressPage.$eval('#mia-input-jump', element => element.textContent)).includes('前往「主線第 1 關」輸入 Leo'));
            await progressPage.$eval('.caps-practice-card', element => element.scrollIntoView({ block: 'center' }));
            await safeScreenshot(progressPage, { path: 'automation/output/grade3-week04-inline-mia-practice.png', fullPage: false });
            await progressPage.click('#caps-practice-check');
            assert.equal(await progressPage.$eval('#caps-practice-input', element => element.value), '');
            assert.equal(await progressPage.$eval('#mia-input-jump', element => element.classList.contains('hidden')), true);
            await fillProgressInput('#caps-practice-input', 'Mia');
            await progressPage.click('#caps-practice-check');
            assert.equal(progressWrites.length, 0);
            await progressPage.click('#mia-input-jump');
            await progressPage.waitForFunction(() => document.activeElement?.id === 'input-level1');
            await progressPage.type('#input-level1', 'Leo');
            failNextProgressWrite = true;
            await progressPage.click('#check-1');
            await progressPage.waitForFunction(() => document.querySelector('#msg-level1')?.textContent.includes('進度還沒記錄成功'));
            assert.equal(await progressPage.$eval('#block-level2', element => element.classList.contains('hidden')), true);
            assert.equal(await progressPage.$eval('#treasure-unlocked', element => element.classList.contains('hidden')), true);
            assert((await progressPage.$eval('#progress-status', element => element.textContent)).includes('暫時沒有記錄成功'));
            assert.equal(progressWrites.length, 0);
            assert(progressErrors.some(message => message.includes('500')));
            progressErrors.length = 0;
            await progressPage.click('#check-1');
            await progressPage.waitForFunction(() => !document.querySelector('#block-level2')?.classList.contains('hidden'));
            assert.equal(progressWrites.length, 1);
            assert.deepEqual(progressRecord, { current_level: 2, score: 1, completed: false });
            assert.equal(await progressPage.$eval('#treasure-unlocked', element => element.classList.contains('hidden')), false);
            await progressPage.waitForFunction(() => !document.querySelector('#practice-actions-level1')?.classList.contains('hidden'));
            await safeScreenshot(progressPage, { path: 'automation/output/grade3-week04-level1-retry-actions.png', fullPage: false });
            await completeRetryWithoutWrite(1, 'Ben', 'Ben', 1);

            await progressPage.reload({ waitUntil: 'networkidle2', timeout: 30000 });
            await progressPage.waitForFunction(() => !document.querySelector('#block-level2')?.classList.contains('hidden'));
            assert.equal(await progressPage.$eval('#input-level1', element => element.readOnly), true);
            await progressPage.click('#check-2');
            await progressPage.waitForFunction(() => document.querySelector('#msg-level2')?.textContent.includes('請先在白色輸入框輸入'));
            await progressPage.type('#input-level2', '6');
            await progressPage.click('#check-2');
            await progressPage.waitForFunction(() => !document.querySelector('#block-level3')?.classList.contains('hidden'));
            assert.equal(progressWrites.length, 2);
            assert.deepEqual(progressRecord, { current_level: 3, score: 2, completed: false });
            assert.equal(await progressPage.$eval('#mainline-complete', element => element.classList.contains('hidden')), false);
            await completeRetryWithoutWrite(2, '樹精靈 － 火精靈 ＝ ？', '12', 2);

            const remainingLevels = [
                { level: 3, first: 'Abu', retryQuestion: 'Mia', retry: 'Mia' },
                { level: 4, first: 'MIA', retryQuestion: 'ABU', retry: 'ABU' },
                { level: 5, first: 'Mia, Abu', retryQuestion: 'Abu, Mia', retry: 'Abu, Mia' },
                { level: 6, first: 'My name is Mia.', retryQuestion: 'My name is Abu.', retry: 'My name is Abu.' }
            ];
            for (const item of remainingLevels) {
                await fillProgressInput(`#input-level${item.level}`, item.first);
                await progressPage.click(`#check-${item.level}`);
                if (item.level < 6) {
                    try {
                        await progressPage.waitForFunction(nextLevel => !document.querySelector(`#block-level${nextLevel}`)?.classList.contains('hidden'), { timeout: 10000 }, item.level + 1);
                    } catch (error) {
                        const levelState = await progressPage.evaluate((currentLevel, nextLevel) => ({
                            nextVisible: !document.querySelector(`#block-level${nextLevel}`)?.classList.contains('hidden'),
                            value: document.querySelector(`#input-level${currentLevel}`)?.value,
                            readOnly: document.querySelector(`#input-level${currentLevel}`)?.readOnly,
                            message: document.querySelector(`#msg-level${currentLevel}`)?.textContent.trim(),
                            status: document.querySelector('#progress-status')?.textContent.trim()
                        }), item.level, item.level + 1);
                        throw new Error(`Level advance failed: ${JSON.stringify({ level: item.level, writes: progressWrites.length, errors: progressErrors, ...levelState })}`, { cause: error });
                    }
                } else {
                    await progressPage.waitForFunction(() => document.querySelector('#celebration-overlay'), { timeout: 10000 });
                    const finalState = await progressPage.evaluate(() => ({
                        hasOverlay: Boolean(document.querySelector('#celebration-overlay')),
                        value: document.querySelector('#input-level6')?.value,
                        readOnly: document.querySelector('#input-level6')?.readOnly,
                        message: document.querySelector('#msg-level6')?.textContent.trim()
                    }));
                    assert.equal(finalState.hasOverlay, true, JSON.stringify(finalState));
                    await progressPage.$eval('#celebration-overlay button', button => button.click());
                    await progressPage.waitForFunction(() => !document.querySelector('#celebration-overlay'));
                }
                assert.equal(progressWrites.length, item.level);
                await completeRetryWithoutWrite(item.level, item.retryQuestion, item.retry, item.level);
            }
            assert.deepEqual(progressRecord, { current_level: 6, score: 6, completed: true });
            const fastTaskBadges = await progressPage.$$eval('#block-level3 .level-badge, #block-level4 .level-badge, #block-level5 .level-badge, #block-level6 .level-badge', elements => elements.map(element => element.textContent.trim()));
            assert.deepEqual(fastTaskBadges, [
                '第 3 關｜快手任務 1',
                '第 4 關｜快手任務 2',
                '第 5 關｜快手任務 3',
                '第 6 關｜快手任務 4'
            ]);
            assert.deepEqual(progressErrors, []);
            results.progress = {
                level1SavedAndUnlockedLevel2: true,
                inlineMiaPracticeGivesFeedbackWithoutWritingProgress: true,
                saveFailureDoesNotUnlockLevel2: true,
                reloadResumedLevel2: true,
                level2SavedAndUnlockedLevel3: true,
                everyLevelRetryChangesQuestion: true,
                retriesDoNotWriteOrRollbackProgress: true
            };
        } finally {
            await progressContext.close();
        }

        console.log(JSON.stringify(results, null, 2));
    } finally {
        connection.disconnect();
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
