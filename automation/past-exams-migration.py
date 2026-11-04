"""從全新安裝SQL擷取批次所需函數；不變更正式資料。"""
import re
from pathlib import Path
s=Path('supabase/quiz-past-exams.sql').read_text(encoding='utf-8')
functions=[re.search(r'create or replace function public.quiz_past_has_media\(.*?\n\$\$;',s,re.S).group(0)]
functions += [re.search(r'create or replace function public.quiz_past_'+name+r'\(.*?\nend \$\$;',s,re.S).group(0) for name in ['canonical','validate','snapshot','action']]
functions += [re.search(r'create or replace function public.quiz_media_access\(.*?\nend\$\$;',s,re.S).group(0)]
Path('supabase/quiz-past-batch-114.sql').write_text('-- Additive function update; leaves immutable versions and existing student rows intact.\nbegin;\n'+ '\n\n'.join(functions)+'\nrevoke all on function public.quiz_past_has_media(jsonb,text) from public,anon,authenticated;\ncommit;\n',encoding='utf-8')
