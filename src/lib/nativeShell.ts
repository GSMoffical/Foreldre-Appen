import { isNative, isAndroid } from './capacitor'

/**
 * One-time native shell setup: status bar appearance + dismissing the splash screen.
 * No-ops on web. Never throws — each step is independently guarded so a single
 * plugin failure can't block app startup.
 */
export async function initNativeShell(): Promise<void> {
  if (!isNative()) return

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    // NOTE: Capacitor's Style naming is counterintuitive — verify against the
    // installed @capacitor/status-bar version. In current versions, Style.Light
    // renders DARK text (correct for our light cream background). If it looks
    // wrong on device, flip to Style.Dark — this is a one-line visual tweak.
    await StatusBar.setStyle({ style: Style.Light })
    if (isAndroid()) {
      await StatusBar.setBackgroundColor({ color: '#f4f2ef' })
    }
  } catch (err) {
    console.info('[nativeShell] status bar setup skipped:', err)
  }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch (err) {
    console.info('[nativeShell] splash hide skipped:', err)
  }
}
