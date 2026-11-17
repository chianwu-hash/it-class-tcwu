import {createHash} from 'node:crypto';
const md5=s=>createHash('md5').update(s).digest('hex');
export function buildPeerSketchReviewMigration(before){
 before=before.replaceAll('\r\n','\n');
 const anchor="shared:=shared||jsonb_build_array(item-'attempts');";
 if(before.split(anchor).length!==2)throw Error('peer_sketch_review_baseline_changed');
 const replacement=`shared:=shared||jsonb_build_array((item-'attempts')||case
   when submitted=total and q.normal_question->>'type'='open'
    and exists(select 1 from jsonb_array_elements(q.normal_question->'fields') f where f->>'input'='sketch')
   then jsonb_build_object('attempts',coalesce((
    select jsonb_build_array(jsonb_build_object('choice',a.choice,'value',a.response,'correct',a.correct,'at',a.created_at))
    from partner_pilot.answers a where a.room_id=rid and a.qid=q.id and a.user_id=owner
    order by a.attempt desc limit 1),'[]'::jsonb)) else '{}'::jsonb end);`;
 const after=before.replace(anchor,replacement);
 return `-- Candidate: explicit user approval required before production application.\nbegin;\nset local lock_timeout='3s';\ndo $guard$begin\n if md5(pg_get_functiondef('partner_pilot.learning_snapshot_pre_message_media(uuid)'::regprocedure))<>'${md5(before)}' then raise exception 'peer_sketch_review_baseline_changed';end if;\n if to_regprocedure('public.quiz_open_response(jsonb,text)')is null then raise exception 'peer_sketch_prerequisite_missing';end if;\nend $guard$;\n${after.trimEnd()};\ncommit;\n`;
}
