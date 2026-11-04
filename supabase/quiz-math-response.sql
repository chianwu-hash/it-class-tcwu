-- Opt-in final answers with preserved working; never evaluates user SQL/code.
create or replace function public.quiz_math_answer_normalize(input text)
returns text language plpgsql immutable set search_path='' as $math$
declare s text;n bigint;d bigint;a bigint;b bigint;t bigint;parts text[];fraction text;
begin
 if input is null or length(input)>250 then raise exception 'invalid_response';end if;
 s:=lower(regexp_replace(translate(input,'０１２３４５６７８９（）＋－＊／，＜＞＝−–—×÷','0123456789()+-*/,<>=---*/'),'[[:space:]　]','','g'));
 s:=replace(replace(replace(replace(s,'π','pi'),'√','sqrt'),'·','*'),'⋅','*');
 s:=translate(s,'ｒＲｄＤｐＰｉＩ','rrddppii');
 s:=regexp_replace(s,'sqrt([0-9]+)','sqrt(\1)','g');
 s:=regexp_replace(s,'\((pi|sqrt\([0-9]+\)|[a-z])\)','\1','g');
 s:=regexp_replace(s,'^\(([+-]?[0-9]{1,9}/[0-9]{1,9})\)\*?(pi|sqrt\([0-9]+\))$','\1*\2');
 -- Keep division grouping explicit: 8/3*pi means (8/3)*pi, never 8/(3*pi).
 s:=regexp_replace(s,'^([+-]?[0-9]{1,9})/([0-9]{1,9})\*(pi|sqrt\([0-9]+\))$','\1\3/\2');
 s:=regexp_replace(s,'([0-9)])\*(pi|sqrt|\()','\1\2','g');
 if length(s)=0 or s!~'^[a-z0-9()+*/.,<>=-]+$' then raise exception 'invalid_response';end if;
 if s~'^\([^,]*,[^,]*\)$' then
  parts:=string_to_array(substr(s,2,length(s)-2),',');
  return '('||public.quiz_math_answer_normalize(parts[1])||','||public.quiz_math_answer_normalize(parts[2])||')';
 end if;
 while s~'^\([+0-9./-]+\)$' loop s:=substr(s,2,length(s)-2);end loop;
 if s~'^[+-]?[0-9]{1,12}$' then return (s::bigint)::text;end if;
 if s~'^[+-]?[0-9]{1,9}/[0-9]{1,9}$' then n:=split_part(s,'/',1)::bigint;d:=split_part(s,'/',2)::bigint;
 elsif s~'^[+-]?[0-9]{1,9}\.[0-9]{1,8}$' then
  fraction:=split_part(s,'.',2);d:=power(10::numeric,length(fraction))::bigint;n:=(s::numeric*d)::bigint;
 else return s;end if;
 if d=0 then raise exception 'invalid_response';end if;
 a:=abs(n);b:=d;while b<>0 loop t:=a%b;a:=b;b:=t;end loop;
 n:=n/a;d:=d/a;return case when d=1 then n::text else n::text||'/'||d::text end;
end $math$;
revoke all on function public.quiz_math_answer_normalize(text) from public,anon,authenticated;
