-- Switch the teacher's test account to Grade 3 (307-30) under the name on the
-- 307-30 class card. Grade 6 homework, reading and foundation stop recognising
-- it until test_identity_to_grade6.sql is run. Progress and bindings of both
-- grades are kept.
update public.student_enrollments e set class_code='307',display_name=trim(c.display_name)
from public.class_card_students c
where c.course_id='grade3-115-1' and c.class_code='307' and c.seat_no=30 and c.active
  and e.school_year=115 and e.email='chianwu@apps.ntpc.edu.tw' and e.seat_no=30 and e.class_code in ('609','307')
returning e.class_code,e.seat_no,e.display_name;
