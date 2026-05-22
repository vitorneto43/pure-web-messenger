
SELECT cron.schedule(
  'boost-refund-sweeper',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--84e5b2ed-fe1c-4906-b46d-5e198f0c6c1c.lovable.app/api/public/payments/refund-sweeper',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
