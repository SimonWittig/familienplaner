-- Zeitpläne für Erinnerungen (alle 5 Min.) und Google-Kalender-Sync (alle 15 Min.).
-- <CRON_SECRET> durch denselben Wert ersetzen, der als Edge-Function-Secret CRON_SECRET hinterlegt ist.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('familienplaner-reminders', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://qrkdacudlmfgenuxfjwf.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
    body := '{}'::jsonb)
$$);

select cron.schedule('familienplaner-gcal-sync', '*/15 * * * *', $$
  select net.http_post(
    url := 'https://qrkdacudlmfgenuxfjwf.supabase.co/functions/v1/google-calendar-sync',
    headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
    body := '{}'::jsonb)
$$);
