import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildPeerSketchReviewMigration} from './lib/quiz-partner-peer-sketch-review-migration.mjs';
const f=JSON.parse(await readFile('automation/fixtures/quiz-partner-peer-sketch-review-before.json','utf8'));
if(createHash('md5').update(f.definition).digest('hex')!==f.md5)throw Error('peer_sketch_fixture_changed');
await writeFile('supabase/quiz-partner-peer-sketch-review.sql',buildPeerSketchReviewMigration(f.definition),'utf8');
console.log('Prepared peer handwriting review SQL; no database connection.');
