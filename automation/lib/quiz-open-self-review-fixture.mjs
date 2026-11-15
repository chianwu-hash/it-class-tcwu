import {readFile} from 'node:fs/promises';
import {createQuizDb,PGlite} from './quiz-local-db.mjs';
import {buildOpenSelfReviewMigration} from './quiz-open-self-review-migration.mjs';

// Synthetic local-only fixture. It never connects to Supabase or loads credentials.
export async function createOpenSelfReviewDb(){
 const load=name=>readFile(new URL('../../supabase/'+name,import.meta.url),'utf8');
 const {definitions}=JSON.parse(await readFile(new URL('../fixtures/quiz-open-self-review-before.json',import.meta.url),'utf8'));
 const db=await createQuizDb(undefined,{batch2:true,batch3:true,batch4:true});db.exec=PGlite.prototype.exec.bind(db);
 try{
  for(const file of ['quiz-past-exams.sql','quiz-learning.sql','quiz-study.sql','quiz-pool-study.sql','quiz-math-response.sql','quiz-normal-fields-helpers.sql'])await db.exec(await load(file));
  await db.exec('alter table public.quiz_sessions add column if not exists library_visible boolean not null default true;');
  const snapshot=await load('production-snapshot/functions.sql');
  for(const name of ['quiz_session_class_allowed','quiz_nav_identity']){
   const match=snapshot.match(new RegExp('CREATE OR REPLACE FUNCTION public\\.'+name+'\\([\\s\\S]*?(?=\\r?\\n-- )'));if(!match)throw Error('Fixture prerequisite missing: '+name);await db.exec(match[0]);
  }
  for(const d of definitions)await db.exec(d.definition);
  await db.exec(buildOpenSelfReviewMigration(definitions,await load('quiz-open-self-review-helpers.sql')));return db;
 }catch(error){await db.close();throw error;}
}
