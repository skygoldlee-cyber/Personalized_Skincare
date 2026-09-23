-- Passmula Supabase 스키마 — docs/dev/SUPABASE_DESIGN.md §3
-- 실행 방법: Supabase 대시보드 → SQL Editor → New query → 이 파일 전체 붙여넣기 → Run
-- 재실행 안전 (IF NOT EXISTS / OR REPLACE 사용)

-- ============================================================
-- 1) profiles — 계정별 Pro 플랜 (entitlement는 서버가 보유)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','pro')),
  pro_since timestamptz,
  created_at timestamptz not null default now()
);

-- 가입 시 profiles 행 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2) sync_snapshots — 시험별 진도 스냅샷 (backup.js 논리 키→값 JSON)
-- ============================================================
create table if not exists public.sync_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  device_id text not null,
  primary key (user_id, exam_id)
);

-- ============================================================
-- 3) pro_codes — Pro 활성화 코드 (Phase 3용, 미리 생성)
-- ============================================================
create table if not exists public.pro_codes (
  code text primary key,
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 코드 사용: 유효한 미사용 코드면 plan='pro'로 갱신하고 true 반환
create or replace function public.redeem_code(p_code text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_code public.pro_codes%rowtype;
begin
  if auth.uid() is null then
    return false;
  end if;
  select * into v_code from public.pro_codes
    where code = p_code and redeemed_by is null;
  if not found then
    return false;
  end if;
  update public.pro_codes
    set redeemed_by = auth.uid(), redeemed_at = now()
    where code = p_code;
  update public.profiles
    set plan = 'pro', pro_since = now()
    where id = auth.uid();
  return true;
end;
$$;

-- ============================================================
-- 4) Row Level Security — 모든 테이블에서 자기 데이터만 접근
-- ============================================================
alter table public.profiles enable row level security;
alter table public.sync_snapshots enable row level security;
alter table public.pro_codes enable row level security;

-- profiles: 본인 행 읽기만 (plan 갱신은 redeem_code RPC만 가능)
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles
  for select using (auth.uid() = id);

-- sync_snapshots: 본인 행 CRUD
drop policy if exists "own snapshots" on public.sync_snapshots;
create policy "own snapshots" on public.sync_snapshots
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- pro_codes: 클라이언트 직접 접근 금지 (정책 없음 = 모든 접근 차단, RPC만 사용)

-- ============================================================
-- 확인 쿼리 (선택): 실행 후 테이블 3개·정책 2개·함수 2개가 보이면 성공
--   select table_name from information_schema.tables where table_schema='public';
--   select polname, polrelid::regclass from pg_policy;
-- ============================================================
