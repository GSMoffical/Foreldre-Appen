# «Koble til kalender» — native setup (iOS + Android)

The device-calendar import feature is implemented in the web/TS layer and builds green,
but it can only run on a real iOS/Android device. The native platform folders
(`ios/`, `android/`) **do not exist in this repo yet**, so the permission entries below
must be applied **after** the platforms are generated. Until then the feature shows a
friendly "available in the app" message on web.

Plugin used: **`@ebarooni/capacitor-calendar@7.2.0`** (latest version compatible with this
project's Capacitor 7; the 8.x line requires Capacitor 8). The feature is **read-only** —
no write/create/delete plugin methods are ever called.

## 1. Generate the native projects (once)

```bash
npm run build          # produces dist/ that Capacitor copies in
npx cap add android    # creates android/
npx cap add ios        # creates ios/  (macOS + Xcode + CocoaPods only)
npx cap sync           # links @ebarooni/capacitor-calendar into both platforms
```

> `npx cap add ios` requires macOS. On Windows, generate/build Android only; do the iOS
> step on a Mac (or CI).

## 2. iOS — `ios/App/App/Info.plist`

Apple's EventKit has **no read-only calendar scope**. To *read* events on iOS the app must
request **full** calendar access, which is gated behind these usage-description keys. Add
inside the top-level `<dict>`:

```xml
<!-- iOS 17+ -->
<key>NSCalendarsFullAccessUsageDescription</key>
<string>Synka henter hendelsene fra kalenderen din slik at familiens avtaler samles på ett sted. Synka leser kun kalenderen og endrer den aldri.</string>

<!-- iOS 13–16 (older calendar permission model) -->
<key>NSCalendarsUsageDescription</key>
<string>Synka henter hendelsene fra kalenderen din slik at familiens avtaler samles på ett sted. Synka leser kun kalenderen og endrer den aldri.</string>
```

We intentionally do **not** add `NSCalendarsWriteOnlyAccessUsageDescription` — the feature
never writes.

## 3. Android — `android/app/src/main/AndroidManifest.xml`

Add inside `<manifest>` (read only — we do not request `WRITE_CALENDAR`):

```xml
<uses-permission android:name="android.permission.READ_CALENDAR" />
```

## 4. Verify on device

See the "Needs on-device testing" checklist in the feature report. Key things to confirm:
permission prompt copy, the calendar chooser lists real calendars, timezone correctness of
imported times, all-day single-day vs multi-day handling, and that re-import does not
duplicate events.
