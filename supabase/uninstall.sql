-- ลบทุกอย่างของเกมลึกทีละชั้นออกจากโปรเจกต์ (ไม่แตะตารางอื่น)
do $$ begin perform cron.unschedule('lth-cleanup-stale-rooms'); exception when others then null; end $$;
do $$ begin alter publication supabase_realtime drop table public.lth_room_views; exception when others then null; end $$;
drop function if exists public.lth_create_room(text, jsonb, jsonb, text, text);
drop function if exists public.lth_commit_room(text, integer, jsonb, jsonb, text, text, text[]);
drop function if exists public.lth_rate_limit_hit(text, integer, integer);
drop function if exists public.lth_cleanup_stale_rooms();
drop table if exists public.lth_room_players, public.lth_room_views, public.lth_rooms, public.lth_rate_limits, public.lth_questions;
