(function () {
    function parseCurrentWeek(pathname) {
        const currentFile = pathname.split("/").pop() || "index.html";
        const weekMatch = currentFile.match(/(?:week|w)(\d+)/);
        return weekMatch ? parseInt(weekMatch[1], 10) : null;
    }

    function buildWeekLink(week) {
        const weekStr = week < 10 ? `0${week}` : String(week);
        return `week${weekStr}.html`;
    }

    function buildCourseNavbarHtml(config) {
        const {
            activeWeeks,
            gradeLabel,
            titleIconClass,
            titleClassName,
            navClassName,
            containerClassName,
            linkClassName,
            currentWeekClassName,
            separatorClassName,
            showAuthBarOnWeekPages = false,
            authBarHtml = "",
            currentPath = window.location.pathname
        } = config;

        const currentWeek = parseCurrentWeek(currentPath);
        const currentIndex = currentWeek !== null ? activeWeeks.indexOf(currentWeek) : -1;

        let navHTML = `
        <nav class="${navClassName}">
            <div class="${containerClassName}">
                <div class="${titleClassName}">
                    <i class="${titleIconClass} mr-2"></i> ${gradeLabel}
                </div>
                <div class="flex flex-wrap lg:flex-nowrap lg:justify-end gap-2 items-center">
                    <a href="index.html" class="${linkClassName}">
                        <i class="fa-solid fa-house mr-1"></i> 課程首頁
                    </a>
        `;

        if (currentWeek !== null) {
            navHTML += `<span class="${separatorClassName}">|</span>`;

            if (currentIndex > 0) {
                const prevWeek = activeWeeks[currentIndex - 1];
                navHTML += `
                    <a href="${buildWeekLink(prevWeek)}" class="${linkClassName}">
                        <i class="fa-solid fa-arrow-left mr-1"></i> 第 ${prevWeek} 週
                    </a>`;
            }

            navHTML += `
                    <span class="${currentWeekClassName}">
                        <i class="fa-solid fa-star text-yellow-500 mr-1"></i> 目前: 第 ${currentWeek} 週
                    </span>`;

            if (currentIndex !== -1 && currentIndex < activeWeeks.length - 1) {
                const nextWeek = activeWeeks[currentIndex + 1];
                navHTML += `
                    <a href="${buildWeekLink(nextWeek)}" class="${linkClassName}">
                        第 ${nextWeek} 週 <i class="fa-solid fa-arrow-right ml-1"></i>
                    </a>`;
            }
        } else {
            activeWeeks.forEach((week) => {
                navHTML += `
                    <a href="${buildWeekLink(week)}" class="${linkClassName}">
                        第 ${week} 週
                    </a>`;
            });
        }

        if (showAuthBarOnWeekPages && currentWeek !== null) {
            navHTML += authBarHtml;
        }

        navHTML += `
                </div>
            </div>
        </nav>
        `;

        return navHTML;
    }

    window.__buildCourseNavbarHtml = buildCourseNavbarHtml;
})();
