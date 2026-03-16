// 獨立出來的動態導覽列元件 (極簡導航版)
(function() {
    // 🌟 1. 設定目前有開放的週次 (未來新增第6週，只要在這裡加上 , 6 即可)
    const activeWeeks = [3, 4, 5, 6];

    // 2. 取得目前的網址與檔名
    const currentPath = window.location.pathname;
    const currentFile = currentPath.split("/").pop() || "index.html";

    // 3. 從檔名中萃取出目前的週次數字 (例如 week04.html -> 4)
    const weekMatch = currentFile.match(/week(\d+)/);
    const currentWeek = weekMatch ? parseInt(weekMatch[1], 10) : null;

    // 4. 建立 HTML 骨架
    let navHTML = `
    <nav class="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-purple-200 shadow-sm">
        <div class="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
            <div class="font-black text-purple-800 flex items-center text-lg tracking-wide">
                <i class="fa-solid fa-graduation-cap mr-2"></i> 六年級資訊課
            </div>
            <div class="flex space-x-2 overflow-x-auto pb-1 md:pb-0 items-center">
                <!-- 永遠顯示的「課程首頁」按鈕 -->
                <a href="index.html" class="px-3 py-1.5 text-sm font-bold text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition whitespace-nowrap">
                    <i class="fa-solid fa-house mr-1"></i> 課程首頁
                </a>
    `;

    // 5. 如果目前是在某個「週次」頁面，才顯示上下週的按鈕
    if (currentWeek !== null) {
        const currentIndex = activeWeeks.indexOf(currentWeek);

        // 加入視覺分隔線
        navHTML += `<span class="text-gray-300 mx-1">|</span>`;

        // ⬅️ 上一週按鈕 (如果目前不是陣列裡的第一堂課，就顯示上一週)
        if (currentIndex > 0) {
            const prevWeek = activeWeeks[currentIndex - 1];
            const prevWeekStr = prevWeek < 10 ? '0' + prevWeek : prevWeek;
            navHTML += `
                <a href="week${prevWeekStr}.html" class="px-3 py-1.5 text-sm font-bold text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition whitespace-nowrap">
                    <i class="fa-solid fa-arrow-left mr-1"></i> 第 ${prevWeek} 週
                </a>`;
        }

        // ✨ 目前週次 (無法點擊，使用醒目的紫色背景)
        navHTML += `
                <span class="px-3 py-1.5 text-sm font-bold bg-purple-100 text-purple-800 rounded-lg shadow-sm whitespace-nowrap cursor-default">
                    <i class="fa-solid fa-star text-yellow-500 mr-1"></i> 目前: 第 ${currentWeek} 週
                </span>`;

        // ➡️ 下一週按鈕 (如果目前不是陣列裡的最後一堂課，就顯示下一週)
        if (currentIndex !== -1 && currentIndex < activeWeeks.length - 1) {
            const nextWeek = activeWeeks[currentIndex + 1];
            const nextWeekStr = nextWeek < 10 ? '0' + nextWeek : nextWeek;
            navHTML += `
                <a href="week${nextWeekStr}.html" class="px-3 py-1.5 text-sm font-bold text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition whitespace-nowrap">
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