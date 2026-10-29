// Independent collector: bounded metadata to private Vercel runtime logs, no DB.
const atom = value => typeof value === 'string' && /^[a-zA-Z0-9_.:/-]{1,100}$/.test(value) ? value : '';
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (req.headers.origin !== 'https://it-class-tcwu.vercel.app') return res.status(403).end();
  if (Number(req.headers['content-length'] || 0) > 24000) return res.status(413).end();
  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch { return res.status(400).end(); }
  if (!body || JSON.stringify(body).length > 24000 || !['20261029-301-v1','20261029-load-batch1','20261029-load-batch2','20261029-load-batch3'].includes(body.release) ||
      !/^[a-f0-9-]{36}$/.test(body.tab || '') || !Array.isArray(body.events) || body.events.length > 40 ||
      !/^\/(?:|index\.html|grade[36]\/115-1\/(?:index|quiz|quiz-library)\.html)$/.test(body.page || '')) return res.status(400).end();
  const events = body.events.map(row => {
    const safe = {};
    for (const key of ['phase','operation','endpoint','action','code','request','cf']) if (atom(row?.[key])) safe[key] = atom(row[key]);
    for (const key of ['seq','id','status','ms']) if (Number.isSafeInteger(row?.[key]) && row[key] >= 0 && row[key] <= 86400000) safe[key] = row[key];
    if (typeof row?.at === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(row.at)) safe.at = row.at;
    return safe;
  });
  console.log(JSON.stringify({ type: 'quiz_connection_diagnostics', release: body.release, tab: body.tab,
    page: body.page, received: new Date().toISOString(), events }));
  return res.status(204).end();
};
