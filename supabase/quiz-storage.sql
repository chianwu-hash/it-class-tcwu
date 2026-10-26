-- 正式 Storage 候選設定；不由本機 PGlite 執行。沒有學生／教師直接物件存取 policy。
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('quiz-media','quiz-media',false,8388608,array['image/png','image/jpeg','image/gif','image/webp','audio/mpeg','audio/wav','audio/ogg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
