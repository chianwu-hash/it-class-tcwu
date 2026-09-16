const assert = require('node:assert/strict');
const { connectCdp } = require('D:/projects/cdp-tools/packages/cdp-safe-client');

const url = 'http://127.0.0.1:3000/grade3/115-1/week03.html';

const q5 = {
    title: '5 / 5　下列哪一組做法完整符合影片的四項提醒？',
    options: [
        '在有光線的地方坐著使用，不低頭，使用 30 分鐘後休息 5～10 分鐘',
        '在有光線的地方使用，邊走邊看，使用 30 分鐘後休息 5～10 分鐘',
        '坐著使用但一直低頭，使用 30 分鐘後休息 5～10 分鐘'
    ]
};

async function createPage(connection) {
    const context = await connection.browser.createBrowserContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.evaluateOnNewDocument(() => {
        localStorage.setItem('it-class-tcwu:class-card:grade3-115-1:v1', JSON.stringify({
            type: 'class-card',
            source: 'sample-roster',
            courseId: 'grade3-115-1',
            profileId: 'visual-check',
            classCode: '300',
            seatNo: 1,
            seatLabel: '01',
            displayName: '版面測試',
            studentCode: '30001',
            birthdayCode: '0101'
        }));
    });
    return { context, page, errors };
}

async function injectQuestion(page, question) {
    await page.evaluate((item) => {
        document.querySelector('.quiz-question-row h3').textContent = item.title;
        document.querySelectorAll('.practice-option-text').forEach((element, index) => {
            element.textContent = item.options[index] || '';
        });
    }, question);
    await page.waitForFunction(() => [...document.querySelectorAll('.practice-option-text')].every(element => element.textContent.trim()));
}

async function readMetrics(page) {
    return page.$$eval('.practice-options button', buttons => buttons.map(button => {
        const style = getComputedStyle(button);
        const badge = button.querySelector('.practice-option-label');
        const text = button.querySelector('.practice-option-text');
        return {
            fontSize: parseFloat(style.fontSize),
            height: button.getBoundingClientRect().height,
            badge: badge?.textContent || '',
            clientWidth: button.clientWidth,
            scrollWidth: button.scrollWidth,
            textClientWidth: text?.clientWidth || 0,
            textScrollWidth: text?.scrollWidth || 0
        };
    }));
}

async function assertNoOverflow(page, metrics, minimumFontSize) {
    assert.deepEqual(metrics.map(item => item.badge), ['A', 'B', 'C']);
    assert(metrics.every(item => item.fontSize >= minimumFontSize));
    assert(metrics.every(item => item.scrollWidth <= item.clientWidth + 1));
    assert(metrics.every(item => item.textScrollWidth <= item.textClientWidth + 1));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}

async function verifyQ5({ connection, viewport, zhuyin = false, label, minimumFontSize }) {
    const { context, page, errors } = await createPage(connection);
    try {
        await page.setViewport(viewport);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForSelector('.practice-options button', { visible: true });
        if (zhuyin) await page.click('#zhuyin-toggle');
        await injectQuestion(page, q5);
        const metrics = await readMetrics(page);
        await assertNoOverflow(page, metrics, minimumFontSize);
        await (await page.$('.quiz-question-row')).screenshot({ path: `automation/output/grade3-week03-quiz-q5-${label}.png` });
        assert.deepEqual(errors, []);
        return metrics;
    } finally {
        await context.close();
    }
}

(async () => {
    const connection = await connectCdp({ cdpUrl: 'http://127.0.0.1:9232', targetUrl: url });
    try {
        const desktopNormal = await verifyQ5({
            connection,
            viewport: { width: 1366, height: 900 },
            label: 'desktop-normal',
            minimumFontSize: 21
        });
        const desktopZhuyin = await verifyQ5({
            connection,
            viewport: { width: 1366, height: 900 },
            zhuyin: true,
            label: 'desktop-zhuyin',
            minimumFontSize: 19
        });
        const mobileZhuyin = await verifyQ5({
            connection,
            viewport: { width: 390, height: 844 },
            zhuyin: true,
            label: 'mobile-zhuyin',
            minimumFontSize: 19
        });
        console.log(JSON.stringify({ desktopNormal, desktopZhuyin, mobileZhuyin }, null, 2));
    } finally {
        connection.disconnect();
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
