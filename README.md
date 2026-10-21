# Farmers

A rebuild of the Farmers app with a new UI: one Expo (React Native) codebase for Android, iOS and the web, plus its own Node server.

## What's inside

- `src/`: the app (screens, components, theme, hooks)
- `server/`: the API (logins, feed, chats, market, AI, bKash), which also serves the web app
- `shared/`: database schema shared by the app and the server
- `.env.example`: every setting the server reads

## Run it on your computer

You need Node.js 22 or newer.

```bash
npm install
cp .env.example .env      # then fill in what you need
npx expo export -p web    # builds the web app into dist/
npm run server            # server + web app on http://localhost:5000
```

## Run it on your phone

1. Install Expo Go from the Play Store or App Store.
2. Set `EXPO_PUBLIC_API_URL` in `.env` to your server's address.
3. Run `npx expo start` and scan the QR code with Expo Go.

## Build an Android APK (free)

- **With Expo's cloud:** `npx eas build -p android --profile preview` (free Expo account, free builds have a queue)
- **On your own computer:** `npx expo prebuild -p android`, then `cd android && ./gradlew assembleRelease` (needs Android Studio's SDK and a JDK)

## iOS

Expo Go works for testing for free. TestFlight and the App Store need a paid Apple developer account.

## Put it online for free

- **Server + web app:** Render free web service. Build command `npm install && npx expo export -p web`, start command `npm run server`.
- **Database:** Neon or Supabase free Postgres, set as `DATABASE_URL`. Without it, data lives in files and resets when a free server restarts.

## What needs keys

- **AI help and crop disease check:** `GOOGLE_API_KEY`. Without it the app shows a clear notice and answers with general farming tips.
- **bKash payments:** sandbox works with no keys (bKash's public test account). For real payments set `BKASH_SANDBOX=false` and your merchant keys.
- **Admin dashboard:** set `ADMIN_EMAIL`; that account becomes super admin.
- **Google sign-in:** needs a Google OAuth client ID (not set up; email + password works).
- **Logins in production:** `JWT_SECRET`

## Testing tools (scripts/)

- `restart-server.sh` restarts the server on port 5000.
- `audit.py --sizes 360x640,390x844,430x932,768x1024,1280x800` opens every screen and reports crashes, console errors, failed API calls, horizontal overflow, clipped or overlapping text, and content hidden at the bottom.
- `flows.py` and `flows2.py` click through signup, onboarding, login, calculators, AI, weather, admin, market to order, and chat.
- Needs `pip install playwright && playwright install chromium`.

## Layout on tablets and desktop

In a browser wider than 640px the app shows as a centred column (see `src/lib/webFrame.ts`), so phone layouts never stretch or overflow. Change `MAX_APP_WIDTH` there to adjust.
