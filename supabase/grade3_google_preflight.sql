-- Read-only checks. Run as DB owner before migration; outputs no passwords.
select 'annual grade3 roster' as check_name,count(*) as row_count from public.student_enrollments
 where school_year=115 and class_code in('301','302','303','304','305','306');
select 'roster/account mismatches' as check_name,count(*) as row_count
 from public.class_card_students c left join public.student_enrollments e
 on e.school_year=115 and e.class_code=c.class_code and e.seat_no=c.seat_no
 where c.course_id='grade3-115-1' and c.class_code in('301','302','303','304','305','306') and c.active and
 (e.email is null or lower(c.practice_account || '@apps.ntpc.edu.tw') is distinct from e.email or trim(c.display_name) is distinct from trim(e.display_name));
select 'annual students without active historical card' as check_name,count(*) as row_count
from public.student_enrollments e left join public.class_card_students c
on c.course_id='grade3-115-1' and c.class_code=e.class_code and c.seat_no=e.seat_no and c.active
where e.school_year=115 and e.class_code in('301','302','303','304','305','306') and c.student_code is null;
select 'historical sources requiring teacher comparison (transfers may be legitimate)' as check_name,count(*) as row_count
from public.guest_progress g left join public.class_card_students c on c.course_id=g.course_id and c.student_code=g.student_code
where g.course_id='grade3-115-1' and (c.student_code is null or g.class_code is distinct from c.class_code or g.seat_no is distinct from c.seat_no or trim(g.display_name) is distinct from trim(c.display_name));
select 'preexisting formal rows require explicit reviewed snapshots' as check_name,count(*) as row_count
from public.student_progress where course_id='grade3-115-1';
with allowed(week_code,activity_key,total) as (values
 ('02','quiz_posture_5',5),('02','window_practice_5',5),('02','typing_task_4',4),('02','typing_task_5',5),
 ('03','quiz_device_safety_5',5),('03','typing_task_6',6),('04','typing_task_6',6),('05','typing_task_5',6))
select 'unknown/invalid source activities' as check_name,count(*) as row_count
from public.guest_progress g left join allowed a using(week_code,activity_key)
where g.course_id='grade3-115-1' and (a.total is null or g.current_level is null or g.completed is null or g.current_level not between 1 and a.total or g.score not between 0 and a.total
 or g.completed is distinct from (coalesce(g.score,g.current_level-1)=a.total) or g.current_level<>least(coalesce(g.score,g.current_level-1)+1,a.total));
select course_id,week_code,activity_key,count(*) as records,count(*) filter(where completed) as completed_records
from public.guest_progress where course_id='grade3-115-1' group by 1,2,3 order by 2,3;
