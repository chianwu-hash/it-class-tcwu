import fs from 'node:fs/promises';
import {buildSavedWorkMigration} from './lib/quiz-saved-work-migration.mjs';
const {definitions}=JSON.parse(await fs.readFile('automation/fixtures/quiz-saved-work-before.json','utf8'));
await fs.writeFile('supabase/quiz-saved-work.sql',buildSavedWorkMigration(definitions));
