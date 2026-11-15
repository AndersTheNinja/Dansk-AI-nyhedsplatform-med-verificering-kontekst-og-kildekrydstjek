begin;

create schema if not exists net;
revoke all on schema net, private from public;
create table if not exists private.ingest_config (
  id boolean primary key default true check (id),
  secret text not null
);
create table if not exists private.site_presence (
  visitor_id text primary key,
  last_seen timestamptz not null default now()
);
create table if not exists net.http_request_queue (
  id bigint generated always as identity (start with 1000000000000) primary key,
  url text not null,
  headers jsonb not null,
  timeout_milliseconds integer not null,
  created timestamptz not null default now()
);
create table if not exists net._http_response (
  id bigint primary key,
  status_code integer,
  content_type text,
  headers jsonb,
  content text,
  timed_out boolean not null default false,
  error_msg text,
  created timestamptz not null default now()
);

create or replace function net.http_get(
  url text,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb,
  timeout_milliseconds integer default 10000
) returns bigint language sql set search_path = pg_catalog as $$
  insert into net.http_request_queue(url, headers, timeout_milliseconds)
  values ($1, $3, least(greatest($4, 1000), 20000))
  returning id
$$;
revoke execute on all functions in schema public, private, net from public;

commit;
