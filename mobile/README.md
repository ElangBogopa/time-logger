# Time Logger Mobile App

React Native mobile app built with Expo for iOS and Android.

## Setup

1. Install dependencies:
```bash
cd mobile
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Add your Supabase credentials to `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Add app assets to `assets/` folder:
   - `icon.png` (1024x1024) - App icon
   - `splash.png` (1284x2778) - Splash screen
   - `adaptive-icon.png` (1024x1024) - Android adaptive icon

## Development

```bash
# Start Expo dev server
npm start

# iOS Simulator
npm run ios

# Android Emulator
npm run android
```

## Building for App Store

1. Install EAS CLI:
```bash
npm install -g eas-cli
```

2. Configure EAS:
```bash
eas login
eas build:configure
```

3. Update `eas.json` with your Apple credentials

4. Build for iOS:
```bash
npm run build:ios
```

5. Submit to App Store:
```bash
npm run submit:ios
```

## Project Structure

```
mobile/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout
│   ├── index.tsx           # Entry point (auth redirect)
│   ├── login.tsx           # Login screen
│   └── (tabs)/             # Tab navigator
│       ├── _layout.tsx     # Tab layout
│       ├── home.tsx        # Today's activities
│       ├── timeline.tsx    # 24-hour timeline
│       ├── stats.tsx       # Weekly statistics
│       └── settings.tsx    # Settings & account
├── src/
│   ├── lib/                # Utilities
│   │   ├── types.ts        # TypeScript types
│   │   ├── time-utils.ts   # Time formatting
│   │   └── supabase.ts     # Supabase client
│   └── contexts/           # React contexts
│       └── AuthContext.tsx # Authentication state
├── assets/                 # App icons & splash
├── app.json                # Expo config
├── eas.json                # EAS Build config
└── package.json
```

## Features

- Apple Sign In authentication
- View and log time entries
- 24-hour timeline visualization
- Weekly statistics and category breakdown
- Dark mode support
- Pull-to-refresh on all screens

## Native Features (Coming Soon)

- iOS Widgets for quick logging
- Siri Shortcuts integration
- Push notifications for reminders
