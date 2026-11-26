// The revealed answer describes a group only when every pair accepts every
// distinct ordered pair of the same digits. Other tuple contracts stay as-is.
export function distinctDigitGroups(fields, answer) {
  if (!Array.isArray(fields) || answer?.format !== 'fields-v1' || !Array.isArray(answer.tuples) || !answer.tuples.length) return null;
  const domains = new Map();
  for (const { id, input } of fields) {
    const values = answer.fields?.[id];
    if (input !== 'math' || !Array.isArray(values) || values.some(v => typeof v !== 'string' || !/^[0-9]$/u.test(v))) return null;
    const digits = [...new Set(values)].sort().join('');
    if (digits.length !== values.length || digits.length < 3 || digits.length > 5) return null;
    if (!domains.has(digits)) domains.set(digits, { ids: [], digits: [...digits] });
    domains.get(digits).ids.push(id);
  }
  const groups = [...domains.values()];
  const pairs = new Map();
  for (const { ids, digits } of groups) {
    if (ids.length !== digits.length) return null;
    for (const [i, id] of ids.entries()) {
      for (const other of ids.slice(i + 1)) pairs.set(pairKey(id, other), digits);
    }
  }
  if (pairs.size !== answer.tuples.length) return null;
  for (const tuple of answer.tuples) {
    if (!Array.isArray(tuple?.fields) || tuple.fields.length !== 2 || !Array.isArray(tuple.accepted)) return null;
    const [first, second] = tuple.fields;
    const key = pairKey(first, second);
    const digits = pairs.get(key);
    if (!digits || tuple.accepted.length !== digits.length * (digits.length - 1)) return null;
    const seen = new Set();
    for (const candidate of tuple.accepted) {
      const a = candidate?.[first], b = candidate?.[second];
      if (!digits.includes(a) || !digits.includes(b) || a === b || seen.has(a + b)) return null;
      seen.add(a + b);
    }
    pairs.delete(key);
  }
  return groups;
}

function pairKey(a, b) {
  return JSON.stringify([a, b].sort());
}

export function distinctDigitGroupSummary(groups) {
  return groups.map(({ digits }, index) => `第 ${index + 1} 組：${digits.join('、')}（順序不限）`).join('；');
}

// Use only exact integer literals, decimals, and fractions for per-cell
// hints. The server result remains authoritative for the overall grade.
export function reviewDigit(value) {
  if (typeof value !== 'string' || /[0-9０-９][\s　]+[0-9０-９]/u.test(value)) return null;
  let text = value.replace(/[０-９]/gu, v => String(v.charCodeAt(0) - 0xff10))
    .replace(/[＋－−–—（）／÷]/gu, v => ({'＋':'+','－':'-','−':'-','–':'-','—':'-','（':'(','）':')','／':'/','÷':'/'})[v])
    .replace(/[\s　]/gu, '');
  while (/^\([+0-9./-]+\)$/u.test(text)) text = text.slice(1, -1);
  if (/^[+-]?[0-9]{1,12}$/u.test(text) || /^[+-]?[0-9]{1,9}\.0{1,8}$/u.test(text)) return String(Number(text));
  const fraction = /^([+-]?[0-9]{1,9})\/([0-9]{1,9})$/u.exec(text);
  if (!fraction) return null;
  const numerator = Number(fraction[1]), denominator = Number(fraction[2]);
  return denominator && numerator % denominator === 0 ? String(numerator / denominator) : null;
}
