(function () {
    const currentScript = document.currentScript;

    if (!window.__buildCourseNavbarHtml) {
        const request = new XMLHttpRequest();
        request.open("GET", "../../shared/course-navbar.js", false);
        request.send(null);
        if (request.status >= 200 && request.status < 300) {
            window.eval(request.responseText);
        } else {
            throw new Error(`Failed to load shared course navbar: ${request.status}`);
        }
    }

    const navConfig = {
        activeWeeks: [1, 2],
        gradeLabel: "三年級資訊課｜115-1",
        titleIconClass: "fa-solid fa-rocket text-cyan-600",
        titleClassName: "font-black text-gray-800 flex items-center text-lg tracking-wide whitespace-nowrap",
        navClassName: "bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-cyan-200 shadow-sm",
        containerClassName: "max-w-5xl mx-auto px-6 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3",
        linkClassName: "px-3 py-1.5 text-sm font-bold text-gray-600 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition whitespace-nowrap",
        currentWeekClassName: "px-3 py-1.5 text-sm font-bold bg-cyan-100 text-cyan-800 rounded-lg shadow-sm whitespace-nowrap cursor-default",
        separatorClassName: "text-gray-300 mx-1",
        extraLinks: [
            {
                href: "/my-tree.html?course=grade3-115-1",
                iconClass: "fa-solid fa-seedling",
                label: "努力樹"
            }
        ],
        showAuthBarOnWeekPages: !/week01\.html$/.test(location.pathname),
        showAuthBarOnHomePages: false,
        authBarHtml: `
            <div id="nav-auth-bar" class="flex items-center gap-2">
                <span id="auth-status" class="text-sm truncate max-w-[180px]">未登入</span>
                <a id="admin-btn" href="/admin-progress.html?course=grade3-115-1" class="hidden text-sm" aria-label="教師後台">後台</a>
                <button id="login-btn" class="w-10 h-10 rounded-full border-2 border-cyan-300" title="Google 登入" aria-label="Google 登入"><i class="fa-brands fa-google"></i></button>
                <button id="reset-progress-btn" class="hidden w-10 h-10 rounded-full bg-amber-500" title="重新闖關" aria-label="重新闖關"><i class="fa-solid fa-rotate-left"></i></button>
                <button id="logout-btn" class="hidden w-10 h-10 rounded-full bg-slate-700 text-white" title="登出" aria-label="登出"><i class="fa-solid fa-right-from-bracket"></i></button>
            </div>`
    };

    const navHTML = window.__buildCourseNavbarHtml(navConfig);
    currentScript.insertAdjacentHTML("beforebegin", navHTML);
    currentScript.remove();

    // Match the semester home cards; never apply the previous semester's visibility.
    import('../../shared/week-visibility.js').then(async ({ loadWeekVisibility }) => {
        const rows = await loadWeekVisibility('grade3', 'grade3-115-1');
        if (!rows) return;
        const hidden = new Set(rows.filter(row => row.is_visible === false).map(row => Number(row.week_code)));
        const current = Number(location.pathname.match(/week(\d+)/)?.[1]);
        const activeWeeks = navConfig.activeWeeks.filter(week => !hidden.has(week) || week === current);
        const nav = document.querySelector('body > nav');
        if (nav) nav.outerHTML = window.__buildCourseNavbarHtml({ ...navConfig, activeWeeks });
        window.dispatchEvent(new CustomEvent('course-navbar:rendered'));
    }).catch(error => console.warn('Semester navigation visibility unavailable', error));
})();
