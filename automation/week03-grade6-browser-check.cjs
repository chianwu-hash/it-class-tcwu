const assert = require("node:assert/strict");
const fs = require("node:fs");
const { connectCdp, safeScreenshot } = require("D:/projects/cdp-tools/packages/cdp-safe-client");

const origin = "http://localhost:3000";
const results = [];

async function run() {
    const connection = await connectCdp({
        cdpUrl: "http://127.0.0.1:9232",
        targetUrl: `${origin}/grade6/115-1/week03.html`
    });
    const page = await connection.browser.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    const failedLocalRequests = [];
    const badLocalResponses = [];

    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => {
        if (request.url().startsWith(origin)) {
            failedLocalRequests.push(`${request.url()}：${request.failure()?.errorText || "unknown"}`);
        }
    });
    page.on("response", (response) => {
        const url = response.url();
        if (url.startsWith(origin) && response.status() >= 400 && !url.endsWith("/favicon.ico")) {
            badLocalResponses.push(`${response.status()} ${url}`);
        }
    });

    const check = async (name, action) => {
        await action();
        results.push(name);
        process.stdout.write(`PASS ${name}\n`);
    };

    try {
        await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
        await page.goto(`${origin}/grade6/115-1/week03.html`, { waitUntil: "networkidle2", timeout: 30000 });

        await check("第 03 週頁面標題與主流程", async () => {
            assert.equal(await page.title(), "第 03 週｜閱讀分享與名牌完成");
            assert.equal(await page.$eval("h1", (el) => el.textContent.trim()), "閱讀長小葉，名牌做到好");
            assert.equal(await page.$$eval("header nav ol li", (items) => items.length), 4);
        });

        await check("共用 navbar 顯示前一週、目前週次與登入列", async () => {
            const navText = await page.$eval("body > nav", (el) => el.textContent);
            assert.match(navText, /第 2 週/);
            assert.match(navText, /目前:\s*第 3 週/);
            assert(await page.$('body > nav a[href="week02.html"]'));
            assert(await page.$("#nav-auth-bar"));
        });

        await check("閱讀、作業與努力樹入口符合共用契約", async () => {
            assert.equal(await page.$$eval('main a[href="homework.html#reading"]', (links) => links.length), 3);
            assert.equal(await page.$$eval('main a[href="homework.html"]', (links) => links.length), 2);
            assert.equal(await page.$$eval('main a[href^="/my-tree.html?course=grade6-115-1&returnTo="]', (links) => links.length), 2);
            assert.equal(await page.$$eval("form", (forms) => forms.length), 0);
            assert.equal(await page.$$eval('input[type="file"]', (inputs) => inputs.length), 0);
        });

        await check("10 分鐘閱讀計時器可開始與重設", async () => {
            assert.equal(await page.$eval("#reading-timer-display", (el) => el.textContent), "10:00");
            await page.$eval("#reading-timer-start", (button) => button.click());
            await new Promise((resolve) => setTimeout(resolve, 1150));
            assert.equal(await page.$eval("#reading-timer-display", (el) => el.textContent), "09:59");
            await page.$eval("#reading-timer-reset", (button) => button.click());
            assert.equal(await page.$eval("#reading-timer-display", (el) => el.textContent), "10:00");
        });

        await check("中英打五關與正式進度容器完成初始化", async () => {
            assert.equal(await page.$$eval("#typing-levels-container .level-card", (cards) => cards.length), 5);
            assert.equal(await page.$$eval("#typing-levels-container .level-card", (cards) => cards.filter((card) => card.getClientRects().length).length), 1);
            assert.equal(await page.$eval("#block-level1 .level-target", (el) => el.textContent.startsWith("I'm Ella.")), true);
            assert.equal(await page.$eval("#block-level5 .level-target", (el) => el.textContent.includes("名為「堅持」。")), true);
            assert(await page.$("#progress-status"));
            assert(await page.$("#reset-progress-btn"));
        });

        await check("快手三種選擇與電腦界線完整呈現", async () => {
            const text = await page.$eval("#fast-finisher", (el) => el.textContent.replace(/\s+/g, " "));
            assert.match(text, /讀得更深/);
            assert.match(text, /依指引教同學/);
            assert.match(text, /安靜休息/);
            assert.match(text, /學校電腦只做老師指定的事/);
            assert.match(text, /不能代打、代畫或代交/);
        });

        await check("努力樹顯示明確返回目的地且重新整理後保留", async () => {
            await page.goto(
                `${origin}/my-tree.html?course=grade6-115-1&returnTo=%2Fgrade6%2F115-1%2Fweek03.html`,
                { waitUntil: "networkidle2", timeout: 30000 }
            );
            assert.equal(await page.$eval("#back-page-btn", (el) => el.textContent.trim()), "回第 03 週");
            assert.equal(await page.$eval("#back-page-btn", (el) => el.getAttribute("href")), "/grade6/115-1/week03.html");
            assert.equal(await page.$eval("#back-page-btn", (el) => Boolean(el.getClientRects().length)), true);
            assert.equal(await page.$eval("#course-home-link", (el) => el.getAttribute("href")), "/grade6/115-1/index.html");
            await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
            assert.equal(await page.$eval("#back-page-btn", (el) => el.textContent.trim()), "回第 03 週");
            await Promise.all([
                page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
                page.click("#back-page-btn")
            ]);
            assert.equal(new URL(page.url()).pathname, "/grade6/115-1/week03.html");
        });

        await safeScreenshot(page, {
            path: "automation/output/grade6-week03-page.png",
            fullPage: true
        });

        await check("手機版沒有橫向溢出", async () => {
            await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
            await new Promise((resolve) => setTimeout(resolve, 350));
            const sizes = await page.evaluate(() => ({
                scrollWidth: document.documentElement.scrollWidth,
                innerWidth: window.innerWidth
            }));
            assert(sizes.scrollWidth <= sizes.innerWidth, JSON.stringify(sizes));
        });

        await safeScreenshot(page, {
            path: "automation/output/grade6-week03-mobile.png",
            fullPage: true
        });

        await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
        await page.goto(`${origin}/grade6/115-1/index.html`, { waitUntil: "networkidle2", timeout: 30000 });

        await check("115-1 首頁以 Week 03 為最新週卡", async () => {
            assert(await page.$('a[href="week03.html"][data-latest-week="true"]'));
            assert.equal(await page.$$eval(".week-card-grid [data-latest-week='true']", (cards) => cards.length), 1);
            assert.equal(await page.$eval('main a[href="week03.html"]', (el) => Boolean(el.getClientRects().length)), true);
            const latestText = await page.$eval('main a[href="week03.html"]', (el) => el.textContent);
            assert.match(latestText, /本週/);
        });

        assert.deepEqual(pageErrors, [], `Page errors: ${pageErrors.join(" | ")}`);
        assert.deepEqual(failedLocalRequests, [], `Local request failures: ${failedLocalRequests.join(" | ")}`);
        assert.deepEqual(badLocalResponses, [], `Bad local responses: ${badLocalResponses.join(" | ")}`);

        const ignoredConsolePatterns = [
            /cdn\.tailwindcss\.com should not be used in production/i,
            /Failed to load resource: the server responded with a status of 404 \(File not found\)/i
        ];
        const relevantConsoleErrors = consoleErrors.filter((message) => (
            !ignoredConsolePatterns.some((pattern) => pattern.test(message))
        ));
        assert.deepEqual(relevantConsoleErrors, [], `Console errors: ${relevantConsoleErrors.join(" | ")}`);

        fs.writeFileSync(
            "automation/output/grade6-week03-browser-results.json",
            JSON.stringify({ results, pageErrors, consoleErrors, failedLocalRequests, badLocalResponses }, null, 2),
            "utf8"
        );
    } finally {
        await page.close();
        connection.disconnect();
    }
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
