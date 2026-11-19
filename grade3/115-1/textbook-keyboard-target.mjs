// Fixed readings for the L2/L7 excerpts used by Weeks 10–12, including replays.
// Match the whole line: polyphones such as 商行／快還來 must follow context.
// Punctuation has no syllable; 的 uses the neutral-tone key, and first tone uses Space.
const readings = new Map([
    ['看不清楚。', 'ㄎㄢˋ ㄅㄨˋ ㄑㄧㄥ ㄔㄨˇ'],
    ['快還來！', 'ㄎㄨㄞˋ ㄏㄨㄢˊ ㄌㄞˊ'],
    ['「那是我的雨傘，快還來！」', 'ㄋㄚˋ ㄕˋ ㄨㄛˇ ㄉㄜ˙ ㄩˇ ㄙㄢˇ ㄎㄨㄞˋ ㄏㄨㄢˊ ㄌㄞˊ'],
    ['「我……我……看不清楚。」', 'ㄨㄛˇ ㄨㄛˇ ㄎㄢˋ ㄅㄨˋ ㄑㄧㄥ ㄔㄨˇ'],
    ['小聲的說：「我……我……看不清楚。」', 'ㄒㄧㄠˇ ㄕㄥ ㄉㄜ˙ ㄕㄨㄛ ㄨㄛˇ ㄨㄛˇ ㄎㄢˋ ㄅㄨˋ ㄑㄧㄥ ㄔㄨˇ'],
    ['大聲喊叫：「那是我的雨傘，快還來！」', 'ㄉㄚˋ ㄕㄥ ㄏㄢˇ ㄐㄧㄠˋ ㄋㄚˋ ㄕˋ ㄨㄛˇ ㄉㄜ˙ ㄩˇ ㄙㄢˇ ㄎㄨㄞˋ ㄏㄨㄢˊ ㄌㄞˊ'],
    ['老街', 'ㄌㄠˇ ㄐㄧㄝ'],
    ['山坡', 'ㄕㄢ ㄆㄛ'],
    ['紅毛城', 'ㄏㄨㄥˊ ㄇㄠˊ ㄔㄥˊ'],
    ['百年商行', 'ㄅㄞˇ ㄋㄧㄢˊ ㄕㄤ ㄏㄤˊ'],
    ['長長的老街，有傳統餅店，有百年商行。', 'ㄔㄤˊ ㄔㄤˊ ㄉㄜ˙ ㄌㄠˇ ㄐㄧㄝ ㄧㄡˇ ㄔㄨㄢˊ ㄊㄨㄥˇ ㄅㄧㄥˇ ㄉㄧㄢˋ ㄧㄡˇ ㄅㄞˇ ㄋㄧㄢˊ ㄕㄤ ㄏㄤˊ'],
    ['蒼老的紅毛城，站在山坡上。', 'ㄘㄤ ㄌㄠˇ ㄉㄜ˙ ㄏㄨㄥˊ ㄇㄠˊ ㄔㄥˊ ㄓㄢˋ ㄗㄞˋ ㄕㄢ ㄆㄛ ㄕㄤˋ']
]);

export function getTextbookKeyboardTarget(text) {
    // Unverified new Chinese text retains the shared guide's explicit warning.
    return /\p{Script=Han}/u.test(text) ? { lang: 'zh', text, zhuyin: readings.get(text) } : text;
}
