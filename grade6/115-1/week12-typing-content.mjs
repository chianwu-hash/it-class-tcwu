// Text and context-specific keyboard readings were checked against printed pages.
export const courseId = 'grade6-115-1';
export const weekCode = '12';

const zh = (text, zhuyin) => ({ text, zhuyin, lang: 'zh' });
const tiger = zh('虎求百獸而食之，得狐。', 'ㄏㄨˇ ㄑㄧㄡˊ ㄅㄞˇ ㄕㄡˋ ㄦˊ ㄕˊ ㄓ ㄉㄜˊ ㄏㄨˊ');
const fox = zh('狐曰：「子無敢食我也，天帝使我長百獸，今子食我，是逆天帝命也。', 'ㄏㄨˊ ㄩㄝ ㄗˇ ㄨˊ ㄍㄢˇ ㄕˊ ㄨㄛˇ ㄧㄝˇ ㄊㄧㄢ ㄉㄧˋ ㄕˇ ㄨㄛˇ ㄓㄤˇ ㄅㄞˇ ㄕㄡˋ ㄐㄧㄣ ㄗˇ ㄕˊ ㄨㄛˇ ㄕˋ ㄋㄧˋ ㄊㄧㄢ ㄉㄧˋ ㄇㄧㄥˋ ㄧㄝˇ');
const followMe = zh('子以我為不信，吾為子先行，子隨我後，觀百獸之見我而敢不走乎？」', 'ㄗˇ ㄧˇ ㄨㄛˇ ㄨㄟˊ ㄅㄨˋ ㄒㄧㄣˋ ㄨˊ ㄨㄟˋ ㄗˇ ㄒㄧㄢ ㄒㄧㄥˊ ㄗˇ ㄙㄨㄟˊ ㄨㄛˇ ㄏㄡˋ ㄍㄨㄢ ㄅㄞˇ ㄕㄡˋ ㄓ ㄐㄧㄢˋ ㄨㄛˇ ㄦˊ ㄍㄢˇ ㄅㄨˋ ㄗㄡˇ ㄏㄨ');
const followFox = zh('虎以為然，故遂與之行。', 'ㄏㄨˇ ㄧˇ ㄨㄟˊ ㄖㄢˊ ㄍㄨˋ ㄙㄨㄟˋ ㄩˇ ㄓ ㄒㄧㄥˊ');
const flee = zh('獸見之皆走。', 'ㄕㄡˋ ㄐㄧㄢˋ ㄓ ㄐㄧㄝ ㄗㄡˇ');
const mistake = zh('虎不知獸畏己而走也，以為畏狐也。', 'ㄏㄨˇ ㄅㄨˋ ㄓ ㄕㄡˋ ㄨㄟˋ ㄐㄧˇ ㄦˊ ㄗㄡˇ ㄧㄝˇ ㄧˇ ㄨㄟˊ ㄨㄟˋ ㄏㄨˊ ㄧㄝˇ');
const hunt = zh('老虎獵捕各種野獸作為食物，抓到了一隻狐狸。', 'ㄌㄠˇ ㄏㄨˇ ㄌㄧㄝˋ ㄅㄨˇ ㄍㄜˋ ㄓㄨㄥˇ ㄧㄝˇ ㄕㄡˋ ㄗㄨㄛˋ ㄨㄟˊ ㄕˊ ㄨˋ ㄓㄨㄚ ㄉㄠˋ ㄌㄜ˙ ㄧ ㄓ ㄏㄨˊ ㄌㄧˊ');
const trust = zh('老虎認為狐狸的話有道理，於是跟著狐狸走。', 'ㄌㄠˇ ㄏㄨˇ ㄖㄣˋ ㄨㄟˊ ㄏㄨˊ ㄌㄧˊ ㄉㄜ˙ ㄏㄨㄚˋ ㄧㄡˇ ㄉㄠˋ ㄌㄧˇ ㄩˊ ㄕˋ ㄍㄣ ㄓㄜ˙ ㄏㄨˊ ㄌㄧˊ ㄗㄡˇ');
const run = zh('百獸看到老虎，全都嚇得落荒而逃。', 'ㄅㄞˇ ㄕㄡˋ ㄎㄢˋ ㄉㄠˋ ㄌㄠˇ ㄏㄨˇ ㄑㄩㄢˊ ㄉㄡ ㄒㄧㄚˋ ㄉㄜ˙ ㄌㄨㄛˋ ㄏㄨㄤ ㄦˊ ㄊㄠˊ');
const why = zh('老虎不知道百獸是因為害怕自己才逃跑，還以為他們是怕狐狸呢！', 'ㄌㄠˇ ㄏㄨˇ ㄅㄨˋ ㄓ ㄉㄠˋ ㄅㄞˇ ㄕㄡˋ ㄕˋ ㄧㄣ ㄨㄟˋ ㄏㄞˋ ㄆㄚˋ ㄗˋ ㄐㄧˇ ㄘㄞˊ ㄊㄠˊ ㄆㄠˇ ㄏㄞˊ ㄧˇ ㄨㄟˊ ㄊㄚ ㄇㄣ˙ ㄕˋ ㄆㄚˋ ㄏㄨˊ ㄌㄧˊ ㄋㄜ˙');

