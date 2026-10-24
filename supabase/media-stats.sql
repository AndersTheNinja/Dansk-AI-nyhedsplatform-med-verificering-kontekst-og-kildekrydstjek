-- Applied through Supabase migration: add_public_media_article_counts.
-- Count saved original articles, not secondary sources with inherited group timestamps.
create function public.oeldk_media_article_counts() returns jsonb
language sql stable security definer set search_path='' as $$
with known(source,host) as (values
 ('Altinget','altinget.dk'),('Berlingske','berlingske.dk'),('Børsen','borsen.dk'),
 ('Computerworld','computerworld.dk'),('DR','dr.dk'),('Ingeniøren','ing.dk'),
 ('Journalisten','journalisten.dk'),('MigogAarhus','migogaarhus.dk'),('Politiken','politiken.dk'),
 ('Stiften.dk','stiften.dk'),('TechSavvy','techsavvy.media'),('TV2.dk','tv2.dk'),('Version2','version2.dk')
), parsed as (
 select regexp_replace(split_part(split_part(a.canonical_url,'?',1),'#',1),'/$','') as url,
 regexp_replace(lower(substring(a.canonical_url from '^https?://([^/:]+)')),'^www[.]','') as host,
 split_part(a.source,' · ',1) as original_source,a.published_at
 from public.articles a
), normalized as (
 select p.url,coalesce(k.source,case
 when p.original_source ~* '^(DR\M|Danmarks Radio)' then 'DR'
 when p.original_source ilike '%Berlingske%' then 'Berlingske'
 when p.original_source ilike 'MigogAarhus%' then 'MigogAarhus'
 else p.original_source end) as source,p.published_at
 from parsed p left join known k on p.host=k.host or (k.host='tv2.dk' and p.host='nyheder.tv2.dk')
 where p.original_source !~* 'Nordjyske|Fyens|JydskeVestkysten|Horsens Folkeblad|Fredericia Dagblad'
 and coalesce(p.host,'') !~ '(nordjyske|fyens|jv|hsfo|frdb)[.]dk$'
), unique_articles as (
 select source,url,max(published_at) as published_at from normalized
 where source is not null and source !~ '^[0-9]+ kilder$'
 group by source,url
), counts as (
 select source,count(*)::integer as total,
 count(*) filter(where published_at>=now()-interval '24 hours' and published_at<=now())::integer as last24h
 from unique_articles group by source
), media as (select source from known union select source from counts)
select jsonb_build_object('generatedAt',now(),'media',coalesce(jsonb_agg(jsonb_build_object(
 'source',m.source,'last24h',coalesce(c.last24h,0),'total',coalesce(c.total,0)
 ) order by m.source),'[]'::jsonb)) from media m left join counts c using(source)
$$;
revoke all on function public.oeldk_media_article_counts() from public;
grant execute on function public.oeldk_media_article_counts() to anon,authenticated,service_role;
