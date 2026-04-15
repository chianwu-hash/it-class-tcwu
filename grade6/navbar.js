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
        activeWeeks: [3, 4, 5, 6, 7, 8, 10],
        gradeLabel: "六年級資訊課",
        titleIconClass: "fa-solid fa-graduation-cap text-purple-800",
        titleClassName: "font-black text-purple-800 flex items-center text-lg tracking-wide",
        navClassName: "bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-purple-200 shadow-sm",
        containerClassName: "max-w-6xl mx-auto px-6 py-3 flex items-center justify-between",
        linkClassName: "px-3 py-1.5 text-sm font-bold text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition whitespace-nowrap",
        currentWeekClassName: "px-3 py-1.5 text-sm font-bold bg-purple-100 text-purple-800 rounded-lg shadow-sm whitespace-nowrap cursor-default",
        separatorClassName: "text-gray-300 mx-1",
        showAuthBarOnHomePages: false
    });

    currentScript.insertAdjacentHTML("beforebegin", navHTML);
    currentScript.remove();
})();
