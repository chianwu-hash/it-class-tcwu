const assert = require("node:assert/strict");
const { connectCdp } = require("D:/projects/cdp-tools/packages/cdp-safe-client");

const origin = "http://localhost:3000";
const pageUrl = `${origin}/grade6/115-1/week03.html`;
const savedRows = [];

const mockAuthModule = `
export const SUPABASE_URL = "https://week03-grade6-test.invalid";
export const SUPABASE_ANON_KEY = "test";
export const AUTH_STORAGE_KEY = "test-only";
let session = null;
const callbacks = [];
export const isTeacher = () => false;
export const getStoredAccessToken = () => session?.access_token || null;
export const getSession = async () => ({ session });
export const resolveSession = async () => session;
export const beginCentralizedLogin = () => { window.__oauthTriggered = true; };
export const signOutAndReload = async () => {
    session = null;
    callbacks.forEach((callback) => callback("SIGNED_OUT", null));
};
export const supabase = {
    auth: {
        onAuthStateChange(callback) {
            callbacks.push(callback);
            return { data: { subscription: { unsubscribe() {} } } };
        }
    },
    from() {
        const filters = {};
        const query = {
            select() { return query; },
            eq(key, value) { filters[key] = value; return query; },
            delete() { query.deleting = true; return query; },
            maybeSingle() { return query; },
            then(resolve, reject) {
                const url = new URL(SUPABASE_URL + "/rest/v1/student_progress");
                Object.entries(filters).forEach(([key, value]) => url.searchParams.set(key, "eq." + value));
                fetch(url, { method: query.deleting ? "DELETE" : "GET" })
                    .then(async (response) => ({ data: (await response.json())[0] || null, error: response.ok ? null : { message: "test error" } }))
                    .then(resolve, reject);
            }
        };
        return query;
    },
    rpc: async () => ({ data: [], error: null })
};
window.__testLogin = () => {
    session = {
        user: { id: "grade6-week03-test-user", email: "student@example.invalid" },
        access_token: "fake-test-token"
    };
    callbacks.forEach((callback) => callback("SIGNED_IN", session));
};
`;

async function run() {
    const connection = await connectCdp({ cdpUrl: "http://127.0.0.1:9232", targetUrl: pageUrl });
    const page = await connection.browser.newPage();
    const errors = [];

    page.on("pageerror", (error) => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on("request", async (request) => {
        try {
            const url = new URL(request.url());
            if (url.origin === origin && url.pathname === "/shared/auth.js") {
                await request.respond({ status: 200, contentType: "text/javascript", body: mockAuthModule });
                return;
            }
            if (url.hostname === "week03-grade6-test.invalid") {
                if (request.method() === "OPTIONS") {
                    await request.respond({
                        status: 204,
                        headers: {
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Headers": "authorization,apikey,content-type,prefer",
                            "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS"
                        }
                    });
                    return;
                }
                if (request.method() === "POST") {
                    savedRows.push(JSON.parse(request.postData()));
                    await request.respond({ status: 201, headers: { "Access-Control-Allow-Origin": "*" }, body: "" });
                    return;
                }
                await request.respond({
                    status: 200,
                    headers: { "Access-Control-Allow-Origin": "*" },
                    contentType: "application/json",
                    body: "[]"
                });
                return;
            }
            await request.continue();
        } catch (error) {
            errors.push(`intercept: ${error.message}`);
            await request.abort().catch(() => {});
        }
    });

    try {
        await page.goto(pageUrl, { waitUntil: "networkidle2", timeout: 30000 });
        assert.equal(await page.$eval("#input-level1", (input) => input.disabled), true);
        assert.equal(await page.$$eval("#typing-levels-container .level-card", (cards) => cards.filter((card) => card.getClientRects().length).length), 1);
        process.stdout.write("PASS 未登入時中英打鎖定\n");

        await page.evaluate(() => window.__testLogin());
        await page.waitForFunction(() => !document.querySelector("#input-level1").disabled, { timeout: 10000 });
        assert.equal(await page.$eval("#block-level1 .level-check", (button) => button.disabled), false);
        process.stdout.write("PASS 假學生登入後第 1 關解鎖\n");

        const answer = await page.$eval("#block-level1 .level-target", (el) => el.textContent);
        await page.$eval("#input-level1", (input, value) => {
            input.value = value;
            input.dispatchEvent(new Event("input", { bubbles: true }));
        }, answer);
        await page.$eval("#block-level1 .level-check", (button) => button.click());
        await page.waitForFunction(() => document.querySelector("#input-level1").readOnly, { timeout: 10000 });

        assert(savedRows.length >= 1, "沒有攔截到 student_progress 寫入");
        const row = savedRows.at(-1);
        assert.equal(row.user_id, "grade6-week03-test-user");
        assert.equal(row.course_id, "grade6-115-1");
        assert.equal(row.week_code, "03");
        assert.equal(row.activity_key, "typing_task_5");
        assert.equal(row.current_level, 2);
        assert.equal(row.completed, false);
        assert.equal(await page.$eval("#block-level2", (block) => Boolean(block.getClientRects().length)), true);
        assert.equal(await page.$eval("#block-level3", (block) => Boolean(block.getClientRects().length)), false);
        process.stdout.write("PASS 第 1 關寫入隔離 student_progress，課程／週次／活動鍵正確\n");

        assert.deepEqual(errors, []);
    } finally {
        await page.close();
        connection.disconnect();
    }
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