const classical = '康軒國語六上第八課 p.89 經典原文';
const modern = '康軒國語六上第八課 p.90 語譯';
const story = '康軒 Wonder World 7 Unit 4 Story';
const sentence = '康軒 Wonder World 7 Unit 4 Sentence';
const reading = '康軒 Wonder World 7 Unit 4 Reading';
const wake = ['What time do you get up?', 'I get up at six thirty.'];
const lunch = ['Do you have lunch at twelve?', 'Yes, I do.', "No, I don't. I have lunch at twelve thirty."];
const weekday = ['What time do you get up?', 'I get up at six thirty on weekdays.', 'On weekends, I get up at eight.'];
const park = ["Oops! Sorry for waking you up.", "It's OK. See you at the park at seven thirty.", 'See you then.'];
const basketball = ['Nice shot, Boka!', "You're really good at basketball.", 'Stop, Lucky!'];

const prompt = (source, ...lines) => ({ source, lines, ans: lines.map(line => typeof line === 'string' ? line : line.text).join('\n') });
const level = (id, title, main, ...replays) => ({ id, title, main, replays });

export const challenges = {
    regular: {
        key: 'typing_task_6', title: '第 12 週中英打六關', boss: false,
        levels: [
            level(1, '老虎遇見狐狸', prompt(classical, tiger), prompt(classical, flee), prompt(modern, hunt)),
            level(2, '幾點起床', prompt(sentence + ' A p.66', ...wake),
                prompt(story + ' p.62 週末起床', 'Do you get up at six thirty on Saturdays?', "No, I get up at six o'clock every day."),
                prompt(story + ' p.62 平日與週末', ...weekday)),
            level(3, '跟著狐狸走', prompt(classical, followFox, flee), prompt(classical, tiger, followFox), prompt(modern, trust)),
            level(4, '午餐時間', prompt(sentence + ' B p.67', ...lunch), prompt(story + ' p.63 公園見', ...park), prompt(story + ' p.63 球場對話', ...basketball)),
            level(5, '百獸為何逃走', prompt(classical, flee, mistake), prompt(modern, run, why), prompt(classical, tiger, followFox, mistake)),
            level(6, '中英切換', prompt('p.89 原文＋英語 p.66', mistake, ...wake),
                prompt('p.90 語譯＋英語 p.62', trust, ...weekday), prompt('p.89 原文＋英語 p.67', followFox, flee, ...lunch))
        ]
    },
    zh: {
        key: 'typing_boss_zh_1', title: '狐假虎威', boss: true,
        levels: [level(1, '狐假虎威', prompt(classical, tiger, fox, followMe, followFox, flee, mistake),
            prompt(modern + ' 敘事節錄', hunt, trust, run, why),
            prompt('康軒國語六上第八課 p.89～90 原文與語譯對照', tiger, hunt, followFox, trust, flee, run))]
    },
    en: {
        key: 'typing_boss_en_1', title: 'Building Good Habits', boss: true,
        levels: [level(1, 'Building Good Habits',
            prompt(reading + ' p.69～71 正文節錄', "It's the end of the year.", 'I want to break my bad habits.', 'First, I find out my bad habits.', 'Then, I set my goals and make a plan.', 'Make a plan and just do it.', 'Be a better you!'),
            prompt(reading + ' p.70 日常手記', 'I only have 7 hours of sleep.', "It's not enough.", "Sometimes, I don't have breakfast because I get up late.", "I don't exercise."),
            prompt(reading + ' p.70～71，目標與提問', 'Get 8 hours of sleep every day.', 'Have breakfast every day.', 'Exercise every week.', 'What about you?', 'Do you want to say goodbye to your bad habits?'))]
    }
};
