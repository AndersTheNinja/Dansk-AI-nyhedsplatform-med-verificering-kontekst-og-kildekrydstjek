-- Applied through Supabase migration: automate_missing_article_previews.
create table private.oeldk_preview_repairs (
  url text primary key, source text not null, title text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts between 0 and 4),
  next_attempt_at timestamptz not null default now(),
  request_id bigint, requested_at timestamptz,
  completed_at timestamptz, last_result text
);
alter table private.oeldk_preview_repairs enable row level security;
revoke all on private.oeldk_preview_repairs from public,anon,authenticated;

create function private.oeldk_preview_url_allowed(link text) returns boolean
language sql immutable set search_path='' as $$
select coalesce(link ~ '^https://(www[.])?(computerworld[.]dk|journalisten[.]dk|techsavvy[.]media|stiften[.]dk|ing[.]dk|version2[.]dk|berlingske[.]dk|dr[.]dk|nyheder[.]tv2[.]dk|tv2[.]dk|borsen[.]dk|migogaarhus[.]dk|politiken[.]dk|altinget[.]dk)/[^?#[:space:]]+$',false)
$$;
revoke all on function private.oeldk_preview_url_allowed(text) from public,anon,authenticated;

create function public.oeldk_queue_preview_repairs(payload jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare supplied text; expected text; item jsonb; queued integer:=0;
begin
supplied:=coalesce(current_setting('request.headers',true)::jsonb->>'x-oel-ingest-secret','');
select secret into expected from private.ingest_config where id=true;
if expected is null or supplied='' or supplied<>expected then raise exception 'unauthorized'; end if;
if jsonb_typeof(payload) is distinct from 'array' then raise exception 'payload must be an array'; end if;
for item in select value from jsonb_array_elements(payload) limit 100 loop
if not private.oeldk_preview_url_allowed(item->>'url') or length(coalesce(item->>'title','')) not between 5 and 1000 or length(coalesce(item->>'source','')) not between 2 and 100 then continue; end if;
insert into private.oeldk_preview_repairs(url,source,title) values(item->>'url',item->>'source',item->>'title')
on conflict(url) do update set last_seen_at=now();
queued:=queued+1;
end loop;
return queued;
end $$;
revoke all on function public.oeldk_queue_preview_repairs(jsonb) from public;
grant execute on function public.oeldk_queue_preview_repairs(jsonb) to anon,authenticated,service_role;

create function private.oeldk_collect_article_previews() returns integer
language plpgsql security definer set search_path='' as $$
declare req record; response record; actual_title text; description text; queued integer:=0;
begin
-- The advisory lock prevents overlapping runs from duplicating outbound requests.
if not pg_try_advisory_xact_lock(72610525) then return 0; end if;
for req in select * from private.oeldk_preview_repairs where request_id is not null and completed_at is null order by requested_at limit 100 for update loop
-- Look up only this known request before inspecting any text. Binary responses are never parsed.
select status_code,content_type,content into response from net._http_response where id=req.request_id;
if not found then
if req.requested_at>now()-interval '2 minutes' then continue; end if;
update private.oeldk_preview_repairs set request_id=null,last_result='response_missing' where url=req.url;
continue;
end if;
actual_title:=null;description:=null;
if response.status_code=200 and (response.content_type ilike 'text/html%' or response.content_type ilike 'application/xhtml+xml%') then
begin
if octet_length(response.content)<2000000 then
actual_title:=private.oeldk_public_preview_meta(response.content,'og:title');
description:=coalesce(nullif(private.oeldk_public_preview_meta(response.content,'og:description'),''),private.oeldk_public_preview_meta(response.content,'description'));
end if;
exception when invalid_text_representation or character_not_in_repertoire then description:=null;
end;
end if;
if length(coalesce(actual_title,''))>=5 and length(coalesce(description,'')) between 20 and 2500 then
insert into private.oeldk_article_previews(url,source,title,description,refreshed_at) values(req.url,req.source,actual_title,description,now())
on conflict(url) do update set source=excluded.source,title=excluded.title,description=excluded.description,refreshed_at=excluded.refreshed_at;
update private.oeldk_preview_repairs set completed_at=now(),request_id=null,last_result='metadata_received' where url=req.url;
else
update private.oeldk_preview_repairs set request_id=null,last_result='no_preview_http_'||coalesce(response.status_code::text,'error') where url=req.url;
end if;
end loop;
for req in select * from private.oeldk_preview_repairs where completed_at is null and request_id is null and attempts<4 and next_attempt_at<=now() and last_seen_at>now()-interval '7 days' order by next_attempt_at,first_seen_at limit 10 for update loop
if not private.oeldk_preview_url_allowed(req.url) then continue; end if;
update private.oeldk_preview_repairs set request_id=net.http_get(url:=req.url,headers:='{"Accept":"text/html,application/xhtml+xml"}'::jsonb,timeout_milliseconds:=15000),requested_at=now(),attempts=attempts+1,
next_attempt_at=now()+case attempts when 0 then interval '15 minutes' when 1 then interval '1 hour' else interval '6 hours' end,
last_result='requested' where url=req.url;
queued:=queued+1;
end loop;
return queued;
end $$;
revoke all on function private.oeldk_collect_article_previews() from public,anon,authenticated;
select cron.schedule('oeldk-collect-article-previews','*/5 * * * *','select private.oeldk_collect_article_previews();');
