# Aeonvera Mobile

Expo foundation for the iOS and Android companion app.

## Setup

```bash
cd apps/mobile
npm install
npm run start
```

Set this in `apps/mobile/.env` if you need a non-production web backend:

```bash
EXPO_PUBLIC_AEONVERA_WEB_URL=https://www.aeonvera.com
```

## Current Scope

- Native Aeonvera companion shell
- Deep links into the live web app
- Native notification permission preparation
- Future bridge point for iOS/Android push tokens

## Next Native Steps

- Add native Supabase auth session handling
- Register Expo push tokens into `push_subscriptions`
- Create app-native coach inbox
- Create app-native today protocol screen
- Add EAS build configuration
