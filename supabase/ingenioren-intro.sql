-- Read only the first two visible paragraphs in Ingeniøren's article body.
-- Stop at the first embed/ad/container; never collect neighbouring article cards.
create or replace function private.oeldk_ing_public_intro(html text) returns text
language plpgsql immutable set search_path='' as $function$
declare body text; paragraph text; result text:=''; n integer;
begin
body:=substring(html from '<div[[:space:]]+class="mu-body"[[:space:]]*>');
if body is null then return null; end if;
body:=substring(html from position(body in html)+length(body));
for n in 1..2 loop
body:=ltrim(body);
if left(body,3)<>'<p>' or position('</p>' in body)=0 then exit; end if;
paragraph:=substring(body from 4 for position('</p>' in body)-4);
paragraph:=regexp_replace(paragraph,'<[^>]*>',' ','g');
paragraph:=trim(regexp_replace(paragraph,'[[:space:]]+',' ','g'));
if paragraph ~* '(log ind|bliv abonnent|opret abonnement|foto:|illustration:)' then exit; end if;
if length(result||' '||paragraph)>750 then exit; end if;
result:=trim(result||' '||paragraph);
body:=substring(body from position('</p>' in body)+4);
end loop;
return nullif(result,'');
end $function$;
revoke all on function private.oeldk_ing_public_intro(text) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.oeldk_collect_article_previews()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
if req.source='Ingeniøren' and req.url ~ '^https://(www[.])?ing[.]dk/' then
  if length(coalesce(private.oeldk_ing_public_intro(response.content),''))>length(coalesce(description,'')) then
    description:=private.oeldk_ing_public_intro(response.content);
  end if;
end if;
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
end $function$
