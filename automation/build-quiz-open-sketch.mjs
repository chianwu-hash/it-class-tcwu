import {readFile,writeFile} from 'node:fs/promises';
import {buildOpenSketchMigration} from './lib/quiz-open-sketch-migration.mjs';
import {buildPartnerOpenSketchMigration} from './lib/quiz-partner-open-sketch-migration.mjs';
const source=(await readFile('supabase/production-snapshot/functions.sql','utf8')).replaceAll('\r\n','\n');
const definitions=['quiz_open_validate','quiz_open_submit'].map(proname=>{
 const start=source.indexOf('CREATE OR REPLACE FUNCTION public.'+proname+'('),end=source.indexOf('\nrevoke all on function ',start);
 if(start<0||end<0)throw Error('snapshot_definition_missing:'+proname);
 const definition=source.slice(start,end).replace(/;$/,'')+'\n';
 const header=source.slice(0,start).match(/md5=([a-f0-9]{32})\n$/)?.[1];
 if(!header)throw Error('snapshot_hash_header_missing:'+proname);
 return {proname,definition};
});
await writeFile('supabase/quiz-open-sketch.sql',buildOpenSketchMigration(definitions,await readFile('supabase/quiz-open-sketch-helpers.sql','utf8')),'utf8');
const begin=source.indexOf('CREATE OR REPLACE FUNCTION partner_pilot.action_core('),end=source.indexOf('\nrevoke all on function ',begin);
if(begin<0||end<0)throw Error('partner_snapshot_missing');
await writeFile('supabase/quiz-partner-open-sketch.sql',buildPartnerOpenSketchMigration(source.slice(begin,end).replace(/;$/,'')+'\n'),'utf8');
console.log('Prepared candidate SQL; no database connection or production application.');
