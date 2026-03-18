import { supabase } from "./auth.js";

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

export async function applyWeekVisibilityToCards(grade, root = document) {
    const weekCards = collectWeekCards(root);
    if (!weekCards.length) return;

    const rows = await loadWeekVisibility(grade);
    if (!rows) return;

    applyWeekVisibilityRows(weekCards, rows);
}
