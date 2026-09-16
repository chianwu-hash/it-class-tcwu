const assert = require('node:assert/strict');
const fs = require('node:fs');
const { connectCdp } = require('D:/projects/cdp-tools/packages/cdp-safe-client');

const url = 'http://127.0.0.1:3000/grade3/115-1/week03.html';
const outputDir = 'automation/output';

async function createPage(connection, viewport, pageUrl = url) {
    const context = await connection.browser.createBrowserContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport(viewport);
    await page.evaluateOnNewDocument(() => {
        localStorage.setItem('it-class-tcwu:class-card:grade3-115-1:v1', JSON.stringify({
            type: 'class-card', source: 'sample-roster', courseId: 'grade3-115-1',
            profileId: 'visual-check', classCode: '399', seatNo: 99, seatLabel: '99',
            displayName: '測試小兔', studentCode: '39999', birthdayCode: '0101'
        }));
    });
    await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('#quiz-container .opt-btn', { visible: true });
    return { context, page, errors };
}

async function drag(page, fromSelector, toSelector) {
    await page.$eval(fromSelector, element => element.scrollIntoView({ block: 'center' }));
    await page.evaluate((sourceSelector, targetSelector) => {
        const source = document.querySelector(sourceSelector);
        const target = document.querySelector(targetSelector);
        const dataTransfer = new DataTransfer();
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
        source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
    }, fromSelector, toSelector);
}

