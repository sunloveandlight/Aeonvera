# Aeonvera Mobile

Expo foundation for the iOS and Android companion app.

## Setup

```bash
cd apps/mobile
npm install
npm run start
```

On this Mac, use Node 20 when running Expo Go:

```bash
PATH=/opt/homebrew/opt/node@20/bin:$PATH npm install
PATH=/opt/homebrew/opt/node@20/bin:$PATH npm run start -- --clear --port 8081
```

Set this in `apps/mobile/.env` if you need a non-production web backend:

```bash
EXPO_PUBLIC_AEONVERA_WEB_URL=https://www.aeonvera.com
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_EAS_PROJECT_ID=your_expo_project_id
```

`EXPO_PUBLIC_EAS_PROJECT_ID` is required for native Expo push tokens. Get it
from Expo after running `npx eas-cli@latest init` in `apps/mobile`, or from the
Expo dashboard project settings.

## Current Scope

- Native Aeonvera companion shell
- Native Today protocol screen
- Native protocol adherence tracking
- Native coach inbox
- Native notification delivery preferences
- Deep links into the live web app
- Native Supabase email/password sign-in
- Native iOS/Android notification token registration
- Backend bridge into Aeonvera's existing coach notification system
- Push response routing into the companion experience

## Next Native Steps

- Add EAS build configuration
- Add local reminder scheduling for protocol actions
- Add native charts for biological age and recovery trends
