-- Temporary relay only. Permanent profiles remain in browser storage.
-- Explicit grants matter on both old and new Supabase projects.
begin;
create table public.mabatid_transfers (
  id uuid primary key,
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  owner_hash text not null check (owner_hash ~ '^[a-f0-9]{64}$'),
  ciphertext text check (octet_length(ciphertext) <= 3145728),
  claim_hash text check (claim_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '10 minutes'),
  completed_at timestamptz,
  constraint mabatid_transfer_lifetime check (expires_at > created_at and expires_at <= created_at + interval '11 minutes'),
  constraint mabatid_transfer_payload check ((completed_at is null and ciphertext is not null) or (completed_at is not null and ciphertext is null))
);
create index mabatid_transfers_expiry_idx on public.mabatid_transfers(expires_at);
alter table public.mabatid_transfers enable row level security;
revoke all on public.mabatid_transfers from public, anon, authenticated;
grant select, insert, update, delete on public.mabatid_transfers to service_role;

create table public.mabatid_transfer_limits (
  bucket text not null check (length(bucket) <= 128),
  window_start timestamptz not null,
  hits integer not null check (hits > 0),
  expires_at timestamptz not null,
  primary key (bucket, window_start)
);
create index mabatid_transfer_limits_expiry_idx on public.mabatid_transfer_limits(expires_at);
alter table public.mabatid_transfer_limits enable row level security;
revoke all on public.mabatid_transfer_limits from public, anon, authenticated;
grant select, insert, update, delete on public.mabatid_transfer_limits to service_role;

create function public.mabatid_transfer_health() returns integer
language sql stable security invoker set search_path = ''
as $$ select 1 $$;

-- Each hit is committed even when the limit has been reached (do not raise/roll back).
create function public.mabatid_transfer_rate(p_bucket text, p_limit integer, p_seconds integer) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare v_window timestamptz; v_hits integer;
begin
  if p_limit not between 1 and 10000 or p_seconds not between 1 and 3600 then raise exception 'Invalid rate window'; end if;
  v_window := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_seconds) * p_seconds);
  insert into public.mabatid_transfer_limits as limits(bucket, window_start, hits, expires_at)
  values (p_bucket, v_window, 1, v_window + make_interval(secs => p_seconds * 2))
  on conflict (bucket, window_start) do update set hits = least(limits.hits + 1, p_limit + 1)
  returning hits into v_hits;
  return v_hits <= p_limit;
end $$;

create function public.mabatid_transfer_create(p_id uuid, p_code_hash text, p_owner_hash text, p_ciphertext text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_row public.mabatid_transfers; v_count bigint; v_bytes bigint;
begin
  -- Bound anonymous storage globally; short lock covers only this DB transaction.
  perform pg_advisory_xact_lock(633720161);
  delete from public.mabatid_transfers where expires_at <= clock_timestamp();
  select * into v_row from public.mabatid_transfers where id = p_id;
  if found then
    if v_row.owner_hash <> p_owner_hash or v_row.completed_at is not null then return null; end if;
  else
    select count(*), coalesce(sum(octet_length(ciphertext)),0) into v_count, v_bytes from public.mabatid_transfers;
    if v_count >= 128 or v_bytes + octet_length(p_ciphertext) > 33554432 then return jsonb_build_object('full',true); end if;
    insert into public.mabatid_transfers(id, code_hash, owner_hash, ciphertext)
    values (p_id, p_code_hash, p_owner_hash, p_ciphertext) returning * into v_row;
  end if;
  return jsonb_build_object('id',v_row.id,'ciphertext',v_row.ciphertext,'expiresAt',v_row.expires_at);
end $$;

create function public.mabatid_transfer_claim(p_code_hash text, p_claim_hash text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_row public.mabatid_transfers;
begin
  select * into v_row from public.mabatid_transfers
    where code_hash = p_code_hash and expires_at > clock_timestamp() for update;
  if not found then return null; end if;
  if v_row.claim_hash is not null and v_row.claim_hash <> p_claim_hash then return null; end if;
  if v_row.completed_at is not null then
    return jsonb_build_object('id',v_row.id,'completed',true,'expiresAt',v_row.expires_at);
  end if;
  update public.mabatid_transfers set claim_hash = p_claim_hash where id = v_row.id;
  return jsonb_build_object('id',v_row.id,'completed',false,'ciphertext',v_row.ciphertext,'expiresAt',v_row.expires_at);
end $$;

create function public.mabatid_transfer_finish(p_id uuid, p_claim_hash text) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  -- A tiny tombstone makes acknowledgments retryable; the personal payload is erased immediately.
  update public.mabatid_transfers set ciphertext = null, completed_at = coalesce(completed_at,clock_timestamp())
    where id = p_id and claim_hash = p_claim_hash;
  return found;
end $$;

create function public.mabatid_transfer_release(p_id uuid, p_claim_hash text) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  update public.mabatid_transfers set claim_hash = null
    where id = p_id and claim_hash = p_claim_hash and completed_at is null;
  return found;
end $$;

create function public.mabatid_transfer_revoke(p_id uuid, p_owner_hash text) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.mabatid_transfers where id = p_id and owner_hash = p_owner_hash;
  return found;
end $$;

create function public.mabatid_transfer_cleanup() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.mabatid_transfers where expires_at <= clock_timestamp();
  delete from public.mabatid_transfer_limits where expires_at <= clock_timestamp();
end $$;

-- Revoke PUBLIC's implicit function execute and Supabase's explicit default grants.
revoke all on function public.mabatid_transfer_health() from public, anon, authenticated;
revoke all on function public.mabatid_transfer_rate(text,integer,integer) from public, anon, authenticated;
revoke all on function public.mabatid_transfer_create(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.mabatid_transfer_claim(text,text) from public, anon, authenticated;
revoke all on function public.mabatid_transfer_finish(uuid,text) from public, anon, authenticated;
revoke all on function public.mabatid_transfer_release(uuid,text) from public, anon, authenticated;
revoke all on function public.mabatid_transfer_revoke(uuid,text) from public, anon, authenticated;
revoke all on function public.mabatid_transfer_cleanup() from public, anon, authenticated;
grant execute on function public.mabatid_transfer_health(), public.mabatid_transfer_rate(text,integer,integer),
 public.mabatid_transfer_create(uuid,text,text,text), public.mabatid_transfer_claim(text,text),
 public.mabatid_transfer_finish(uuid,text), public.mabatid_transfer_release(uuid,text),
 public.mabatid_transfer_revoke(uuid,text), public.mabatid_transfer_cleanup() to service_role;
notify pgrst, 'reload schema';
commit;
