-- 2026-11-11 已經使用者授權套用。僅限 partner-practice-staging / jazeolkwueoexcgkxhzr。
-- 執行器必須先核對 Supabase 專案及帳號；SQL 本身不能辨識雲端 project ref。
-- 執行前重新核對 ACL/RLS 快照、函式 owner/security_definer 與部署來源。
-- 本次實際套用器另有全部 40 表 ACL/RLS 及 42 函式指紋／ACL 的交易內防漂移檢查。
-- 不可套用至正式 upxgyusodibaqcrocdzj；這不是正式課程庫的 migration。
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
ALTER TABLE public.garden_growth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garden_reward_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_generated_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_learning_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_learning_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_past_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE
  public.garden_growth,
  public.garden_reward_catalog,
  public.quiz_generated_papers,
  public.quiz_learning_leaves,
  public.quiz_learning_settings,
  public.quiz_media_assets,
  public.quiz_past_papers,
  public.quiz_sessions,
  public.student_enrollments,
  public.student_progress
FROM PUBLIC, anon, authenticated;
COMMIT;
