import { initNavbarAuth } from '../../shared/navbar-auth.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, getStoredAccessToken } from '../../shared/auth.js';
import { getRewardTreeCourse, getActivityId } from '../../shared/reward-tree-config.js';
import { deriveRewardTreeModel } from '../../shared/reward-tree-model.js';

const courseId = 'grade6-115-1';
const activities = getRewardTreeCourse(courseId).activities.filter(a => a.rewardMode === 'boss');
const descriptions = {
    '05:typing_boss_zh_1': { title: '臺灣美食詩選', icon: '🍜', schoolYear: '115', publisher: '康軒', subject: '國語', lesson: '第4課', text: '〈鼎邊趖〉＋〈肉圓〉，共25行。兩首全部完成，開出1朵花。' },
    '05:typing_boss_en_1': { title: 'Seeing a Doctor', icon: '🩺', schoolYear: '115', publisher: '康軒', subject: '英語', lesson: 'Unit 2', text: '完整Reading分成9行，練習Joe的完整分享，完成開出1朵花。' }
};
const cards = new Map();
for (const activity of activities) {
    const info = descriptions[`${activity.weekCode}:${activity.activityKey}`] || { title: activity.label, icon: '👑', subject: '進階', text: '完整挑戰成功，開出1朵花。' };
    const card = document.createElement('article'); card.className = `garden-card${info.subject === '英語' ? ' english' : ''}`;
    // All markup is fixed; catalog text uses textContent below.
    card.innerHTML = '<div class="card-top"><div class="card-meta"><span class="card-icon" aria-hidden="true"></span><span class="card-week"></span></div><h3></h3></div><div class="card-body"><p class="card-description"></p><p class="card-state" aria-live="polite"></p><a class="challenge-link"></a></div>';
    card.querySelector('.card-icon').textContent = info.icon;
    card.querySelector('.card-week').textContent = `第${activity.weekCode}週加入・${info.subject}`;
    const textbook = document.createElement('p');
    textbook.className = 'card-textbook';
    textbook.textContent = `${info.schoolYear ? `${info.schoolYear}學年度` : '學年度待確認'}・${info.publisher || '版本待確認'}・${info.subject}・${info.lesson || '課次待確認'}`;
    card.querySelector('h3').before(textbook);
    card.querySelector('h3').textContent = info.title;
    card.querySelector('.card-description').textContent = info.text;
    card.querySelector('a').href = activity.pageHref;
    document.getElementById('garden-cards').append(card);
    cards.set(getActivityId(activity.weekCode, activity.activityKey, courseId), card);
}
const status = document.getElementById('garden-status');
const count = document.getElementById('flower-count');
const refresh = document.getElementById('refresh-garden');
let session = null, controller = null, revision = 0;
function setCard(card, text, action, bloomed = false) {
    card.querySelector('.card-state').textContent = text;
    card.querySelector('.card-state').classList.toggle('bloomed', bloomed);
    card.querySelector('a').textContent = action;
}
async function readRows(table, select, signal, currentSession) {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    const filters = { select, user_id: `eq.${currentSession.user.id}`, course_id: `eq.${courseId}`, activity_key: `in.(${activities.map(a => a.activityKey).join(',')})` };
    // Only existence is needed; never download the student's draft text.
    if (table === 'typing_drafts') filters.draft_text = 'neq.';
    for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
    const token = getStoredAccessToken() || currentSession.access_token;
    if (!token) throw new Error('登入已失效');
    const response = await fetch(url, { signal, headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('讀取失敗');
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('資料格式錯誤');
    return rows.filter(row => row.course_id === courseId);
}
async function loadGarden(nextSession = session) {
    session = nextSession; const currentSession = session;
    const run = ++revision; controller?.abort();
    count.textContent = currentSession?.user ? '正在數花朵……' : '登入後看看我的花';
    for (const card of cards.values()) setCard(card, currentSession?.user ? '正在讀取紀錄……' : '🔒 登入後顯示我的紀錄', '看看挑戰 →');
    refresh.disabled = !currentSession?.user;
    if (!currentSession?.user) { status.textContent = '請從上方登入學校Google帳號，查看自己的草稿與花朵。'; return; }
    status.textContent = '正在整理你的花園……'; refresh.disabled = true;
    controller = new AbortController(); const requestController = controller;
    const timeout = setTimeout(() => requestController.abort(), 10000);
    const results = await Promise.allSettled([
        readRows('student_progress', 'course_id,week_code,activity_key,completed,current_level', requestController.signal, currentSession),
        readRows('typing_drafts', 'course_id,week_code,activity_key,level_id', requestController.signal, currentSession)
    ]);
    clearTimeout(timeout); if (run !== revision) return;
    const [progress, drafts] = results;
    const model = progress.status === 'fulfilled' ? deriveRewardTreeModel(progress.value, activities) : null;
    const flowers = new Set((model?.rewards || []).filter(r => r.kind === 'flower').map(r => getActivityId(r.weekCode, r.activityKey, r.courseId)));
    const saved = new Set((drafts.status === 'fulfilled' ? drafts.value : []).map(r => getActivityId(r.week_code, r.activity_key, r.course_id)));
    count.textContent = model ? `已開出 ${flowers.size} 朵花` : '花朵暫時讀取不到';
    for (const [key, card] of cards) {
        if (flowers.has(key)) setCard(card, '🌸 已開花・已取得1朵花', '回顧挑戰 →', true);
        else if (!model) setCard(card, '☁️ 完成紀錄暫時讀取不到', '前往挑戰頁查看 →');
        else if (saved.has(key)) setCard(card, '💾 已有草稿・回去接著打', '繼續挑戰 →');
        else if (drafts.status === 'rejected') setCard(card, '☁️ 草稿暫時讀取不到', '前往挑戰頁查看 →');
        else setCard(card, '🌱 尚未挑戰・等你來種花', '開始挑戰 →');
    }
    status.textContent = results.some(r => r.status === 'rejected') ? '部分紀錄暫時讀取不到，請按「更新我的花園」重試。' : '已更新你的紀錄。已有草稿的挑戰，進入後記得按「回復上次草稿」。';
    refresh.disabled = false;
}
refresh.addEventListener('click', () => loadGarden());
window.addEventListener('pageshow', event => { if (event.persisted) loadGarden(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && session?.user) loadGarden(); });
initNavbarAuth({ onSessionResolved: loadGarden });