async function verifyDesktop(connection) {
    const { context, page, errors } = await createPage(connection, { width: 1366, height: 900 });
    try {
        assert.equal(await page.$$eval('.activity-section', elements => elements.length), 6);
        assert.equal(await page.$$eval('#quiz-container > .bg-gray-50', elements => elements.length), 5);
        assert.equal(await page.$$eval('#quiz-container .opt-btn', elements => elements.length), 15);
        assert.equal(await page.evaluate(() => document.activeElement?.id), '');
        await page.click('[data-typing-tool-toggle="keyboard"]');
        assert.equal(await page.$eval('#floating-kb-panel', element => element.classList.contains('hidden')), false);
        assert.deepEqual(await page.$$eval('#floating-letter-key-guide .typing-letter-key.is-target', elements => elements.map(element => element.dataset.key).sort()), ['a', 'i', 'm']);
        assert((await page.$eval('#floating-letter-key-guide .typing-letter-guide-help', element => element.textContent)).includes('mia'));
        await (await page.$('#floating-kb-panel')).screenshot({ path: `${outputDir}/grade3-week03-typing-keyboard-guide.png` });
        await page.click('[data-typing-tool-close="keyboard"]');
        await page.$eval('#block-level2', element => element.classList.remove('hidden'));
        await page.click('[data-typing-tool-toggle="keyboard"]');
        assert.deepEqual(await page.$$eval('#floating-letter-key-guide .typing-letter-key.is-target', elements => elements.map(element => element.dataset.key).sort()), ['a', 'h', 't']);
        await page.click('[data-typing-tool-close="keyboard"]');
        await page.$eval('#block-level2', element => element.classList.add('hidden'));
        const firstQuestionOptions = await page.$$('#quiz-container > .bg-gray-50:first-child .opt-btn');
        await firstQuestionOptions[0].click();
        assert.equal(await firstQuestionOptions[0].evaluate(element => element.classList.contains('selected')), true);
        assert.equal(await firstQuestionOptions[0].evaluate(element => element.getAttribute('aria-pressed')), 'true');
        assert((await firstQuestionOptions[0].evaluate(element => getComputedStyle(element, '::after').content)).includes('已選'));
        await firstQuestionOptions[1].click();
        assert.equal(await firstQuestionOptions[0].evaluate(element => element.classList.contains('selected')), false);
        assert.equal(await firstQuestionOptions[0].evaluate(element => element.getAttribute('aria-pressed')), 'false');
        assert.equal(await firstQuestionOptions[1].evaluate(element => element.classList.contains('selected')), true);
        await (await page.$('#quiz-container > .bg-gray-50:first-child')).screenshot({ path: `${outputDir}/grade3-week03-quiz-selected.png` });
        await page.click('#zhuyin-toggle');
        assert.equal(await page.$eval('#zhuyin-toggle', element => element.getAttribute('aria-pressed')), 'true');
        assert((await page.$$eval('#quiz-container rt', elements => elements.length)) > 0);
        await page.click('#zhuyin-toggle');
        await page.$eval('#quiz-replay', element => element.classList.remove('hidden'));
        await page.click('#quiz-replay');
        await page.waitForSelector('#opts-101');
        assert.equal(await page.$$eval('#quiz-container > .bg-gray-50', elements => elements.length), 5);
        assert.equal(await page.$eval('#typing-levels-container', element => element.children.length), 6);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

        await page.click('#warmup-input');
        assert.equal(await page.evaluate(() => document.activeElement?.id), 'warmup-input');
        await page.type('#warmup-input', '123');
        await page.click('#warmup-check');
        assert.equal(await page.$eval('#warmup-stage-badge', element => element.textContent.trim()), '第 2 題');
        await page.type('#warmup-input', '508');
        await page.click('#warmup-check');
        assert.equal(await page.$eval('#warmup-stage-badge', element => element.textContent.trim()), '第 3 題');
        assert.equal(await page.$eval('#letter-key-guide .typing-letter-key[data-key="a"] small', element => element.textContent), 'a');
        await (await page.$('#letter-key-guide')).screenshot({ path: `${outputDir}/grade3-week03-lowercase-keyboard.png` });
        await page.type('#warmup-input', 'abc');
        await page.click('#warmup-check');
        await page.type('#warmup-input', 'dog');
        await page.click('#warmup-check');
        await page.click('#warmup-replay');
        assert.equal(await page.$eval('#warmup-label strong', element => element.textContent), '246');

        await drag(page, '.move-card', '.drop-target');
        assert.equal(await page.$eval('.drop-target', element => element.classList.contains('done')), true);
        assert.equal(await page.$eval('#move-next', element => element.classList.contains('hidden')), false);
        await page.click('#move-next');
        await drag(page, '.move-card', '.drop-target');
        await page.click('#move-next');
        await drag(page, '.move-card', '.drop-target');
        await page.click('#move-next');
        assert.equal(await page.$eval('.move-card strong', element => element.textContent), 'goat');

        await page.$eval('[data-selection-arena="box"]', element => element.scrollIntoView({ behavior: 'instant', block: 'center' }));
        await new Promise(resolve => setTimeout(resolve, 250));
        const points = await page.evaluate(() => {
            const arena = document.querySelector('[data-selection-arena="box"]');
            const cards = [...arena.querySelectorAll('.select-card-item')].slice(0, 3);
            const first = cards[0].getBoundingClientRect();
            const third = cards[2].getBoundingClientRect();
            const target = arena.querySelector('.selection-target').getBoundingClientRect();
            return {
                start: { x: first.left - 5, y: first.top - 5 },
                end: { x: third.right + 5, y: third.bottom + 5 },
                card: { x: first.left + first.width / 2, y: first.top + first.height / 2 },
                target: { x: target.left + target.width / 2, y: target.top + target.height / 2 }
            };
        });
        await page.mouse.move(points.start.x, points.start.y);
        await new Promise(resolve => setTimeout(resolve, 100));
        await page.mouse.down();
        await new Promise(resolve => setTimeout(resolve, 100));
        await page.mouse.move(points.end.x, points.end.y, { steps: 30 });
        await new Promise(resolve => setTimeout(resolve, 100));
        await page.mouse.up();
        assert.equal(await page.$$eval('[data-selection-arena="box"] .select-card-item.selected', elements => elements.length), 3);
        await page.mouse.click(points.start.x, points.start.y);
        assert.equal(await page.$$eval('[data-selection-arena="box"] .select-card-item.selected', elements => elements.length), 0);
        assert((await page.$eval('#box-feedback', element => element.textContent)).includes('已取消選取'));
        await page.mouse.move(points.start.x, points.start.y);
        await page.mouse.down();
        await page.mouse.move(points.end.x, points.end.y, { steps: 30 });
        await page.mouse.up();
        assert.equal(await page.$$eval('[data-selection-arena="box"] .select-card-item.selected', elements => elements.length), 3);
        await page.mouse.move(points.card.x, points.card.y);
        await new Promise(resolve => setTimeout(resolve, 100));
        await page.mouse.down();
        await new Promise(resolve => setTimeout(resolve, 100));
        await page.mouse.move(points.target.x, points.target.y, { steps: 18 });
        await new Promise(resolve => setTimeout(resolve, 100));
        await page.mouse.up();
        assert.equal(await page.$eval('[data-selection-arena="box"] .selection-target', element => element.classList.contains('done')), true);
        await page.click('#box-replay');
        assert((await page.$eval('#box-challenge-title', element => element.textContent)).includes('右邊 2 張'));
        const rightToLeft = await page.evaluate(() => {
            const arena = document.querySelector('[data-selection-arena="box"]');
            const cards = [...arena.querySelectorAll('.select-card-item')];
            const name = cards[3].getBoundingClientRect();
            const team = cards[4].getBoundingClientRect();
            const target = arena.querySelector('.selection-target').getBoundingClientRect();
            return {
                start: { x: team.right + 5, y: team.top - 5 },
                end: { x: name.left - 5, y: name.bottom + 5 },
                card: { x: name.left + name.width / 2, y: name.top + name.height / 2 },
                target: { x: target.left + target.width / 2, y: target.top + target.height / 2 }
            };
        });
        await page.mouse.move(rightToLeft.start.x, rightToLeft.start.y);
        await page.mouse.down();
        await page.mouse.move(rightToLeft.end.x, rightToLeft.end.y, { steps: 30 });
        await page.mouse.up();
        assert.deepEqual(await page.$$eval('[data-selection-arena="box"] .select-card-item.selected', elements => elements.map(element => element.dataset.item)), ['name', 'team']);
        await page.mouse.move(rightToLeft.card.x, rightToLeft.card.y);
        await page.mouse.down();
        await page.mouse.move(rightToLeft.target.x, rightToLeft.target.y, { steps: 20 });
        await page.mouse.up();
        assert.equal(await page.$eval('[data-selection-arena="box"] .selection-target', element => element.classList.contains('done')), true);
        await page.click('#box-replay');
        assert((await page.$eval('#box-challenge-title', element => element.textContent)).includes('4 張'));
        await page.$eval('#box-replay', element => element.classList.remove('hidden'));
        await page.click('#box-replay');
        assert((await page.$eval('#box-challenge-title', element => element.textContent)).includes('5 張'));

        await page.$eval('[data-selection-arena="ctrl"]', element => element.scrollIntoView({ behavior: 'instant', block: 'center' }));
        await new Promise(resolve => setTimeout(resolve, 250));
        await page.click('[data-selection-arena="ctrl"] [data-item="mia"]');
        assert.deepEqual(await page.$$eval('[data-selection-arena="ctrl"] .select-card-item.selected', elements => elements.map(element => element.dataset.item)), ['mia']);
        await page.click('[data-selection-arena="ctrl"] [data-item="fish"]');
        assert.deepEqual(await page.$$eval('[data-selection-arena="ctrl"] .select-card-item.selected', elements => elements.map(element => element.dataset.item)), ['fish']);
        await page.keyboard.down('Control');
        await page.click('[data-selection-arena="ctrl"] [data-item="mia"]');
        await page.keyboard.up('Control');
        assert.deepEqual(await page.$$eval('[data-selection-arena="ctrl"] .select-card-item.selected', elements => elements.map(element => element.dataset.item)), ['mia', 'fish']);
        await page.keyboard.down('Control');
        await page.click('[data-selection-arena="ctrl"] [data-item="fish"]');
        await page.keyboard.up('Control');
        assert.deepEqual(await page.$$eval('[data-selection-arena="ctrl"] .select-card-item.selected', elements => elements.map(element => element.dataset.item)), ['mia']);
        const ctrlSelectionPoints = await page.evaluate(() => {
            const arena = document.querySelector('[data-selection-arena="ctrl"]');
            const cards = [...arena.querySelectorAll('.select-card-item')];
            const first = cards[0].getBoundingClientRect();
            const second = cards[1].getBoundingClientRect();
            return {
                blank: { x: first.left - 5, y: first.top - 5 },
                end: { x: second.right + 5, y: second.bottom + 5 }
            };
        });
        await page.mouse.click(ctrlSelectionPoints.blank.x, ctrlSelectionPoints.blank.y);
        assert.equal(await page.$$eval('[data-selection-arena="ctrl"] .select-card-item.selected', elements => elements.length), 0);
        await page.mouse.move(ctrlSelectionPoints.blank.x, ctrlSelectionPoints.blank.y);
        await page.mouse.down();
        await page.mouse.move(ctrlSelectionPoints.end.x, ctrlSelectionPoints.end.y, { steps: 24 });
        await page.mouse.up();
        assert.deepEqual(await page.$$eval('[data-selection-arena="ctrl"] .select-card-item.selected', elements => elements.map(element => element.dataset.item)), ['mia', 'fish']);
        await page.mouse.click(ctrlSelectionPoints.blank.x, ctrlSelectionPoints.blank.y);
        assert.equal(await page.$$eval('[data-selection-arena="ctrl"] .select-card-item.selected', elements => elements.length), 0);
        await page.keyboard.down('Control');
        await page.click('[data-selection-arena="ctrl"] [data-item="mia"]');
        await page.click('[data-selection-arena="ctrl"] [data-item="fish"]');
        await page.click('[data-selection-arena="ctrl"] [data-item="name"]');
        await page.keyboard.up('Control');
        assert.equal(await page.$$eval('[data-selection-arena="ctrl"] .select-card-item.selected', elements => elements.length), 3);
        const ctrlPoints = await page.evaluate(() => {
            const arena = document.querySelector('[data-selection-arena="ctrl"]');
            const card = arena.querySelector('[data-item="mia"]').getBoundingClientRect();
            const target = arena.querySelector('.selection-target').getBoundingClientRect();
            return {
                card: { x: card.left + card.width / 2, y: card.top + card.height / 2 },
                target: { x: target.left + target.width / 2, y: target.top + target.height / 2 }
            };
        });
        await page.mouse.move(ctrlPoints.card.x, ctrlPoints.card.y);
        await page.mouse.down();
        await page.mouse.move(ctrlPoints.target.x, ctrlPoints.target.y, { steps: 20 });
        await page.mouse.up();
        assert.equal(await page.$eval('[data-selection-arena="ctrl"] .selection-target', element => element.classList.contains('done')), true);
        await page.click('#ctrl-replay');
        assert((await page.$eval('#ctrl-challenge-title', element => element.textContent)).includes('mia、hat、goat'));

        await page.click('#input-level1');
        await page.type('#input-level1', 'mia');
        assert.equal(await page.$eval('#input-level1', element => element.value), 'mia');
        assert.equal(await page.$eval('#block-level1 .typing-prompt', element => getComputedStyle(element).userSelect), 'none');
        assert.deepEqual(await page.$eval('#input-level1', element => ({
            pasteBlocked: !element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true })),
            dropBlocked: !element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true }))
        })), { pasteBlocked: true, dropBlocked: true });

        await page.screenshot({ path: `${outputDir}/grade3-week03-redesign-desktop.png`, fullPage: true });
        assert.deepEqual(errors, []);
        return { sections: 6, quizQuestions: 5, quizOptions: 15, quizSelectionState: true, zhuyinToggle: true, replayQuestionsChanged: true, lowercaseKeyboardGuide: true, sharedKeyboardGuide: true, keyboardGuideTracksLevel: true, dragDrop: true, boxSelectAndMoveWithMouse: true, boxCancelOnBlankClick: true, rightToLeftBoxSelect: true, boxCounts: [2, 3, 4, 5], ctrlSingleSelect: true, ctrlToggleSelect: true, ctrlBlankCancel: true, ctrlDragSelect: true, ctrlSelectAndMoveWithMouse: true, typingFocus: true, promptSelectionLocked: true, pasteAndDropBlocked: true };
    } finally {
        await context.close();
    }
}

