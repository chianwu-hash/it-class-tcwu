import fs from 'node:fs/promises';
import {setupMediaDB} from './partner-message-db.mjs';
const read=p=>fs.readFile(new URL('../../'+p,import.meta.url),'utf8');
export async function setupTeamDB(){
 const f=await setupMediaDB(),db=f.db;
 await db.exec(`create table public.quiz_versions(id uuid primary key,document jsonb);
 alter table public.quiz_generated_papers add column user_id uuid,add column config jsonb,add column display_name text,add column deleted_at timestamptz,add column created_at timestamptz default now();`);
 const snapshot=await read('supabase/production-snapshot/functions.sql');
 const install=async name=>{const i=snapshot.indexOf('CREATE OR REPLACE FUNCTION '+name+'(');if(i<0)throw Error(name);await db.exec(snapshot.slice(i,snapshot.indexOf('$function$;',i)+11));};
 for(const name of ['public.quiz_valid_runs','public.quiz_valid_content','public.quiz_validate'])await install(name);
 await db.exec(await read('supabase/quiz-partner-self.sql'));
 // Use exactly the two current production definitions that the guarded migration transforms.
 for(const name of ['partner_pilot.lobby_action','public.quiz_partner_pilot_action'])await install(name);
 const sid=(await db.query(`select source_session from partner_pilot.papers where id='ten'`)).rows[0].source_session;
 const version=(await db.query(`select source_version from partner_pilot.papers where id='ten'`)).rows[0].source_version;
 await db.query(`insert into partner_pilot.papers(id,title,grade,subject,kind,total,content_key,source_version,is_real,source_session) values('twenty','合成20題',3,'數學','leaf',20,'twenty',$1,true,$2)`,[version,sid]);
 for(let n=11;n<=20;n++)await db.query(`insert into partner_pilot.question_bank(id,title,prompt,options,correct,explanation) values($1,'合成題','想一想','["甲","乙"]',0,'先找條件')`,[1000+n]);
 for(let n=1;n<=20;n++)await db.query(`insert into partner_pilot.paper_items values('twenty',$1,$2)`,[n,1000+n]);
 await db.exec(`alter table partner_pilot.rooms add column allocation_version integer not null default 0;
 create table partner_pilot.allocations(room_id uuid,qid int,user_id uuid,unit_id text,primary key(room_id,qid));
 create function partner_pilot.allocation_items(pid text) returns table(qid integer,unit_id text,weight integer) language sql stable as $$
 select i.qid,case when number<=4 then 'a' when number<=7 then 'b' when number<=9 then 'c' else 'd' end,case when number<=4 then 4 when number<=7 then 3 when number<=9 then 2 else 1 end from partner_pilot.paper_items i where i.paper_id=pid$$;`);
 await db.query(`insert into public.quiz_past_papers values('packed-source',$1,3,115,1,'合成考古題組',$2,true)`,[f.uid(1),version]);
 await db.query(`insert into partner_pilot.papers(id,title,grade,subject,kind,total,content_key,source_version,is_real,past_meta) values('packed','合成考古題組',3,'數學','flower',10,'packed',$1,true,'{"sourcePaper":"packed-source"}')`,[version]);
 await db.exec(`insert into partner_pilot.paper_items select 'packed',number,qid from partner_pilot.paper_items where paper_id='ten'`);
 for(const name of ['partner_pilot.freeze_allocation','partner_pilot.owner_of','partner_pilot.snapshot'])await install(name);
 await db.exec(`create trigger partner_freeze_allocation before insert or update on partner_pilot.rooms for each row execute function partner_pilot.freeze_allocation()`);
 await db.exec(await read('supabase/quiz-partner-team-flow.sql'));
 return f;
}
