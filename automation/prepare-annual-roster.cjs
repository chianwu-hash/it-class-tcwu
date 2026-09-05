const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const classes = new Set(['301', '302', '303', '304', '305', '306', '603', '604']);
const sources = ['esa-301-306-students.json', 'esa-401-608-students.json'];
const rows = sources.flatMap(file => JSON.parse(fs.readFileSync(
    path.join(root, 'tmp/loilo-annual-processing', file), 'utf8'
))).filter(group => classes.has(group.classCode)).flatMap(group => group.rows.map(row => {
    const seat = row.posname.match(/(\d{1,2})\D*$/);
    if (!seat || !/^[a-z0-9._-]+$/i.test(row.uid) || !row.username?.trim()) {
        throw new Error(`Invalid roster entry in ${group.classCode}`);
    }
    return { schoolYear: 115, email: `${row.uid.toLowerCase()}@apps.ntpc.edu.tw`,
        classCode: group.classCode, seatNo: Number(seat[1]), name: row.username.trim() };
}));

const emails = new Set();
const seats = new Set();
const counts = {};
for (const row of rows) {
    const seat = `${row.classCode}:${row.seatNo}`;
    if (emails.has(row.email) || seats.has(seat) || row.seatNo < 1 || row.seatNo > 99) {
        throw new Error(`Duplicate identity or invalid seat in ${row.classCode}`);
    }
    emails.add(row.email);
    seats.add(seat);
    counts[row.classCode] = (counts[row.classCode] || 0) + 1;
}
if (Object.keys(counts).length !== classes.size || rows.length !== 176) {
    throw new Error('Roster totals differ from the reviewed 176 students');
}
const quote = value => `'${String(value).replaceAll("'", "''")}'`;
const values = rows.map(row => `(${row.schoolYear}, ${quote(row.email)}, ${quote(row.classCode)}, ${row.seatNo}, ${quote(row.name)})`);
const sql = `begin;\ninsert into public.student_enrollments (school_year, email, class_code, seat_no, display_name)\nvalues\n${values.join(',\n')}\non conflict (school_year, email) do update set\nclass_code = excluded.class_code, seat_no = excluded.seat_no, display_name = excluded.display_name;\ncommit;\n`;
const output = path.join(root, 'automation/output/annual-roster-115');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'import.sql'), sql, 'utf8');
fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify({schoolYear:115, total:rows.length, classes:counts}, null, 2), 'utf8');
console.log(JSON.stringify({total: rows.length, classes: counts, output}));