async function verifyTypingReplay(connection) {
    const replayUrl = `${url}?typingPractice=1&typingSet=1`;
    const { context, page, errors } = await createPage(connection, { width: 1024, height: 768 }, replayUrl);
    try {
        assert.deepEqual(await page.$$eval('.typing-stage .word', elements => elements.map(element => element.textContent)), ['hat', 'mia', 'goat', 'fine', 'name', 'fish']);
        assert.deepEqual(errors, []);
        return { changedOrder: true };
    } finally {
        await context.close();
    }
}

async function verifyPerfectQuiz(connection) {
    const { context, page, errors } = await createPage(connection, { width: 1280, height: 900 });
    try {
        const questionCards = await page.$$('#quiz-container > .bg-gray-50');
        for (const card of questionCards) {
            await card.$eval('.opt-btn[data-correct="true"]', button => button.click());
        }
        await page.click('#quiz-submit-btn');
        await page.waitForFunction(() => !document.getElementById('quiz-result')?.classList.contains('hidden'));
        assert.equal(await page.$eval('#quiz-result', element => element.classList.contains('perfect-celebration')), true);
        assert((await page.$eval('#quiz-result-msg', element => element.textContent)).includes('五題全對'));
        assert((await page.$eval('#quiz-status-text', element => element.textContent)).includes('過關記錄尚未儲存'));
        assert.deepEqual(errors, []);
        return { celebrationShown: true, scoreMessagePreservedOnSaveFailure: true };
    } finally {
        await context.close();
    }
}

