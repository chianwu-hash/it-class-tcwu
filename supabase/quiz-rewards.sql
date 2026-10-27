-- Private timing and earned-leaf ledger. No writes to student_progress.
begin;
create table if not exists public.quiz_integrity_settings(id boolean primary key default true check(id),enabled boolean not null default false,min_seconds numeric not null default 2 check(min_seconds between 1 and 10));
insert into public.quiz_integrity_settings values(true,false,2) on conflict(id) do nothing;
create table if not exists public.quiz_question_timing(
 attempt_id uuid not null references public.quiz_attempts(id),question_id text not null,first_seen timestamptz not null default clock_timestamp(),
 accepted_seconds numeric,fast_warnings integer not null default 0,primary key(attempt_id,question_id)
);
create table if not exists public.quiz_leaf_awards(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),attempt_id uuid not null unique references public.quiz_attempts(id),
 fingerprint text not null,grade integer not null,total integer not null,correct integer not null,awarded_at timestamptz not null default now(),unique(user_id,fingerprint)
);
alter table public.quiz_integrity_settings enable row level security;
alter table public.quiz_question_timing enable row level security;
alter table public.quiz_leaf_awards enable row level security;
revoke all on public.quiz_integrity_settings,public.quiz_question_timing,public.quiz_leaf_awards from public,anon,authenticated;
grant all on public.quiz_integrity_settings,public.quiz_question_timing,public.quiz_leaf_awards to service_role;

create or replace function public.quiz_answer_guard(aid uuid,qid text,submitting boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.quiz_attempts; s public.quiz_integrity_settings; t public.quiz_question_timing; elapsed numeric;
begin
 select * into a from public.quiz_attempts where id=aid and user_id=auth.uid();
 if a.id is null then raise exception 'attempt_unavailable';end if;
 select * into s from public.quiz_integrity_settings where id;
 if not s.enabled or coalesce(public.is_teacher(),false) then return '{}'::jsonb;end if;
 insert into public.quiz_question_timing(attempt_id,question_id) values(aid,qid) on conflict do nothing;
 select * into t from public.quiz_question_timing where attempt_id=aid and question_id=qid for update;
 elapsed:=extract(epoch from(clock_timestamp()-t.first_seen));
 if submitting and elapsed<s.min_seconds then
  update public.quiz_question_timing set fast_warnings=fast_warnings+1 where attempt_id=aid and question_id=qid;
  return jsonb_build_object('warning','answer_too_fast','retry_after',ceil(s.min_seconds-elapsed));
 end if;
 if submitting then update public.quiz_question_timing set accepted_seconds=elapsed where attempt_id=aid and question_id=qid;end if;
 return '{}'::jsonb;
end $$;

create or replace function public.quiz_leaf_result(aid uuid,new_answer boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.quiz_attempts;s public.quiz_sessions;v public.quiz_versions;settings public.quiz_integrity_settings;
 n integer;c integer;timed integer;fp text;award_id uuid;existing public.quiz_leaf_awards;g integer;
begin
 select * into a from public.quiz_attempts where id=aid and user_id=auth.uid();if a.id is null then raise exception 'attempt_unavailable';end if;
 select * into s from public.quiz_sessions where id=a.session_id;
 select * into v from public.quiz_versions where id=s.version_id;
 select * into settings from public.quiz_integrity_settings where id;
 n:=jsonb_array_length(a.question_order);
 select count(*) filter(where correct) into c from public.quiz_answers where attempt_id=aid;
 select * into existing from public.quiz_leaf_awards where attempt_id=aid;
 if existing.id is not null then return jsonb_build_object('earned',true,'earned_now',false,'id',existing.id);end if;
 if n<10 then return jsonb_build_object('earned',false,'reason','short_paper');end if;
 if not settings.enabled or coalesce(public.is_teacher(),false) or s.access_mode not in ('practice','self') then return jsonb_build_object('earned',false,'reason','not_eligible');end if;
 if (select count(*) from public.quiz_answers where attempt_id=aid)<>n then return jsonb_build_object('earned',false,'reason','incomplete');end if;
 if c*100<n*60 then return jsonb_build_object('earned',false,'reason','accuracy');end if;
 select count(*) into timed from public.quiz_question_timing t where t.attempt_id=aid and t.accepted_seconds>=settings.min_seconds;
 if timed<>n then return jsonb_build_object('earned',false,'reason','timing_unverified');end if;
 select md5(string_agg(x.fingerprint,'' order by x.fingerprint)) into fp from (
  select md5((q->'prompt')::text||coalesce((select string_agg((o->'content')::text,'' order by (o->'content')::text) from jsonb_array_elements(q->'options') o),'')) fingerprint
  from jsonb_array_elements(v.document->'blocks') b,lateral jsonb_array_elements(b->'questions') q) x;
 g:=substring(v.document->'catalog'->>'volume' from '^([36])')::integer;
 if g is null or not exists(select 1 from public.student_enrollments e join auth.users u on lower(u.email)=e.email where u.id=auth.uid() and u.email_confirmed_at is not null and e.school_year=s.school_year and s.class_codes ? e.class_code and left(e.class_code,1)::integer=g) then return jsonb_build_object('earned',false,'reason','not_eligible');end if;
 if new_answer then
  insert into public.quiz_leaf_awards(user_id,attempt_id,fingerprint,grade,total,correct) values(a.user_id,aid,fp,g,n,c) on conflict do nothing returning id into award_id;
 end if;
 return jsonb_build_object('earned',award_id is not null,'earned_now',award_id is not null,'id',award_id,'reason',case when award_id is null then 'same_content_already_earned' else 'earned' end);
end $$;

create or replace function public.quiz_rewards(p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare identity jsonb;g integer;items jsonb;
begin
 identity:=public.quiz_action('library_sessions');if identity->>'role'<>'student' then return jsonb_build_object('awards','[]'::jsonb);end if;
 g:=(identity->>'grade')::integer;
 if p_data ? 'course_id' and p_data->>'course_id'<>'grade'||g||'-115-1' then raise exception 'course_unavailable';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'session_id',a.session_id,'title',coalesce(p.display_name,v.document->>'title'),'grade',w.grade,'total',w.total,'correct',w.correct,'awarded_at',w.awarded_at) order by w.awarded_at),'[]') into items
 from public.quiz_leaf_awards w join public.quiz_attempts a on a.id=w.attempt_id join public.quiz_sessions s on s.id=a.session_id join public.quiz_versions v on v.id=s.version_id left join public.quiz_generated_papers p on p.session_id=s.id
 where w.user_id=auth.uid() and w.grade=g;
 return jsonb_build_object('awards',items);
end $$;
revoke all on function public.quiz_answer_guard(uuid,text,boolean),public.quiz_leaf_result(uuid,boolean) from public,anon,authenticated;
revoke all on function public.quiz_rewards(jsonb) from public,anon;
grant execute on function public.quiz_rewards(jsonb) to authenticated;
commit;
