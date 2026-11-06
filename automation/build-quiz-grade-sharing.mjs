import fs from 'node:fs/promises';
import {buildGradeSharingMigration} from './lib/quiz-grade-sharing-migration.mjs';
import {splitSnapshot} from './lib/db-snapshot.mjs';
const blocks=splitSnapshot(await fs.readFile('automation/fixtures/partner-match-before/functions.sql','utf8'));
const defs=new Map(blocks.map(b=>[(b.schema==='public'?'public.':'')+b.signature,b.definition+'\n']));
// Snapshot signatures qualify partner schema already; public signatures are unqualified.
for(const b of blocks)if(!b.signature.startsWith('partner_pilot.'))defs.set('public.'+b.signature,b.definition+'\n');
await fs.writeFile('supabase/quiz-grade-sharing.sql',buildGradeSharingMigration(defs),'utf8');
console.log('prepared guarded grade-sharing SQL (11 existing functions, 1 internal helper)');