async function verifyStoredIdentityUpgrade(connection) {
    const context = await connection.browser.createBrowserContext();
    const page = await context.newPage();
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.evaluate(() => {
            localStorage.setItem('it-class-tcwu:class-card:grade3-115-1:v1', JSON.stringify({
                type: 'class-card', source: 'sample-roster', courseId: 'grade3-115-1',
                profileId: 'stale-sample', classCode: '307', seatNo: 30, seatLabel: '30',
                displayName: '吳小謙', studentCode: '30730', birthdayCode: '0701'
            }));
        });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForFunction(() => {
            const raw = localStorage.getItem('it-class-tcwu:class-card:grade3-115-1:v1');
            return raw && JSON.parse(raw).source === 'rpc';
        }, { timeout: 15000 });
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('it-class-tcwu:class-card:grade3-115-1:v1')).source), 'rpc');
        return { staleSampleUpgradedToRpc: true };
    } finally {
        await context.close();
    }
}

async function verifyLegacyTypingTools(connection) {
    const context = await connection.browser.createBrowserContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await page.setViewport({ width: 1024, height: 768 });
        await page.goto('http://127.0.0.1:3000/grade3/week13.html', { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForSelector('[data-typing-tool-toggle="keyboard"]');
        await page.click('[data-typing-tool-toggle="keyboard"]');
        assert(await page.$('#keyboard-tab-zh'));
        assert(await page.$('#keyboard-tab-en'));
        assert(await page.$('#keyboard-img-zh'));
        assert(await page.$('#keyboard-img-en'));
        assert.deepEqual(errors, []);
        return { originalImageModeStillWorks: true };
    } finally {
        await context.close();
    }
}

async function verifyMobile(connection) {
    const { context, page, errors } = await createPage(connection, { width: 390, height: 844 });
    try {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        const minimumButtonHeight = await page.$$eval('main button:not(.hidden)', buttons => {
            const visibleHeights = buttons.map(button => button.getBoundingClientRect().height).filter(height => height > 0);
            return Math.min(...visibleHeights);
        });
        assert(minimumButtonHeight >= 48);
        await page.screenshot({ path: `${outputDir}/grade3-week03-redesign-mobile.png`, fullPage: true });
        assert.deepEqual(errors, []);
        return { noHorizontalOverflow: true, minimumButtonHeight };
    } finally {
        await context.close();
    }
}

(async () => {
    fs.mkdirSync(outputDir, { recursive: true });
    const connection = await connectCdp({ cdpUrl: 'http://127.0.0.1:9232', targetUrl: url });
    try {
        const desktop = await verifyDesktop(connection);
        const mobile = await verifyMobile(connection);
        const typingReplay = await verifyTypingReplay(connection);
        const perfectQuiz = await verifyPerfectQuiz(connection);
        const identityUpgrade = await verifyStoredIdentityUpgrade(connection);
        const legacyTypingTools = await verifyLegacyTypingTools(connection);
        console.log(JSON.stringify({ desktop, mobile, typingReplay, perfectQuiz, identityUpgrade, legacyTypingTools }, null, 2));
    } finally {
        connection.disconnect();
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
