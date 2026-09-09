-- Apply after student_progress.sql (existing public.is_teacher()) exists.
-- Separate from all student progress, classroom, grading, and roster tables.
begin;

create table if not exists public.drive_connections (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  drive_email text not null check (drive_email = 'th990821@mail.thps.ntpc.edu.tw'),
  google_subject text not null,
  token_envelope jsonb not null,
  scopes text[] not null,
  connected_at timestamptz not null default now()
);
create table if not exists public.drive_oauth_states (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  state_hash text not null unique,
  proof_hash text not null,
  expires_at timestamptz not null
);
alter table public.drive_connections enable row level security;
alter table public.drive_oauth_states enable row level security;
revoke all on public.drive_connections, public.drive_oauth_states from public, anon, authenticated;
grant select, insert, update on public.drive_connections to service_role;

create or replace function public.drive_begin_oauth(p_user_id uuid, p_state_hash text, p_proof_hash text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if length(p_state_hash) <> 43 or length(p_proof_hash) <> 43 then
    raise exception 'invalid oauth state';
  end if;
  delete from public.drive_oauth_states where expires_at <= now();
  insert into public.drive_oauth_states (owner_user_id, state_hash, proof_hash, expires_at)
  values (p_user_id, p_state_hash, p_proof_hash, now() + interval '10 minutes')
  on conflict (owner_user_id) do update set
    state_hash = excluded.state_hash, proof_hash = excluded.proof_hash, expires_at = excluded.expires_at;
end;
$$;

create or replace function public.drive_claim_oauth(p_user_id uuid, p_state_hash text, p_proof_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed uuid;
begin
  delete from public.drive_oauth_states
  where owner_user_id = p_user_id and state_hash = p_state_hash and proof_hash = p_proof_hash
    and expires_at > now()
  returning owner_user_id into claimed;
  return claimed is not null;
end;
$$;
revoke all on function public.drive_begin_oauth(uuid, text, text) from public, anon, authenticated;
revoke all on function public.drive_claim_oauth(uuid, text, text) from public, anon, authenticated;
grant execute on function public.drive_begin_oauth(uuid, text, text) to service_role;
grant execute on function public.drive_claim_oauth(uuid, text, text) to service_role;
commit;
