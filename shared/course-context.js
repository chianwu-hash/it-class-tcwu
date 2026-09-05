export const DEFAULT_COURSE_ID = "grade3-114-2";

export const COURSE_DEFINITIONS = [
    {
        id: "grade3-114-2",
        grade: "grade3",
        schoolYear: "114",
        semester: "2",
        label: "三年級 114 下",
        homeHref: "/grade3/index.html"
    },
    {
        id: "grade3-115-1",
        grade: "grade3",
        schoolYear: "115",
        semester: "1",
        label: "三年級 115 上",
        homeHref: "/grade3/115-1/index.html"
    },
    {
        id: "grade6-114-2",
        grade: "grade6",
        schoolYear: "114",
        semester: "2",
        label: "六年級 114 下",
        homeHref: "/grade6/index.html"
    },
    {
        id: "grade6-115-1",
        grade: "grade6",
        schoolYear: "115",
        semester: "1",
        label: "六年級 115 上",
        homeHref: "/grade6/115-1/index.html"
    }
];

const COURSE_BY_ID = new Map(COURSE_DEFINITIONS.map((course) => [course.id, course]));

export function normalizeCourseId(value, fallback = DEFAULT_COURSE_ID) {
    const normalized = String(value || "").trim().toLowerCase();
    return COURSE_BY_ID.has(normalized) ? normalized : fallback;
}

export function getCourseDefinition(courseId, fallback = DEFAULT_COURSE_ID) {
    return COURSE_BY_ID.get(normalizeCourseId(courseId, fallback)) || COURSE_BY_ID.get(fallback);
}

export function inferCourseIdFromPath(pathname = globalThis.location?.pathname || "") {
    const normalizedPath = String(pathname || "").replaceAll("\\", "/").toLowerCase();
    const nestedMatch = normalizedPath.match(/\/(grade[36])\/(\d{3}-[12])(?:\/|$)/);
    if (nestedMatch) {
        return normalizeCourseId(`${nestedMatch[1]}-${nestedMatch[2]}`);
    }

    if (normalizedPath.includes("/grade6/")) {
        return "grade6-114-2";
    }

    if (normalizedPath.includes("/grade3/")) {
        return "grade3-114-2";
    }

    return DEFAULT_COURSE_ID;
}

export function getCurrentCourseId(explicitCourseId = null) {
    return normalizeCourseId(explicitCourseId || inferCourseIdFromPath());
}
