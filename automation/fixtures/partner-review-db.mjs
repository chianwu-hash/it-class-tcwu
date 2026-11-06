import fs from 'node:fs/promises';
import {setupTeamDB} from './partner-team-db.mjs';
export async function setupReviewDB(){
 const f=await setupTeamDB();
 await f.db.exec(await fs.readFile(new URL('./partner-review-before.sql',import.meta.url),'utf8'));
 const before=(await f.db.query(`select jsonb_agg(jsonb_build_object('oid',oid,'acl',proacl::text,'owner',proowner) order by oid) data from pg_proc where oid in ('partner_pilot.team_rooms()'::regprocedure,'partner_pilot.action_core(jsonb)'::regprocedure,'public.quiz_partner_pilot_action(jsonb)'::regprocedure)`)).rows[0].data;
 await f.db.exec(await fs.readFile(new URL('../../supabase/quiz-partner-review-completion.sql',import.meta.url),'utf8'));
 const after=(await f.db.query(`select jsonb_agg(jsonb_build_object('oid',oid,'acl',proacl::text,'owner',proowner) order by oid) data from pg_proc where oid in ('partner_pilot.team_rooms()'::regprocedure,'partner_pilot.action_core(jsonb)'::regprocedure,'public.quiz_partner_pilot_action(jsonb)'::regprocedure)`)).rows[0].data;
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('function authority changed');
 return f;
}
