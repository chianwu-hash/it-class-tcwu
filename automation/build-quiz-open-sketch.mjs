import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildOpenSketchMigration} from './lib/quiz-open-sketch-migration.mjs';
import {buildPartnerOpenSketchMigration} from './lib/quiz-partner-open-sketch-migration.mjs';
// Preserve the approved before-state even after production-snapshot is refreshed.
const {definitions}=JSON.parse(await readFile('automation/fixtures/quiz-open-sketch-before.json','utf8'));
if(definitions.length!==3||definitions.some(d=>createHash('md5').update(d.definition).digest('hex')!==d.md5))throw Error('sketch_baseline_fixture_changed');
const normal=definitions.filter(d=>d.schema==='public'),partner=definitions.find(d=>d.schema==='partner_pilot'&&d.proname==='action_core');
if(normal.length!==2||!partner)throw Error('sketch_baseline_fixture_incomplete');
await writeFile('supabase/quiz-open-sketch.sql',buildOpenSketchMigration(normal,await readFile('supabase/quiz-open-sketch-helpers.sql','utf8')),'utf8');
await writeFile('supabase/quiz-partner-open-sketch.sql',buildPartnerOpenSketchMigration(partner.definition),'utf8');
console.log('Reproduced approved migration SQL; no database connection or production application.');
