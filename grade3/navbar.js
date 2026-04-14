(function () {
    const currentScript = document.currentScript;

    if (!window.__buildCourseNavbarHtml) {
        const request = new XMLHttpRequest();
        request.open("GET", "../shared/course-navbar.js", false);
        request.send(null);
        if (request.status >= 200 && request.status < 300) {
            window.eval(request.responseText);
        } else {
            throw new Error(`Failed to load shared course navbar: ${request.status}`);
        }
    }

    const navHTML = window.__buildCourseNavbarHtml({
        activeWeeks: [3, 4, 5, 6, 7, 8, 9, 10],
        gradeLabel: "三年級資訊課",
        titleIconClass: "fa-solid fa-rocket text-cyan-600",
        titleClassName: "font-black text-gray-800 flex items-center text-lg tracking-wide whitespace-nowrap",
        navClassName: "bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-cyan-200 shadow-sm",
        containerClassName: "max-w-5xl mx-auto px-6 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3",
        linkClassName: "px-3 py-1.5 text-sm font-bold text-gray-600 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition whitespace-nowrap",
        currentWeekClassName: "px-3 py-1.5 text-sm font-bold bg-cyan-100 text-cyan-800 rounded-lg shadow-sm whitespace-nowrap cursor-default",
        separatorClassName: "text-gray-300 mx-1",
        showAuthBarOnWeekPages: true,
        showAuthBarOnHomePages: false,
        authBarHtml: `
                    <span class="text-gray-300 mx-1 hidden md:inline">|</span>
                    <div id="nav-auth-bar" class="flex flex-nowrap items-center gap-2 lg:ml-2 shrink-0">
                        <div id="auth-status" class="max-w-[140px] md:max-w-[170px] px-3 py-1.5 rounded-full bg-cyan-50 text-slate-700 text-sm font-bold border border-cyan-100 truncate" title="登入狀態">未登入</div>
                        <a id="admin-btn" href="/admin-progress.html" class="hidden px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 font-black transition whitespace-nowrap" title="教師後台" aria-label="教師後台">
                            <i class="fa-solid fa-user-shield md:mr-1"></i><span class="hidden md:inline">後台</span>
                        </a>
                        <button id="login-btn" class="w-10 h-10 rounded-full border-2 border-cyan-300 text-cyan-700 hover:bg-cyan-50 font-black transition flex items-center justify-center shrink-0" title="Google 登入" aria-label="Google 登入">
                            <i class="fa-brands fa-google text-lg"></i>
                        </button>
                        <button id="reset-progress-btn" class="hidden w-10 h-10 rounded-full bg-amber-500 text-white hover:bg-amber-400 font-black transition flex items-center justify-center shrink-0" title="重新闖關" aria-label="重新闖關">
                            <i class="fa-solid fa-rotate-left text-lg"></i>
                        </button>
                        <button id="logout-btn" class="hidden w-10 h-10 rounded-full bg-slate-700 text-white hover:bg-slate-600 font-black transition flex items-center justify-center shrink-0" title="登出" aria-label="登出">
                            <i class="fa-solid fa-right-from-bracket text-lg"></i>
                        </button>
                    </div>
        `
    });

    currentScript.insertAdjacentHTML("beforebegin", navHTML);
    currentScript.remove();
})();
