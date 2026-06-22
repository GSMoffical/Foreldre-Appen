# Synka — iOS build runbook (macOS)

All iOS building happens on the Mac. The web-layer Capacitor code is already
written and committed on `feature/capacitor-native`. These steps generate the
native iOS project and run the app.

## Prerequisites
- macOS with Xcode installed (from the Mac App Store).
- CocoaPods: `sudo gem install cocoapods` (or `brew install cocoapods`).
- Node 18+ and the repo cloned, checked out on `feature/capacitor-native`.
- For push notifications and App Store: a paid Apple Developer account
  ($99/year). Since the developer is under 18, this account must be held by a
  parent/guardian.

## First-time iOS project generation
```bash
npm install
npm run build
npx cap add ios
npx cap sync ios
```
This creates the `ios/` folder. Commit it to the repo.

## Info.plist — required usage descriptions
The app will CRASH on camera/photo access without these. Open
`ios/App/App/Info.plist` and add:

- Key `NSCameraUsageDescription` →
  "Synka bruker kameraet til å ta bilde av skolebrev og planer."
- Key `NSPhotoLibraryUsageDescription` →
  "Synka bruker bildebiblioteket for å hente dokumenter du vil importere."

## Open and run
```bash
npx cap open ios
```
In Xcode:
- Select the App target → Signing & Capabilities.
- Set Team to the parent/guardian's Apple Developer account; keep
  "Automatically manage signing" checked.
- Simulator: pick any iPhone simulator and press Run. NOTE: the camera
  does not work in the simulator — test capture via the photo library, or on
  a real device.
- Real device: connect the iPhone, select it, press Run. On first launch,
  trust the developer profile on the phone:
  Settings → General → VPN & Device Management → trust the developer.

## After any web code change
```bash
npm run build && npx cap sync ios
```
Then re-run in Xcode.

## Push notifications (currently blocked)
Native push needs ALL of: the Apple Developer account above, an APNs auth key
(`.p8`) + Key ID + Team ID, the Push Notifications capability added in Xcode,
and the Supabase send-push Edge Function (a separate task). Device-token
registration is already implemented client-side; it is inert until these exist.

## Common gotchas
- Stale build / changes not showing: re-run `npm run build && npx cap sync ios`.
- Pod errors: `cd ios/App && pod install`, then reopen Xcode.
