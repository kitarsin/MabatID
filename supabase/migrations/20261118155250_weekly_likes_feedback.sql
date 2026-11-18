-- Anonymous engagement only. Device profiles and ID progress are never uploaded here.
begin;

create table public.mabatid_weekly_likes (
  week_start date not null,
  browser_hash text not null check (browser_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (week_start, browser_hash),
  check (extract(isodow from week_start) = 1)
);
create table public.mabatid_feedback (
  id bigint generated always as identity primary key,
  browser_hash text not null check (browser_hash ~ '^[a-f0-9]{64}$'),
  submission_id uuid not null,
  message text not null check (char_length(btrim(message)) between 10 and 2000),
  rating smallint check (rating between 1 and 5),
  status text not null default 'new' check (status in ('new', 'reviewed', 'archived')),
  created_at timestamptz not null default clock_timestamp(),
  unique (browser_hash, submission_id)
);
create index mabatid_feedback_created_idx on public.mabatid_feedback(created_at desc);
create table public.mabatid_engagement_limits (
  bucket text not null check (length(bucket) between 1 and 128),
  window_start timestamptz not null,
  hits integer not null check (hits > 0),
  expires_at timestamptz not null,
  primary key (bucket, window_start)
);
create index mabatid_engagement_limits_expiry_idx on public.mabatid_engagement_limits(expires_at);

alter table public.mabatid_weekly_likes enable row level security;
alter table public.mabatid_feedback enable row level security;
alter table public.mabatid_engagement_limits enable row level security;
revoke all on public.mabatid_weekly_likes, public.mabatid_feedback, public.mabatid_engagement_limits from public, anon, authenticated;
revoke all on sequence public.mabatid_feedback_id_seq from public, anon, authenticated;
grant select, insert, update, delete on public.mabatid_weekly_likes, public.mabatid_feedback, public.mabatid_engagement_limits to service_role;
grant usage, select on sequence public.mabatid_feedback_id_seq to service_role;

create function public.mabatid_like_tally(p_browser_hash text) returns jsonb
language sql volatile security invoker set search_path = '' as $$
  with current_week as (
    select date_trunc('week', clock_timestamp() at time zone 'Asia/Manila')::date as start
  )
  select jsonb_build_object(
    'week', to_char(w.start, 'YYYY-MM-DD'),
    'nextResetAt', (w.start + interval '7 days') at time zone 'Asia/Manila',
    'count', (select count(*) from public.mabatid_weekly_likes l where l.week_start = w.start),
    'liked', exists (select 1 from public.mabatid_weekly_likes l where l.week_start = w.start and l.browser_hash = p_browser_hash)
  ) from current_week w
$$;

create function public.mabatid_like_add(p_browser_hash text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_week date; v_inserted boolean; v_tally jsonb;
begin
  v_week := date_trunc('week', clock_timestamp() at time zone 'Asia/Manila')::date;
  insert into public.mabatid_weekly_likes(week_start, browser_hash) values (v_week, p_browser_hash)
    on conflict (week_start, browser_hash) do nothing;
  v_inserted := found;
  -- Use the same captured week even if this transaction crosses midnight.
  select jsonb_build_object(
    'week', to_char(v_week, 'YYYY-MM-DD'),
    'nextResetAt', (v_week + interval '7 days') at time zone 'Asia/Manila',
    'count', (select count(*) from public.mabatid_weekly_likes where week_start = v_week),
    'liked', true, 'already', not v_inserted
  ) into v_tally;
  return v_tally;
end $$;

create function public.mabatid_engagement_rate(p_bucket text, p_limit integer, p_seconds integer) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare v_window timestamptz; v_hits integer;
begin
  if p_limit not between 1 and 10000 or p_seconds not between 1 and 3600 then raise exception 'Invalid rate window'; end if;
  -- Index-backed cleanup also runs on busy sites without a scheduled job.
  delete from public.mabatid_engagement_limits where expires_at <= clock_timestamp();
  v_window := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_seconds) * p_seconds);
  insert into public.mabatid_engagement_limits as limits(bucket, window_start, hits, expires_at)
  values (p_bucket, v_window, 1, v_window + make_interval(secs => p_seconds * 2))
  on conflict (bucket, window_start) do update set hits = least(limits.hits + 1, p_limit + 1)
  returning hits into v_hits;
  return v_hits <= p_limit;
end $$;

create function public.mabatid_feedback_submit(p_browser_hash text, p_submission_id uuid, p_message text, p_rating smallint) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.mabatid_feedback(browser_hash, submission_id, message, rating)
  values (p_browser_hash, p_submission_id, p_message, p_rating)
  on conflict (browser_hash, submission_id) do nothing;
  -- A retry can confirm its own identical submission, never replace a saved message.
  return exists (select 1 from public.mabatid_feedback where browser_hash = p_browser_hash
    and submission_id = p_submission_id and message = p_message and rating is not distinct from p_rating);
end $$;

revoke all on function public.mabatid_like_tally(text), public.mabatid_like_add(text),
  public.mabatid_engagement_rate(text,integer,integer), public.mabatid_feedback_submit(text,uuid,text,smallint) from public, anon, authenticated;
grant execute on function public.mabatid_like_tally(text), public.mabatid_like_add(text),
  public.mabatid_engagement_rate(text,integer,integer), public.mabatid_feedback_submit(text,uuid,text,smallint) to service_role;
notify pgrst, 'reload schema';
commit;
