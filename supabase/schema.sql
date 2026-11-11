-- =====================================================================
-- ลึกทีละชั้น : โครงสร้างฐานข้อมูล (ใช้ร่วมกับโปรเจกต์ Supabase ที่มีอยู่แล้วได้)
-- ทุกอย่างขึ้นต้นด้วย lth_ และไฟล์นี้แตะเฉพาะของตัวเองเท่านั้น
-- ไม่มีคำสั่งใดเปลี่ยนสิทธิ์ ตาราง หรือ Realtime ของแอปอื่นในโปรเจกต์
-- รันไฟล์นี้ก่อน แล้วค่อยรัน seed.sql
-- =====================================================================

-- ---------- ตาราง ----------
create table if not exists public.lth_questions (
  id      serial primary key,
  level   smallint not null check (level between 0 and 2),
  rope    smallint not null check (rope between 0 and 5),
  text    text not null check (char_length(text) between 1 and 300),
  active  boolean not null default true
);
create index if not exists lth_questions_level_idx on public.lth_questions (level) where active;

-- สถานะเต็มของห้อง (ลับ)
create table if not exists public.lth_rooms (
  code        text primary key check (code ~ '^[A-Z0-9]{6}$'),
  state       jsonb not null,
  version     integer not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists lth_rooms_updated_idx on public.lth_rooms (updated_at);

-- มุมมองสาธารณะของห้อง (ไม่มีไพ่ในมือ) ใช้กับ Realtime
create table if not exists public.lth_room_views (
  code        text primary key references public.lth_rooms(code) on delete cascade,
  view        jsonb not null,
  version     integer not null,
  updated_at  timestamptz not null default now()
);

-- token ของผู้เล่น เก็บเป็น hash เท่านั้น
create table if not exists public.lth_room_players (
  room_code   text not null references public.lth_rooms(code) on delete cascade,
  player_id   text not null,
  token_hash  text not null check (char_length(token_hash) = 64),
  created_at  timestamptz not null default now(),
  primary key (room_code, player_id),
  unique (room_code, token_hash)
);

-- ตัวนับ rate limit
create table if not exists public.lth_rate_limits (
  key           text primary key,
  window_start  timestamptz not null,
  count         integer not null
);
create index if not exists lth_rate_limits_window_idx on public.lth_rate_limits (window_start);

-- ---------- Row Level Security (เฉพาะตาราง lth_) ----------
alter table public.lth_questions    enable row level security;
alter table public.lth_rooms        enable row level security;
alter table public.lth_room_views   enable row level security;
alter table public.lth_room_players enable row level security;
alter table public.lth_rate_limits  enable row level security;

-- ฝั่งเว็บเขียนตรงไม่ได้ทุกตาราง และอ่านไม่ได้เลยในตารางลับ
revoke insert, update, delete, truncate on
  public.lth_questions, public.lth_rooms, public.lth_room_views, public.lth_room_players, public.lth_rate_limits
  from anon, authenticated;
revoke all on public.lth_rooms, public.lth_room_players, public.lth_rate_limits from anon, authenticated;
revoke all on sequence public.lth_questions_id_seq from anon, authenticated;

drop policy if exists "lth read active questions" on public.lth_questions;
create policy "lth read active questions" on public.lth_questions
  for select to anon, authenticated using (active);

drop policy if exists "lth read fresh room views" on public.lth_room_views;
create policy "lth read fresh room views" on public.lth_room_views
  for select to anon, authenticated using (updated_at > now() - interval '1 day');
-- lth_rooms, lth_room_players, lth_rate_limits ไม่มี policy = ฝั่งเว็บเข้าไม่ได้

-- ---------- Realtime: เพิ่มเฉพาะ lth_room_views ----------
do $$ begin
  alter publication supabase_realtime add table public.lth_room_views;
exception when duplicate_object then null; end $$;

-- ---------- ฟังก์ชัน (เรียกได้เฉพาะ service role) ----------
create or replace function public.lth_create_room(
  p_code text, p_state jsonb, p_view jsonb, p_player_id text, p_token_hash text
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into lth_rooms(code, state, version) values (p_code, p_state, 1);
  insert into lth_room_views(code, view, version) values (p_code, p_view, 1);
  insert into lth_room_players(room_code, player_id, token_hash) values (p_code, p_player_id, p_token_hash);
  return true;
exception when unique_violation then
  return false;
end $$;

-- อัปเดตห้องแบบตรวจเวอร์ชัน คืนเวอร์ชันใหม่ หรือ null ถ้ามีคนเขียนแทรกก่อน/ห้องหมดอายุ
create or replace function public.lth_commit_room(
  p_code text, p_expected integer, p_state jsonb, p_view jsonb,
  p_add_player text default null, p_add_hash text default null,
  p_remove_players text[] default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  update lth_rooms set state = p_state, version = version + 1, updated_at = now()
   where code = p_code and version = p_expected and updated_at > now() - interval '1 day'
  returning version into v;
  if v is null then return null; end if;

  update lth_room_views set view = p_view, version = v, updated_at = now() where code = p_code;
  if p_add_player is not null then
    insert into lth_room_players(room_code, player_id, token_hash) values (p_code, p_add_player, p_add_hash);
  end if;
  if p_remove_players is not null then
    delete from lth_room_players where room_code = p_code and player_id = any(p_remove_players);
  end if;
  return v;
end $$;

-- rate limit แบบ fixed window คืน true ถ้ายังไม่เกิน
create or replace function public.lth_rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare c integer;
begin
  insert into lth_rate_limits(key, window_start, count) values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when lth_rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1 else lth_rate_limits.count + 1 end,
    window_start = case when lth_rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now() else lth_rate_limits.window_start end
  returning count into c;
  return c <= p_limit;
end $$;

-- ลบห้องที่ไม่ขยับเกิน 1 วัน และตัวนับเก่า
create or replace function public.lth_cleanup_stale_rooms() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from lth_rooms where updated_at < now() - interval '1 day';
  get diagnostics n = row_count;
  delete from lth_rate_limits where window_start < now() - interval '1 hour';
  return n;
end $$;

revoke all on function public.lth_create_room(text, jsonb, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.lth_commit_room(text, integer, jsonb, jsonb, text, text, text[]) from public, anon, authenticated;
revoke all on function public.lth_rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.lth_cleanup_stale_rooms() from public, anon, authenticated;
grant execute on function public.lth_create_room(text, jsonb, jsonb, text, text) to service_role;
grant execute on function public.lth_commit_room(text, integer, jsonb, jsonb, text, text, text[]) to service_role;
grant execute on function public.lth_rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.lth_cleanup_stale_rooms() to service_role;

-- ---------- ล้างห้องอัตโนมัติทุก 15 นาที ----------
create extension if not exists pg_cron;
do $$ begin
  perform cron.unschedule('lth-cleanup-stale-rooms');
exception when others then null; end $$;
select cron.schedule('lth-cleanup-stale-rooms', '*/15 * * * *', 'select public.lth_cleanup_stale_rooms()');
