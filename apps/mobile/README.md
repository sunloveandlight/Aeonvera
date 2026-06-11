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
```

## Current Scope

- Native Aeonvera companion shell
- Deep links into the live web app
- Native Supabase email/password sign-in
- Native iOS/Android notification token registration
- Backend bridge into Aeonvera's existing coach notification system

## Next Native Steps

- Create app-native coach inbox
- Create app-native today protocol screen
- Add EAS build configuration
