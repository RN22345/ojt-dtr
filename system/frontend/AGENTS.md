# AGENTS.md: system/frontend/

This folder will contain the Ionic Angular app. One codebase makes three builds: Android, iOS (optional, D-15), and the admin web app.

## Status

Created on 2026-10-25 (S1). The app is the Ionic "tabs" starter, the Android platform, and the layer 0 hours utilities. The starter tab pages are not changed yet. They become the role shells in S1.

## How the app was made

1. `ionic start frontend tabs --type=angular-standalone --capacitor --package-id=ph.edu.plv.ojtdtr` (Ionic CLI 7.2.1).
2. `npm install @capacitor/android@8.5.3`, then `npx cap add android`.
3. `npm install -D @vitest/coverage-v8@5.0.5` for coverage (QR-MA-05).

NOTE: You need macOS and Xcode to build the iOS app. iOS is optional (D-15). Add iOS only if a Mac is available: `npx cap add ios`.

## Commands

Run these commands in `system/frontend/`.

| Task | Command |
|---|---|
| Unit tests (once) | `npx ng test --watch=false` |
| Unit tests with coverage | `npx ng test --watch=false --coverage` |
| Lint | `npx ng lint` |
| Web build | `npx ng build` |
| Copy the web build to Android | `npx cap sync android` |
| Debug APK | In `android/`: `gradlew.bat assembleDebug`. `JAVA_HOME` must be JDK 21 (D-36). |
| Start the emulator | `emulator -avd ojt_dtr_api35` (in the Android SDK `emulator/` folder) |

## Folder map (files made in S1)

| Path | Contents |
|---|---|
| `src/app/shared/utils/hours.ts` | Layer 0: work sessions and hours from punches, Asia/Manila dates and weeks |
| `src/app/shared/utils/hours.spec.ts` | TC-U-UTIL-01 to TC-U-UTIL-05 |
| `android/` | Capacitor Android project (Gradle 8.14.3, Android Gradle plugin 8.13.0, minSdk 24, targetSdk 36) |

## Planned structure

```
system/frontend/src/app/
  core/            auth, route guards, Supabase client, network service, platform service, config
  data/
    local-db/      SQLite adapter, local schema, local migrations
    repositories/  one repository for each entity (the only path to data)
    sync/          outbox, sync engine, sync status store
  plugins/         wrapper services for Capacitor plugins (camera, geolocation, notifications, files)
  shared/          shared components (status chip, hours card, offline banner), pipes, utilities
  features/
    auth/  profile/  dtr/  corrections/  reports/  monitoring/  notifications/  export/   (mobile)
    admin/  users/  companies/  batches/  assignments/  dashboard/  audit/              (web)
  app.routes.ts
```

## Rules

1. Use standalone components only. Do not create NgModules.
2. Lazy-load each feature with `loadComponent` or `loadChildren` routes.
3. A page or component must not call supabase-js directly. Use a repository.
4. Each write from a mobile feature goes through a repository to the local database and the outbox. See `docs/03-architecture/offline-sync-design.md`.
5. Call Capacitor plugins only through the wrapper services in `plugins/`. This lets unit tests replace the plugins with fakes.
6. Do not import one feature folder from another feature folder. Use `core/`, `data/`, or `shared/`.
7. Use route guards for role and platform access. The server also enforces access (see `QR-SE-01`).
8. Store tokens with a secure storage plugin. Do not store tokens in `localStorage`.
9. Use TypeScript strict mode.
10. Put a test file next to each service. The test file name ends with `.spec.ts`.
11. Make one Supabase client in `core/`. In test builds, give it the fetch wrapper of the fault injector (D-20).
12. Do not sign out for a network error, a timeout, or a 5xx error. Sign out only when Supabase Auth rejects the refresh token (QR-RE-08).
13. Build screens as wireframes with placeholders (D-31). Use one shared placeholder component for each missing asset (for example, a box with the text "LOGO"). Keep all text, colors, and assets in replaceable theme, string, and asset files. Do not put them in pages.
14. Isolate rules that can change (time-in verification, DTR export layout, facilitator-company relation) behind a service or setting (D-30).

## Versions

Recorded on 2026-10-25. Update this table when a version changes.

| Package | Version |
|---|---|
| @angular/core | 22.2.3 |
| @ionic/angular | 9.0.9 |
| @capacitor/core, @capacitor/android, @capacitor/cli | 8.5.3 |
| typescript | 6.0.3 |
| vitest | 5.0.5 |
| @capacitor-community/sqlite | Not installed yet |
| @supabase/supabase-js | Not installed yet |
