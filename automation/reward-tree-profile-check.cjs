const assert = require("node:assert/strict");
const { connectCdp } = require("D:/projects/cdp-tools/packages/cdp-safe-client");

const origin = "http://localhost:3000";
const pageUrl = `${origin}/my-tree.html?course=grade6-115-1&returnTo=%2Fgrade6%2F115-1%2Fweek03.html`;

const mockAuthModule = `
export const SUPABASE_URL = "https://reward-tree-profile-test.invalid";
export const SUPABASE_ANON_KEY = "test";
export const AUTH_STORAGE_KEY = "test-only";
const session = {
    user: { id: "reward-tree-profile-user", email: "student@example.invalid" },
    access_token: "fake-test-token"
};
export const getStoredAccessToken = () => session.access_token;
export const resolveSession = async () => session;
export const signInWithGoogle = () => {};
export const signOutAndReload = async () => {};
export const supabase = {
    from() {
        const query = {
            select() { return query; },
            eq() { return query; },
            then(resolve) { resolve({ data: [], error: null }); }
        };
        return query;
    },
    async rpc(name, args) {
        window.__enrollmentRpc = { name, args };
        if (name !== "get_my_student_enrollment") return { data: [], error: null };
        return {
            data: [{
                school_year: 115,
                email: "student@example.invalid",
                class_code: "603",
                seat_no: 3,
                display_name: "劉秀秀",
                student_code: "60303"
            }],
            error: null
        };
    }
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
            if (url.hostname === "reward-tree-profile-test.invalid") {
                const action = url.pathname.split("/").at(-1);
                const body = action === "homework_action"
                    ? JSON.stringify({ assignments: [], teacher: false, class_code: "603" })
                    : JSON.stringify({ periods: [], teacher: false });
                await request.respond({
                    status: 200,
                    headers: { "Access-Control-Allow-Origin": "*" },
                    contentType: "application/json",
                    body
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
        await page.waitForFunction(() => document.querySelector("#profile-title")?.textContent === "劉秀秀");
        assert.equal(await page.$eval("#profile-title", (el) => el.textContent), "劉秀秀");
        assert.equal(
            await page.$eval("#profile-meta", (el) => el.textContent),
            "603 班 03 號・student@example.invalid"
        );
        assert.deepEqual(await page.evaluate(() => window.__enrollmentRpc), {
            name: "get_my_student_enrollment",
            args: { p_school_year: 115 }
        });
        assert.equal(await page.$eval("#course-home-link", (el) => el.getAttribute("href")), "/grade6/115-1/index.html");
        assert.deepEqual(errors, []);
        process.stdout.write("PASS 努力樹只以登入者本人 RPC 顯示姓名、班級、座號與帳號\n");
    } finally {
        await page.close();
        connection.disconnect();
    }
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
