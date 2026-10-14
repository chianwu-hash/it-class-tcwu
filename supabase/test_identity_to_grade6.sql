-- Switch the teacher's test account back to Grade 6 (609-30) and its Grade 6
-- roster name (the escaped literal reads "test student" in Chinese). Grade 3
-- pages stop recognising it until test_identity_to_grade3.sql is run. Progress
-- and bindings of both grades are kept.
update public.student_enrollments set class_code='609',display_name=U&'\6E2C\8A66\5B78\751F'
where school_year=115 and email='chianwu@apps.ntpc.edu.tw' and seat_no=30 and class_code in ('609','307')
returning class_code,seat_no,display_name;
