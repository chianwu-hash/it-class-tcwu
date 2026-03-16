// 三年級獨立動態導覽列元件 (極簡導航版)
(function() {
    // 🌟 1. 設定目前有開放的週次 (三年級目前為第3、4週)
    const activeWeeks = [3, 4, 5, 6];

    // 2. 取得目前的網址與檔名
    const currentPath = window.location.pathname;
    const currentFile = currentPath.split("/").pop() || "index.html";

    // 3. 從檔名中萃取出目前的週次數字 (例如 week03.html -> 3)
    const weekMatch = currentFile.match(/week(\d+)/) || currentFile.match(/w(\d+)/);
    const currentWeek = weekMatch ? parseInt(weekMatch[1], 10) : null;

    // 4. 建立 HTML 骨架 (採用三年級專屬的 Cyan 青色風格與火箭圖示)
    let navHTML = `
    <nav class="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-cyan-200 shadow-sm">
        <div class="max-w-5xl mx-auto px-6 py-3">
            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div class="font-black text-gray-800 flex items-center text-lg tracking-wide whitespace-nowrap">
                    <i class="fa-solid fa-rocket text-cyan-600 mr-2"></i> 三年級資訊課
                </div>
                <div class="flex flex-wrap lg:flex-nowrap lg:justify-end gap-2 items-center">
                    <!-- 永遠顯示的「課程首頁」按鈕 -->
                    <a href="index.html" class="px-3 py-1.5 text-sm font-bold text-gray-600 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition whitespace-nowrap">
                        <i class="fa-solid fa-house mr-1"></i> 課程首頁
                    </a>
    `;

    // 5. 如果目前是在某個「週次」頁面，才顯示上下週的按鈕
    if (currentWeek !== null) {
        const currentIndex = activeWeeks.indexOf(currentWeek);

        // 加入視覺分隔線
        navHTML += `<span class="text-gray-300 mx-1">|</span>`;

        // ⬅️ 上一週按鈕
        if (currentIndex > 0) {
            const prevWeek = activeWeeks[currentIndex - 1];
            const prevWeekStr = prevWeek < 10 ? '0' + prevWeek : prevWeek;
            navHTML += `
                <a href="week${prevWeekStr}.html" class="px-3 py-1.5 text-sm font-bold text-gray-500 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition whitespace-nowrap">
                    <i class="fa-solid fa-arrow-left mr-1"></i> 第 ${prevWeek} 週
                </a>`;
        }

        // ✨ 目前週次 (無法點擊，使用醒目的青色背景)
        navHTML += `
                <span class="px-3 py-1.5 text-sm font-bold bg-cyan-100 text-cyan-800 rounded-lg shadow-sm whitespace-nowrap cursor-default">
                    <i class="fa-solid fa-star text-yellow-500 mr-1"></i> 目前: 第 ${currentWeek} 週
                </span>`;

        // ➡️ 下一週按鈕
        if (currentIndex !== -1 && currentIndex < activeWeeks.length - 1) {
            const nextWeek = activeWeeks[currentIndex + 1];
            const nextWeekStr = nextWeek < 10 ? '0' + nextWeek : nextWeek;
            navHTML += `
                <a href="week${nextWeekStr}.html" class="px-3 py-1.5 text-sm font-bold text-gray-500 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition whitespace-nowrap">
                    第 ${nextWeek} 週 <i class="fa-solid fa-arrow-right ml-1"></i>
                </a>`;
        }
    } else {
        activeWeeks.forEach((week) => {
            const weekStr = week < 10 ? '0' + week : week;
            navHTML += `
                <a href="week${weekStr}.html" class="px-3 py-1.5 text-sm font-bold text-gray-600 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition whitespace-nowrap">
                    第 ${week} 週
                </a>`;
        });
    }

    if (currentWeek !== null) {
        navHTML += `
                    <span class="text-gray-300 mx-1 hidden md:inline">|</span>
                    <div id="nav-auth-bar" class="flex flex-wrap items-center gap-2 lg:ml-2">
                        <div id="auth-status" class="max-w-[180px] md:max-w-[220px] px-3 py-1.5 rounded-full bg-cyan-50 text-slate-700 text-sm font-bold border border-cyan-100 truncate" title="登入狀態">未登入</div>
                        <a id="admin-btn" href="/admin-progress.html" class="hidden px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 font-black transition whitespace-nowrap" title="教師後台" aria-label="教師後台">
                            <i class="fa-solid fa-user-shield mr-1"></i> 後台
                        </a>
                        <button id="login-btn" class="w-11 h-11 rounded-full border-2 border-cyan-300 text-cyan-700 hover:bg-cyan-50 font-black transition flex items-center justify-center" title="Google 登入" aria-label="Google 登入">
                            <i class="fa-brands fa-google text-lg"></i>
                        </button>
                        <button id="reset-progress-btn" class="hidden w-11 h-11 rounded-full bg-amber-500 text-white hover:bg-amber-400 font-black transition flex items-center justify-center" title="重新闖關" aria-label="重新闖關">
                            <i class="fa-solid fa-rotate-left text-lg"></i>
                        </button>
                        <button id="logout-btn" class="hidden w-11 h-11 rounded-full bg-slate-700 text-white hover:bg-slate-600 font-black transition flex items-center justify-center" title="登出" aria-label="登出">
                            <i class="fa-solid fa-right-from-bracket text-lg"></i>
                        </button>
                    </div>
        `;
    }

    navHTML += `
            </div>
        </div>
    </nav>
    `;

    document.write(navHTML);
})();
