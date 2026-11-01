import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createQuizDb, TEACHER, OTHER_TEACHER, studentId } from './quiz-local-db.mjs';
import { content, newDocument, newQuestion } from '../../shared/quiz-document.mjs';

export { TEACHER, OTHER_TEACHER, studentId };
export const DEMO_MEDIA = `https://quiz-media.invalid/${OTHER_TEACHER}/${'a'.repeat(64)}`;
export async function learningCall(db, action, course = 'grade6-115-1', payload = {}, user = TEACHER, role = 'authenticated') {
  if (!['authenticated', 'anon'].includes(role)) throw new Error('invalid_role');
  return db.transaction(async tx => {
    await tx.query("select set_config('quiz.test_uid',$1,true)", [user || '']);
    await tx.exec(`set local role ${role}`);
    return (await tx.query('select public.admin_learning_action($1,$2,$3) as result', [action, course, JSON.stringify(payload)])).rows[0].result;
  });
}
export async function createLearningDb() {
  const db = await createQuizDb();
  try {
    await db.exec(`create table public.student_progress(user_id uuid,course_id text,week_code text,activity_key text,
      current_level integer,score integer,completed boolean,updated_at timestamptz default now(),primary key(user_id,course_id,week_code,activity_key));
      alter table public.student_progress enable row level security;
      revoke all on public.student_progress from anon,authenticated;`);
    // Read-only fixture: student transition/writes stay unavailable in this harness.
    await db.exec('create function public.grade3_google_ready() returns boolean language sql as $$select false$$');
    await db.exec(await readFile(new URL('../../supabase/typing_foundation.sql', import.meta.url), 'utf8'));
    // Never load private rosters, credentials, exports or a remote database.
    await db.exec("update public.student_enrollments set display_name='示範同學 '||lpad(seat_no::text,2,'0')");
    await db.exec(`insert into public.student_enrollments values
      (115,'not-linked@example.invalid','603',32,'尚未連結帳號'),
      (115,'conflict@example.invalid','603',33,'帳號對應待確認'),
      (114,'student1@example.invalid','603',1,'舊年度示範');
      insert into auth.users values(gen_random_uuid(),'conflict@example.invalid',now()),(gen_random_uuid(),'CONFLICT@example.invalid',now());
      insert into public.student_enrollments values(115,'student1@example.invalid','301',1,'三年級示範同學');`);
    await db.query("insert into public.student_progress values($1,'grade6-115-1','09','typing_task_5',3,null,false,'2026-10-28T02:00:00Z'),($1,'grade6-115-1','08','quiz_review',5,4,true,'2026-10-26T02:00:00Z')", [studentId(1)]);
    // 23 records exercise stable server pagination (including a page boundary).
    for (let i = 10; i < 33; i++) await db.query("insert into public.student_progress values($1,'grade6-115-1',$2,'practice',1,null,false,now())", [studentId(2), String(i)]);
    const progress = async (lesson, checkpoint, completed, revision = 1, user = studentId(1), course = 'grade6-115-1') =>
      (await db.query(`insert into public.typing_foundation_progress(course_id,learner_key,display_name,lesson_key,checkpoint,completed,revision,completed_at)
        values($1,$2,'舊姓名快照',$3,$4,$5,$6,case when $5 then now() else null end) returning id`, [course, `google:${user}`, lesson, checkpoint, completed, revision])).rows[0].id;
    const home = await progress('english-home-row-v1', 5, true, 2);
    const words = await progress('zhuyin-words-v1', 3, false);
    await progress('zhuyin-home-v1', 5, true);
    await progress('english-home-row-v1', 1, false, 1, studentId(1), 'grade3-115-1');
    await db.query(`insert into public.typing_foundation_resets(progress_id,teacher_id,previous_revision,previous_checkpoint,previous_completed,reset_at)
      values($1,$2,1,5,true,'2026-10-27T01:00:00Z')`, [home, TEACHER]);
    for (let i = 0; i < 26; i++) await db.query(`insert into public.typing_foundation_events
      (id,progress_id,revision,stage,correct,errors,elapsed_ms,interrupted,accuracy,wpm,cpm,rate_unit,passed,created_at)
      values($1,$2,$3,$4,96,$5,60000,false,$6,$7,null,'wpm',$8,$9)`,
      [randomUUID(), home, i < 3 ? 1 : 2, i % 3 === 0 ? 6 : 2, i % 4 === 0 ? 9 : 1, i % 4 === 0 ? 91.4 : 98.9, 14 + i / 10, i % 4 !== 0, new Date(Date.UTC(2026, 9, 28, 2, i)).toISOString()]);
    await db.query(`insert into public.typing_foundation_events(id,progress_id,revision,stage,correct,errors,elapsed_ms,interrupted,accuracy,wpm,cpm,rate_unit,passed)
      values($1,$2,1,3,18,3,45000,false,85.7,0,24,'characters_per_minute',false)`, [randomUUID(), words]);
    const doc = newDocument(); doc.title = '分數與生活・示範卷';doc.catalog={...doc.catalog,subject:'數學',volume:'六上',unit:'分數的加減'};
    const q1 = doc.blocks[0].questions[0];q1.prompt=content('計算 $\\frac{1}{4}+\\frac{1}{4}$，選出正確答案。');
    q1.options[0].content=content('$\\frac{1}{2}$');q1.options[1].content=content('$\\frac{2}{8}$');q1.explanation=content('分母相同，分子相加，再約分。');
    const short=newQuestion('short');short.prompt=content('請用一句話說明你如何把兩個四分之一合起來。');short.answer.accepted=['兩個四分之一等於二分之一'];short.explanation=content('兩份四分之一，可以合成一份二分之一。');
    const picture=newQuestion();picture.prompt=content('圖中有多少份被塗色？');picture.options[0].content=content('2 份');picture.options[1].content=content('4 份');picture.explanation=content('請數出藍色的區域。');
    doc.blocks.push({id:'shared-material',material:content('閱讀下圖，再回答問題。',[{kind:'image',url:DEMO_MEDIA,alt:'四個等分方格，其中兩格塗藍色'}]),questions:[picture,short]});
    const bank=randomUUID();await db.query('insert into public.quiz_banks(id,owner_id,draft) values($1,$2,$3)',[bank,OTHER_TEACHER,doc]);
    const version=(await db.query('insert into public.quiz_versions(bank_id,revision,document) values($1,1,$2) returning id',[bank,doc])).rows[0].id;
    const englishDoc=structuredClone(doc);englishDoc.title='英語單字・示範卷';englishDoc.catalog={...doc.catalog,subject:'英語',unit:'校園單字'};
    englishDoc.blocks[0].questions[0].prompt=content('Which word means「書」?');
    englishDoc.blocks[0].questions[0].options[0].content=content('book');englishDoc.blocks[0].questions[0].options[1].content=content('tree');
    englishDoc.blocks[0].questions[0].explanation=content('book 是書，tree 是樹。');
    englishDoc.blocks[1].material=content('I read a book at school.');
    englishDoc.blocks[1].questions[0].prompt=content('Where do I read the book?');englishDoc.blocks[1].questions[0].options[0].content=content('at school');englishDoc.blocks[1].questions[0].options[1].content=content('in a tree');englishDoc.blocks[1].questions[0].explanation=content('at school 表示在學校。');
    englishDoc.blocks[1].questions[1].prompt=content('請寫出句子中「書」的英文。');englishDoc.blocks[1].questions[1].answer.accepted=['book'];englishDoc.blocks[1].questions[1].explanation=content('原句中的 book 是書。');
    const englishBank=randomUUID();await db.query('insert into public.quiz_banks(id,owner_id,draft) values($1,$2,$3)',[englishBank,OTHER_TEACHER,englishDoc]);
    const englishVersion=(await db.query('insert into public.quiz_versions(bank_id,revision,document) values($1,1,$2) returning id',[englishBank,englishDoc])).rows[0].id;
    const all=doc.blocks.flatMap(b=>b.questions);const order=all.map(q=>q.id);
    const options=Object.fromEntries(all.filter(q=>q.options).map(q=>[q.id,q.options.map(o=>o.id).reverse()]));
    const makePaper=async(n,kind,answerCount,hidden=false,source=null,user=studentId(1),classCode='603')=>{
      const isEnglish=n>=4&&n%3===0,questions=(isEnglish?englishDoc:doc).blocks.flatMap(b=>b.questions);
      const session=randomUUID();await db.query(`insert into public.quiz_sessions(id,owner_id,version_id,school_year,class_codes,reveal,shuffle_questions,shuffle_options,access_mode,created_at)
        values($1,$2,$3,115,$4,'complete',false,true,$5,$6)`,[session,kind==='self'?user:OTHER_TEACHER,isEnglish?englishVersion:version,JSON.stringify([classCode]),kind,new Date(Date.UTC(2026,9,28,2,n)).toISOString()]);
      if(kind==='self') await db.query(`insert into public.quiz_generated_papers(session_id,user_id,request_id,config,actual_distribution,display_name,deleted_at)
        values($1,$2,$3,$4,'{}',$5,case when $6 then now() else null end)`,[session,user,randomUUID(),{kind:source?'extension':'self',...(source?{attempt_id:source.id,question_id:q1.id}:{})},`示範練習 ${String(n+1).padStart(2,'0')}${source?'・同重點延伸':''}`,hidden]);
      let attempt=null;
      if(answerCount>=0){attempt=(await db.query('insert into public.quiz_attempts(session_id,user_id,question_order,option_orders) values($1,$2,$3,$4) returning id',[session,user,order,options])).rows[0].id;
        for(let j=0;j<answerCount;j++)await db.query('insert into public.quiz_answers(attempt_id,question_id,request_id,response,correct) values($1,$2,$3,$4,$5)',[attempt,questions[j].id,randomUUID(),JSON.stringify(questions[j].type==='single'?(j===0?'b':'a'):questions[j].answer.accepted[0]),j!==0]);}
      return {session,id:attempt};
    };
    const original=await makePaper(0,'practice',3);
    await makePaper(1,'self',1,false,original);await makePaper(2,'self',3,true);await makePaper(3,'self',-1);
    for(let n=4;n<23;n++)await makePaper(n,'self',n%4===0?0:3);
    const stranger=await makePaper(30,'practice',1,false,null,studentId(3),'604');
    await db.query('insert into public.quiz_media_assets values($1,$2,$3,$4,$5)',[DEMO_MEDIA,OTHER_TEACHER,`${OTHER_TEACHER}/${'a'.repeat(64)}`,'image/svg+xml',400]);
    await db.exec(await readFile(new URL('../../supabase/admin_learning.sql', import.meta.url), 'utf8'));
    return {db,ids:{home,words,original,stranger}};
  }catch(error){await db.close();throw error;}
}
