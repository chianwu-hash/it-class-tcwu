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
        activeWeeks: [1],
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
        showAuthBarOnWeekPages: false,
        showAuthBarOnHomePages: false
    };

    const navHTML = window.__buildCourseNavbarHtml(navConfig);
    currentScript.insertAdjacentHTML("beforebegin", navHTML);
    currentScript.remove();
})();
