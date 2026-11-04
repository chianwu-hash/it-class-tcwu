(function () {
    const currentScript = document.currentScript;
    const quizMode = currentScript.dataset.quiz === 'true';
    const quizPage = /\/quiz\.html$/.test(location.pathname);

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

    // Compact link: icon + one character; full name stays as tooltip and for screen readers.
    const iconLabel = (iconClass, short, full) =>
        `<span title="${full}" class="inline-flex items-center gap-1"><i class="${iconClass}" aria-hidden="true"></i><span aria-hidden="true">${short}</span><span class="sr-only">${full}</span></span>`;

    const navConfig = {
        activeWeeks: quizMode ? [] : [1, 2, 3, 4, 5, 6, 7, 8, 9],
        gradeLabel: quizMode ? "考前練功房｜三年級" : "三年級資訊課｜115-1",
        titleIconClass: "fa-solid fa-rocket text-cyan-600",
        titleClassName: "font-black text-gray-800 flex items-center text-lg tracking-wide whitespace-nowrap",
        navClassName: "bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-cyan-200 shadow-sm",
        containerClassName: "max-w-screen-2xl mx-auto px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3",
        linkClassName: "px-3 py-1.5 text-sm font-bold text-gray-600 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition whitespace-nowrap",
        currentWeekClassName: "px-3 py-1.5 text-sm font-bold bg-cyan-100 text-cyan-800 rounded-lg shadow-sm whitespace-nowrap cursor-default",
        separatorClassName: "text-gray-300 mx-1",
        homeLabel: quizMode ? (quizPage ? '← 回上頁' : '單元選卷') : iconLabel('fa-solid fa-house', '首', '課程首頁'),
        homeHref: quizMode ? 'quiz-library.html' : 'index.html',
        // Google 身分及正式成果由受控接回 RPC 核對。
        extraLinks: quizMode ? [
            { href: '/my-tree.html?course=grade3-115-1', label: '努力樹', iconClass: 'fa-solid fa-tree' },
            { href: 'index.html', label: '課程首頁' }
        ] : [
            { href: 'quiz-library.html', label: iconLabel('fa-solid fa-dumbbell', '練功', '考前練功房') },
            { href: 'typing-foundation.html', label: iconLabel('fa-solid fa-keyboard', '英', '英打基礎') },
            { href: 'zhuyin-foundation.html', label: iconLabel('fa-solid fa-keyboard', '中', '中打基礎') },
            { href: '/my-tree.html?course=grade3-115-1', label: iconLabel('fa-solid fa-tree', '樹', '我的努力樹') }
        ],
        showAuthBarOnWeekPages: !/week01\.html$/.test(location.pathname),
        showAuthBarOnHomePages: true,
        authBarHtml: `
            <div id="nav-auth-bar" class="flex shrink-0 items-center gap-2">
                <span id="auth-status" class="text-sm font-bold tracking-wide text-cyan-900 bg-cyan-50 border border-cyan-200 rounded-full px-3 py-1.5 whitespace-nowrap truncate max-w-[180px]" style="font-family: 'Noto Sans TC', 'Microsoft JhengHei', sans-serif; font-variant-numeric: tabular-nums;">未登入</span>
                <a id="admin-btn" href="/admin-progress.html?course=grade3-115-1" class="hidden text-sm" aria-label="教師後台">後台</a>
                <button id="login-btn" class="w-10 h-10 rounded-full border-2 border-cyan-300" title="Google 登入" aria-label="Google 登入"><i class="fa-brands fa-google"></i></button>
                <button id="reset-progress-btn" class="hidden w-10 h-10 rounded-full bg-amber-500" title="重新闖關" aria-label="重新闖關"><i class="fa-solid fa-rotate-left"></i></button>
                <button id="logout-btn" class="hidden w-10 h-10 rounded-full bg-slate-700 text-white" title="登出" aria-label="登出"><i class="fa-solid fa-right-from-bracket"></i></button>
            </div>`
    };

    const navHTML = window.__buildCourseNavbarHtml(navConfig);
    currentScript.insertAdjacentHTML("beforebegin", navHTML);
    currentScript.remove();
    // Quiz pages pass the roster label from their own RPC; no extra enrollment request here.
    if (quizMode) import('../../shared/grade6-nav-identity.js?v=20261030-identity-sync')
        .then(({ initGrade6NavIdentity }) => initGrade6NavIdentity({ expanded: true, provided: true }))
        .catch(error => console.warn('練功房導覽身分暫時無法讀取', error));
    if (quizMode) return;

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
