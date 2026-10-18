-- Applied to the production Supabase project on 18 October 2026.
-- Calls the existing news API, which fetches and persists live stories.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'oeldk-collect-news',
  '*/5 * * * *',
  $job$
    select net.http_get(
      url := 'https://xn--l-4ga.dk/api/news?collector=scheduled',
      headers := '{"Cache-Control":"no-cache"}'::jsonb,
      timeout_milliseconds := 90000
    );
  $job$
);
