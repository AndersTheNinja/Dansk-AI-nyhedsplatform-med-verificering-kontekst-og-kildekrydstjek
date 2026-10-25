-- Enrich only publisher-specific public article containers. Never use arbitrary
-- page paragraphs, subscription previews marked hidden, or embedded paid bodies.
create or replace function private.oeldk_public_article_intro(html text, source text) returns text
language plpgsql immutable set search_path='' as $function$
declare scope text; marker text; p record; paragraph text; result text:=''; doc jsonb; article jsonb; node jsonb; n integer:=0; tag text;
begin
foreach tag in array array['script','style','noscript','figure','figcaption','aside','nav','header','footer'] loop
  html:=regexp_replace(html,'<'||tag||'[^>]*>(?:(?!</'||tag||'>).)*</'||tag||'>',' ','gis');
end loop;
-- Berlingske data is handled separately below, before script removal.
if source in ('DR','Danmarks Radio','DR Nyheder') then
  for p in select m[1] as value from regexp_matches(html,'<p[^>]*class="hydra-article-body-paragraph[^"]*"[^>]*>([^<]*(?:<(?!/p>)[^>]*>[^<]*)*)</p>','gi') m loop
    paragraph:=trim(regexp_replace(regexp_replace(p.value,'<[^>]*>',' ','g'),'[[:space:]]+',' ','g'));
    if paragraph ~* '^(Klokken [0-9]|Artiklen er opdateret)' then continue; end if;
    if length(result||' '||paragraph)>650 then exit; end if;
    result:=trim(result||' '||paragraph); n:=n+1; if n>=3 then exit; end if;
  end loop;
  return nullif(result,'');
elsif source='TV2.dk' then marker:='<div class="tc_richcontent">';
elsif source='TechSavvy' then
  marker:=substring(html from '<p class="wp-block-paragraph">');
elsif source='Politiken' then marker:=substring(html from '<p class="drop-cap">');
elsif source='Altinget' then
  marker:=substring(html from '<div[^>]*class="[^"]*pre-paywall-fade[^"]*"[^>]*>');
elsif source in ('Ingeniøren','Version2') then return private.oeldk_ing_public_intro(html);
elsif source='Computerworld' then
  marker:=substring(html from '<div class="premium-facts-box">');
  if marker is null then return null; end if;
  scope:=substring(html from position(marker in html)+length(marker));
  if position('</ul>' in scope)=0 then return null; end if;
  scope:=left(scope,position('</ul>' in scope)-1);
  for p in select m[1] as value from regexp_matches(scope,'<li[^>]*>([^<]*(?:<(?!/li>)[^>]*>[^<]*)*)</li>','gi') m loop
    paragraph:=trim(regexp_replace(p.value,'<[^>]*>',' ','g'));
    if length(result||' '||paragraph)>650 then exit; end if;
    result:=trim(result||' '||paragraph); n:=n+1; if n>=3 then exit; end if;
  end loop;
  return nullif(result,'');
else return null;
end if;
if marker is null or position(marker in html)=0 then return null; end if;
scope:=substring(html from position(marker in html));
if source in ('TV2.dk','Altinget') then scope:=substring(scope from length(marker)+1); end if;
-- The first closing container terminates this public section.
if position('</div>' in scope)>0 then scope:=left(scope,position('</div>' in scope)-1); end if;
for p in select m[1] as value from regexp_matches(scope,'<p[^>]*>([^<]*(?:<(?!/p>)[^>]*>[^<]*)*)</p>','gi') m loop
  paragraph:=trim(regexp_replace(regexp_replace(p.value,'<[^>]*>',' ','g'),'[[:space:]]+',' ','g'));
  if paragraph ~* '(log ind|bliv abonnent|opret abonnement|foto:|illustration:|læs også|artiklen fortsætter)' then exit; end if;
  if length(result||' '||paragraph)>650 then exit; end if;
  result:=trim(result||' '||paragraph); n:=n+1;
  -- The first Altinget paragraph precedes the fade/payment overlay.
  if n >= (case when source='Altinget' then 1 else 3 end) then exit; end if;
end loop;
return nullif(result,'');
end $function$;
revoke all on function private.oeldk_public_article_intro(text,text) from public,anon,authenticated;

create or replace function private.oeldk_berlingske_free_intro(html text) returns text
language plpgsql immutable set search_path='' as $function$
declare script text; a jsonb; p jsonb; t record; paragraph text; result text:=''; n integer:=0;
begin
script:=substring(html from '<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]*)</script>');
if script is null then return null; end if;
a:=script::jsonb#>'{props,pageProps,article}';
if a is null or not (a ? 'payWall' and a ? 'loginWall')
  or a->'payWall'<>'null'::jsonb or a->'loginWall'<>'null'::jsonb then return null; end if;
for p in select value from jsonb_array_elements(a->'body') loop
  if p->>'type'<>'ParagraphNode' then continue; end if;
  paragraph:='';
  for t in select v as value from jsonb_path_query(p,'strict $.** ? (@.type == "TextNode").value') v loop
    paragraph:=paragraph||(t.value#>>'{}');
  end loop;
  if length(result||' '||paragraph)>650 then exit; end if;
  result:=trim(result||' '||paragraph); n:=n+1; if n>=3 then exit; end if;
end loop;
return nullif(result,'');
exception when others then return null;
end $function$;
revoke all on function private.oeldk_berlingske_free_intro(text) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.oeldk_collect_article_previews()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare req record; response record; actual_title text; description text; intro text; queued integer:=0;
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
intro:=case when req.source in ('Berlingske','Berlingske Tidende') then private.oeldk_berlingske_free_intro(response.content)
  else private.oeldk_public_article_intro(response.content,req.source) end;
if length(coalesce(intro,''))>=50 then
  if length(coalesce(description,''))>=20 and position(left(description,60) in intro)=0
    and length(description||' '||intro)<=900 then
    description:=description||' '||intro;
  else description:=intro;
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
