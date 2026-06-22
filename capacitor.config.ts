import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'no.synka.app',
  appName: 'Synka',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
    backgroundColor: '#f4f2ef',
    scrollEnabled: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#166b4f',
      showSpinner: false,
    },
  },
}

export default config
