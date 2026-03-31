export function extractWeekCodeFromHref(href) {
    const match = (href || "").match(/week(\d+)(?:\.html)?(?:[/?#]|$)/i);
    return match ? String(match[1]).padStart(2, "0") : null;
}

export function collectWeekCards(root = document) {
    return Array.from(root.querySelectorAll('a[href*="week"]')).filter((card) => {
        return extractWeekCodeFromHref(card.getAttribute("href")) !== null;
    });
}

export async function loadWeekVisibility(grade) {
    let supabase;
    try {
        ({ supabase } = await import("./auth.js"));
    } catch (error) {
        console.warn(`${grade} week visibility auth bootstrap failed`, error);
        return null;
    }

    const { data, error } = await supabase
        .from("week_visibility")
        .select("week_code,is_visible")
        .eq("grade", grade);

    if (error) {
        console.error(`${grade} week visibility load failed`, error);
        return null;
    }

    return data || [];
}

export function applyWeekVisibilityRows(weekCards, rows) {
    const hiddenWeeks = new Set(
        (rows || [])
            .filter((row) => row.is_visible === false)
            .map((row) => String(row.week_code).padStart(2, "0"))
    );

    weekCards.forEach((card) => {
        const weekCode = extractWeekCodeFromHref(card.getAttribute("href"));
        if (!weekCode) return;
        card.classList.toggle("hidden", hiddenWeeks.has(weekCode));
    });
}

export function prioritizeLatestVisibleWeekCard(weekCards) {
    const visibleCards = (weekCards || []).filter((card) => !card.classList.contains("hidden"));
    if (visibleCards.length < 2) return;

    const latestCard = visibleCards.find((card) => card.dataset.latestWeek === "true")
        || visibleCards.find((card) => card.textContent.includes("本週最新"));
    if (!latestCard) return;

    const firstVisibleCard = visibleCards[0];
    if (latestCard === firstVisibleCard) return;

    const container = firstVisibleCard.parentElement;
    if (!container || latestCard.parentElement !== container) return;

    container.insertBefore(latestCard, firstVisibleCard);
}

export async function applyWeekVisibilityToCards(grade, root = document) {
    const weekCards = collectWeekCards(root);
    if (!weekCards.length) return;

    // Prioritize the latest visible card immediately so local preview and
    // slow network responses do not block the homepage ordering.
    prioritizeLatestVisibleWeekCard(weekCards);

    const rows = await loadWeekVisibility(grade);
    if (rows) {
        applyWeekVisibilityRows(weekCards, rows);
    }

    prioritizeLatestVisibleWeekCard(weekCards);
}
