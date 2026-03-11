// 三年級獨立動態導覽列元件 (極簡導航版)
(function() {
    // 🌟 1. 設定目前有開放的週次 (三年級目前為第3、4週)
    const activeWeeks = [3, 4, 5];

    // 2. 取得目前的網址與檔名
    const currentPath = window.location.pathname;
    const currentFile = currentPath.split("/").pop() || "index.html";

    // 3. 從檔名中萃取出目前的週次數字 (例如 week03.html -> 3)
    const weekMatch = currentFile.match(/week(\d+)/) || currentFile.match(/w(\d+)/);
    const currentWeek = weekMatch ? parseInt(weekMatch[1], 10) : null;

    // 4. 建立 HTML 骨架 (採用三年級專屬的 Cyan 青色風格與火箭圖示)
    let navHTML = `
    <nav class="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-cyan-200 shadow-sm">
        <div class="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
            <div class="font-black text-gray-800 flex items-center text-lg tracking-wide">
                <i class="fa-solid fa-rocket text-cyan-600 mr-2"></i> 三年級資訊課
            </div>
            <div class="flex space-x-2 overflow-x-auto pb-1 md:pb-0 items-center">
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
    }

    // 6. 收尾並輸出 HTML 到網頁上
    navHTML += `
            </div>
        </div>
    </nav>
    `;

    document.write(navHTML);
})();
