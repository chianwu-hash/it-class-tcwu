// Presentation only: preserve the existing grader's CRLF, per-line trim and accepted glyph aliases.
const aliases = char => /[奬奨]/.test(char) ? '獎' : char === '説' ? '說' : char;

export function normalizeTypingText(raw) {
    const source = String(raw);
    const units = [];
    for (let index = 0; index < source.length; index++) {
        const end = source[index] === '\r' && source[index + 1] === '\n' ? index + 2 : index + 1;
        units.push({ text: end - index === 2 ? '\n' : source[index], start: index, end });
        if (end - index === 2) index++;
    }
    const kept = [];
    let start = 0;
    for (let end = 0; end <= units.length; end++) {
        if (end < units.length && units[end].text !== '\n') continue;
        const line = units.slice(start, end).map(unit => unit.text).join('');
        const left = line.length - line.trimStart().length;
        const length = line.trim().length;
        kept.push(...units.slice(start + left, start + left + length));
        if (end < units.length) kept.push(units[end]);
        start = end + 1;
    }
    return { text: kept.map(unit => aliases(unit.text)).join(''), map: kept };
}

function graphemes(text) {
    if (typeof Intl.Segmenter === 'function') {
        return [...new Intl.Segmenter('zh-Hant', { granularity: 'grapheme' }).segment(text)]
            .map(part => ({ text: part.segment, index: part.index, end: part.index + part.segment.length }));
    }
    let index = 0;
    return Array.from(text, char => {
        const token = { text: char, index, end: index + char.length };
        index = token.end;
        return token;
    });
}

// A bounded edit-distance window identifies the first edit; it never tries to count every error.
function firstEdit(actual, expected) {
    if (!actual.length) return 'missing';
    if (!expected.length) return 'extra';
    const size = 64;
    const a = actual.slice(0, size), e = expected.slice(0, size);
    const cost = Array.from({ length: e.length + 1 }, () => new Uint16Array(a.length + 1));
    // The cropped tail is unknown, not a real end of text. Do not charge for it twice.
    for (let i = 0; i <= e.length; i++) cost[i][a.length] = actual.length > size ? 0 : e.length - i;
    for (let j = 0; j <= a.length; j++) cost[e.length][j] = expected.length > size ? 0 : a.length - j;
    for (let i = e.length - 1; i >= 0; i--) {
        for (let j = a.length - 1; j >= 0; j--) {
            cost[i][j] = e[i].text === a[j].text ? cost[i + 1][j + 1]
                : 1 + Math.min(cost[i + 1][j + 1], cost[i + 1][j], cost[i][j + 1]);
        }
    }
    const replace = cost[1][1], missing = cost[1][0], extra = cost[0][1];
    // A substitution is the least surprising description when repeated text makes edits ambiguous.
    if (replace <= missing && replace <= extra) return 'replace';
    return missing <= extra ? 'missing' : 'extra';
}

function snippet(tokens, index, count) {
    const left = Math.max(0, index - 12), right = Math.min(tokens.length, index + count + 14);
    const join = parts => parts.map(token => token.display ?? token.text).join('');
    return { before: join(tokens.slice(left, index)), highlight: join(tokens.slice(index, index + count)),
        after: join(tokens.slice(index + count, right)), moreBefore: left > 0, moreAfter: right < tokens.length };
}

export function findTypingDifference(raw, answer) {
    const source = String(raw), expected = String(answer);
    const normalized = normalizeTypingText(source);
    if (normalized.text === expected) return null;
    const actualTokens = graphemes(normalized.text).map(token => {
        const start = normalized.map[token.index].start, end = normalized.map[token.end - 1].end;
        return { ...token, start, rawEnd: end, display: source.slice(start, end) };
    });
    const expectedTokens = graphemes(expected);
    let index = 0;
    while (index < actualTokens.length && index < expectedTokens.length
        && actualTokens[index].text === expectedTokens[index].text) index++;
    const kind = firstEdit(actualTokens.slice(index), expectedTokens.slice(index));
    const actualCount = kind === 'missing' ? 0 : 1, expectedCount = kind === 'extra' ? 0 : 1;
    const previous = actualTokens[index - 1];
    // Insert before ignored trailing spaces, so adding a missing line-end character keeps them ignored.
    const actualStart = kind === 'missing' && previous && previous.text !== '\n'
        ? previous.rawEnd : actualTokens[index]?.start ?? actualTokens.at(-1)?.rawEnd ?? source.length;
    const actualEnd = actualCount ? actualTokens[index].rawEnd : actualStart;
    return { kind, actualStart, actualEnd,
        expectedStart: expectedTokens[index]?.index ?? expected.length,
        expectedEnd: expectedCount ? expectedTokens[index].end : expectedTokens[index]?.index ?? expected.length,
        actualText: actualCount ? actualTokens[index].display : '',
        expectedText: expectedCount ? expectedTokens[index].text : '',
        actualContext: snippet(actualTokens, index, actualCount),
        expectedContext: snippet(expectedTokens, index, expectedCount) };
}
