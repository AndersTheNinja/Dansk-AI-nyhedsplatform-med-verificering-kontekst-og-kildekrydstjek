-- Spread stored candidates across publishers instead of letting one large
-- daily source occupy all 500 positions. Only known URLs and public teasers
-- are returned; publication still requires an existing completed AI summary.
CREATE OR REPLACE FUNCTION public.oeldk_recent_news_candidates(p_limit integer DEFAULT 500)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $news$
WITH recent AS (
  SELECT a.id, a.canonical_url, a.title, a.source, a.source_method,
         a.category, a.published_at, a.teaser, a.story_group, a.raw_metadata,
         row_number() OVER (
           PARTITION BY regexp_replace(split_part(a.canonical_url,'/',3), '^www\.', '')
           ORDER BY a.published_at DESC, a.id DESC
         ) AS publisher_rank
  FROM public.articles a
  WHERE a.published_at >= now() - interval '7 days'
    AND a.published_at <= now() + interval '1 hour'
    AND length(trim(coalesce(a.teaser,''))) >= 50
    AND length(trim(coalesce(a.title,''))) >= 5
    AND a.canonical_url LIKE 'https://%'
), selected AS (
  SELECT * FROM recent
  ORDER BY publisher_rank ASC, published_at DESC, id DESC
  LIMIT least(greatest(coalesce(p_limit,500),1),500)
)
SELECT coalesce(jsonb_agg(
  jsonb_build_object(
    'id', q.id, 'url', q.canonical_url, 'title', q.title,
    'source', q.source, 'method', q.source_method,
    'category', q.category, 'publishedAt', q.published_at,
    'summary', q.teaser, 'storyId', q.story_group,
    'meta', coalesce(q.raw_metadata, '{}'::jsonb)
  )
  ORDER BY q.published_at DESC, q.id DESC
), '[]'::jsonb)
FROM selected q
$news$;
REVOKE ALL ON FUNCTION public.oeldk_recent_news_candidates(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.oeldk_recent_news_candidates(integer) TO oeldk_web;

-- Include Y.dk in the published media statistics (previously omitted even
-- though its published stories are stored and appear in the feed).
CREATE OR REPLACE FUNCTION private.oeldk_refresh_media_counts_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare v_payload jsonb;
begin
 with known(source) as (
   values ('Altinget'),('Berlingske'),('Børsen'),('Computerworld'),('DR'),
   ('Ingeniøren'),('Journalisten'),('MigogAarhus'),('Politiken'),
   ('Stiften.dk'),('TechSavvy'),('TV2.dk'),('Version2'),('Y.dk')
 ),
 counts as (
  select case
   when source like 'DR %' or source='DR' or source like 'Danmarks Radio%' then 'DR'
   when source like 'Berlingske%' then 'Berlingske'
   when source like 'Børsen%' then 'Børsen'
   when source like 'Politiken%' then 'Politiken'
   when source like 'MigogAarhus%' then 'MigogAarhus'
   when source like 'TV2%' then 'TV2.dk'
   else split_part(source,' · ',1)
  end as source,
  count(*)::integer as total,
  count(*) filter(where published_at >= now()-interval '24 hours'
                  and published_at <=now())::integer as last24h
  from public.articles
  where source not like 'Nordjyske%' and source not like 'Fyens%'
    and source not like 'JydskeVestkysten%'
    and source not like 'Horsens Folkeblad%'
    and source not like 'Fredericia Dagblad%'
  group by 1
 )
 select jsonb_build_object('generatedAt',now(),'media',
  coalesce(jsonb_agg(jsonb_build_object(
   'source',k.source,'last24h',coalesce(c.last24h,0),
   'total',coalesce(c.total,0)
  ) order by k.source),'[]'::jsonb))
 into v_payload from known k left join counts c using(source);
 insert into private.oeldk_media_counts_cache(slot,payload,updated_at)
 values(1,v_payload,now())
 on conflict(slot) do update
 set payload=excluded.payload,updated_at=excluded.updated_at;
 return coalesce(jsonb_array_length(v_payload->'media'),0);
end $function$;
SELECT private.oeldk_refresh_media_counts_cache();
