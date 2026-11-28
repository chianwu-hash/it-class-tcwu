-- Candidate: preserve authentication and registration semantics while avoiding
-- a conflict-row lock when the current student's registration is already exact.
-- Apply only after review/authorization, from the merged main source.
BEGIN;

DO $guard$
BEGIN
  IF (SELECT md5(pg_get_functiondef(p.oid))
      FROM pg_proc p
      WHERE p.oid=to_regprocedure('partner_pilot.register_self()'))
      IS DISTINCT FROM '38ed977b2ca39d46bf998afd312eb291' THEN
    RAISE EXCEPTION 'REGISTER_SELF_SOURCE_CHANGED';
  END IF;
END
$guard$;

CREATE OR REPLACE FUNCTION partner_pilot.register_self()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare label text;
begin
 if not partner_pilot.can_access() then raise exception 'ACCESS_DENIED';end if;
 select e.class_code||'班'||e.seat_no||'號 '||e.display_name into strict label from auth.users u join public.student_enrollments e on e.email=lower(u.email) and e.school_year=115 where u.id=auth.uid();
 -- Keep the eligibility check above, even for an existing active registration.
 if exists(select 1 from partner_pilot.allowed_users a where a.user_id=auth.uid() and a.active and a.display_name=label) then return;end if;
 insert into partner_pilot.allowed_users(user_id,display_name) values(auth.uid(),label) on conflict(user_id) do update set display_name=excluded.display_name,active=true where partner_pilot.allowed_users.display_name is distinct from excluded.display_name or not partner_pilot.allowed_users.active;
end $function$;

-- CREATE OR REPLACE preserves the existing owner and execution ACL.
DO $verify$
BEGIN
  IF (SELECT md5(pg_get_functiondef('partner_pilot.register_self()'::regprocedure)))
      IS DISTINCT FROM 'dc06cd3396d2567036e43b8c3eb2a4ea' THEN
    RAISE EXCEPTION 'REGISTER_SELF_RESULT_MISMATCH';
  END IF;
END
$verify$;
COMMIT;
