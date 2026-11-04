// Sources visually checked: 康軒國語三上 L2 p.19,21; Here We Go 1 U2 p.26,28.
// Curly English apostrophes are normalized to the physical keyboard's straight apostrophe.
export const WEEK10_LEVELS = [
    { id: 1, lang: 'zh', title: '中打起步', ans: '看不清楚。',
        hint: '切到「中」，選對字，再補上中文全形句號「。」。',
        source: '康軒國語三上第二課〈妙故事點點名〉p.19，話語末段節錄',
        replay: '快還來！', replaySource: '康軒國語三上第二課〈妙故事點點名〉p.21，對話末段節錄' },
    { id: 2, lang: 'en', title: '英打暖身', ans: 'Thank you.',
        hint: '切到「英」，T 大寫、單字間空一格，最後是半形句點。',
        source: '翰林 Here We Go 1 Unit 2 p.28 Daily Talk',
        replay: "You're welcome.", replaySource: '翰林 Here We Go 1 Unit 2 p.28 Daily Talk' },
    { id: 3, lang: 'zh', title: '對話標點', ans: '「那是我的雨傘，快還來！」',
        hint: '別漏掉成對引號！逗號、驚嘆號也用中文全形標點。',
        source: '康軒國語三上第二課〈妙故事點點名〉p.21，原對話節錄',
        replay: '「我……我……看不清楚。」', replaySource: '康軒國語三上第二課〈妙故事點點名〉p.19，原對話節錄' },
    { id: 4, lang: 'en', title: '年齡問答', ans: "How old are you?\nI'm ten.",
        hint: "分兩行輸入。問號、直撇號 ' 和句點都是英文半形；ten 不改成自己的年齡。",
        source: '翰林 Here We Go 1 Unit 2 p.26 Target Language',
        replay: "How old are you?\nI'm ten years old.", replaySource: '翰林 Here We Go 1 Unit 2 p.26 Target Language' },
    { id: 5, lang: 'mixed', title: '魔王關：中英切換', ans: "小聲的說：「我……我……看不清楚。」\nHow old are you?\nI'm ten years old.",
        hint: "先中文，再切英文，共三行。每組刪節號是「……」（兩個 …），不是六個句點。",
        source: '國語第二課 p.19＋英語 Unit 2 p.26，兩科節錄組合，非中英翻譯',
        replay: "大聲喊叫：「那是我的雨傘，快還來！」\nThank you.\nYou're welcome.",
        replaySource: '國語第二課 p.21＋英語 Unit 2 p.28，兩科節錄組合，非中英翻譯' }
];

// Static, teacher-led questions. No anonymous interactive quiz or saved score.
export const WEEK10_REVIEW = [
    { question: '〈歪打正著〉中，是誰小聲說「我……我……看不清楚」？', answer: '以樂。國語第二課 p.19。' },
    { question: '〈忙中有錯〉中，跟在王叔叔後面追喊的人說了什麼？你從哪裡看出雨傘不是王叔叔的？', answer: '「那是我的雨傘，快還來！」從這句對話判斷；請學生指出文本線索。國語第二課 p.21。' },
    { question: '別人說「Thank you.」，課本中可以怎麼回答？', answer: "You're welcome. 英語 Unit 2 p.28。" },
    { question: '「How old are you?」是在問名字，還是在問年齡？', answer: '問年齡。英語 Unit 2 p.26。' },
    { question: '「I\'m ten years old.」表示幾歲？請再說出句尾要輸入哪一種句點。', answer: '十歲；英文半形句點「.」。英語 Unit 2 p.26；句點辨識為資訊課補充練習。' }
];

export function describeWeek10Mismatch(answer, value) {
    let index = 0;
    while (index < value.length && value[index] === answer[index]) index++;
    const lines = answer.slice(0, index).split('\n');
    const position = `第 ${lines.length} 行第 ${lines.at(-1).length + 1} 個字元`;
    if (index === answer.length) return `${position}附近多了 ${value.length - answer.length} 個字元，請擦掉多出的部分。`;
    if (answer[index] === '\n') return `${position}要換行，請按 Enter，再輸入下一行。`;
    if (index === value.length) return `${position}起還少 ${answer.slice(index).replaceAll('\n', '').length} 個字元，接著輸入。`;
    const line = answer.split('\n')[lines.length - 1];
    if (/[\u4e00-\u9fff]/.test(line) && /[A-Za-z]/.test(value[index])) return `${position}附近出現英文字母，這一行先切到「中」，再檢查選字與標點。`;
    if (!/[\u4e00-\u9fff]/.test(line) && /[\uFF01-\uFF5E\u3000]/.test(value[index])) return `${position}請改用英文半形字元，並檢查英／中與標點寬度。`;
    if (answer[index] === '…') return `${position}請檢查刪節號，每組「……」是兩個 …，不是英文句點。`;
    return `從${position}附近再檢查一次，留意選字、標點、大小寫與空白。`;
}
