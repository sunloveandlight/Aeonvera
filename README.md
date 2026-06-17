This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Google Calendar Setup

Aeonvera can connect Google Calendar and schedule protocol blocks.

Required environment variables:

```bash
GOOGLE_CALENDAR_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CALENDAR_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_CALENDAR_SCOPES=https://www.googleapis.com/auth/calendar.events
```

Use this redirect URI in Google Cloud OAuth:

```bash
https://www.aeonvera.com/api/calendar/google/callback
```

For local testing, also add:

```bash
http://localhost:3000/api/calendar/google/callback
```

Apply `supabase/migrations/20260611170000_calendar_execution.sql` before using
calendar scheduling live.

## Launch Security Setup

Apply all Supabase migrations before handling real user data, including
`supabase/migrations/20260617120000_launch_security_hardening.sql`.

For durable production rate limiting on public share and invite routes, set:

```bash
UPSTASH_REDIS_REST_URL=your_upstash_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token
SHARE_ACCESS_SALT=your_long_random_share_code_salt
```

Without Upstash variables, local development falls back to an in-memory limiter.
Production requests fail loudly if Upstash rate limiting or share-code hashing
secrets are missing.

Recommended AI model environment overrides:

```bash
OPENAI_MODEL=gpt-5.5
OPENAI_REALTIME_MODEL=gpt-realtime-2
XAI_MODEL=grok-4.3
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
