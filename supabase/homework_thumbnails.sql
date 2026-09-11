begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('homework-thumbnails','homework-thumbnails',false,65536,array['image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=65536,allowed_mime_types=array['image/jpeg'];

create or replace function public.homework_thumbnail_access(object_name text,writing boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.homework_uploads u
  join public.homework_assignments a on a.id=u.assignment_id
  join auth.users x on x.id=auth.uid() and x.email_confirmed_at is not null
  where object_name=a.id::text||'/'||u.id::text||'.jpg' and u.submitted_at is not null
  and (u.file_name ~* '\.(png|jpe?g|webp|gif)$')
  and (
   (coalesce(public.is_teacher(),false) and a.owner_user_id=x.id)
   or (not coalesce(public.is_teacher(),false) and u.user_id=x.id and a.state<>'draft'
    and exists(select 1 from public.student_enrollments e where e.school_year=115 and e.email=lower(x.email)
     and e.class_code like '6%' and a.class_code in ('*',e.class_code))
    and (not writing or exists(select 1 from public.homework_submissions s where s.upload_id=u.id and s.status='submitted')))
  )
 );
$$;
revoke all on function public.homework_thumbnail_access(text,boolean) from public,anon;
grant execute on function public.homework_thumbnail_access(text,boolean) to authenticated;
drop policy if exists homework_thumbnail_read on storage.objects;
create policy homework_thumbnail_read on storage.objects for select to authenticated
using(bucket_id='homework-thumbnails' and public.homework_thumbnail_access(name,false));
drop policy if exists homework_thumbnail_insert on storage.objects;
create policy homework_thumbnail_insert on storage.objects for insert to authenticated
with check(bucket_id='homework-thumbnails' and public.homework_thumbnail_access(name,true));
-- Immutable per submitted version. No client UPDATE or DELETE policy.
notify pgrst,'reload schema';
commit;
