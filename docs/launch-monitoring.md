# Launch Monitoring

Use this checklist before launch so failures are visible quickly instead of hiding in logs.

## Vercel

- Enable Vercel Web Analytics and Speed Insights for the production project.
- Add runtime log alerts for repeated `5xx` responses and function errors.
- Add a log drain if you want long-term retention outside Vercel.
- Confirm these environment variables exist in Production and Preview:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
  - `SHARE_ACCESS_SALT`
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`
  - `OPENAI_REALTIME_MODEL`
  - `CRON_SECRET`
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Cron Jobs

- Confirm `/api/cron/wearable-sync` returns `401` without `CRON_SECRET`.
- Confirm the scheduled Vercel cron includes `Authorization: Bearer <CRON_SECRET>`.
- Add an alert for any cron response outside the `2xx` range.
- Review the cron logs after the first scheduled run; a single bad wearable token should log and skip that user without aborting the whole run.

## Stripe

- In the Stripe dashboard, enable webhook failure email alerts.
- Verify the production webhook endpoint points at `/api/stripe/webhook`.
- Send a test webhook event before launch and confirm the app records the expected subscription state.

## Sentry

Sentry is optional, but recommended before paid traffic.

- Create a Sentry project for the web app.
- Add `NEXT_PUBLIC_SENTRY_DSN` and the Sentry auth/project settings to Vercel.
- Install and run the Sentry Next.js wizard when you are ready to commit to Sentry:

```bash
npx @sentry/wizard@latest -i nextjs
```

## Upstash

- Check the Upstash Redis dashboard after a real login/chat/pricing session.
- Confirm rate-limit keys are being written.
- Add an Upstash usage alert if the production plan supports it.

## Launch Reminders

- Add xAI credits/licenses before launch if `XAI_API_KEY` stays enabled.
- Run a real end-to-end test with production-like accounts: signup, assessment, dashboard, AI chat, pricing checkout, doctor share, wearable connection, and physician export.
- Upgrade mobile Expo/React Native dependencies before app-store launch; the current audit fix path is a breaking upgrade.
