// Helpers shared by automation/db-snapshot-check.mjs and its tests.

// Split supabase/production-snapshot/functions.sql into { signature, md5, definition } blocks.
export function splitSnapshot(sql) {
  const blocks = [];
  const re = /^-- (\S+\(.*?\))  md5=([0-9a-f]{32})\r?\n([\s\S]*?\$function\$;|[\s\S]*?\$\$;|[\s\S]*?;)\r?\n(?=revoke all)/gm;
  for (const m of sql.matchAll(re)) blocks.push({ signature: m[1], md5: m[2], definition: m[3].replace(/;$/, '') });
  return blocks;
}

// Line numbers of "next question" lookups: jsonb_array_elements(<x>.question_order) ... LIMIT 1 without ORDER BY
// in the same statement (the 2026-10-30 question_order bug).
export function unorderedLookups(text) {
  const hits = [];
  let offset = 0;
  for (const s of text.split(';')) {
    if (/jsonb_array_elements\(\s*[\w.]*question_order\s*\)/i.test(s) && /\blimit\s+1\b/i.test(s) && !/\border\s+by\b/i.test(s)) {
      hits.push(text.slice(0, offset).split('\n').length + s.slice(0, s.search(/jsonb_array_elements/i)).split('\n').length - 1);
    }
    offset += s.length + 1;
  }
  return hits;
}
