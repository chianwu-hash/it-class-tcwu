import fs from 'node:fs/promises';import {buildTeacherMidtermMigration} from './lib/teacher-midterm-migration.mjs';
const plans=JSON.parse(await fs.readFile('supabase/teacher-midterm-twenty-plan.json','utf8'));
await fs.writeFile('supabase/quiz-teacher-midterm-twenty.sql',buildTeacherMidtermMigration(plans),'utf8');
console.log('rebuilt guarded 10-paper migration from the fixed metadata-only manifest');
