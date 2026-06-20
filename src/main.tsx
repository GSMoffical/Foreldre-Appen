import { initSentryClient } from './lib/sentry'
import { isNative } from './lib/capacitor'
import { initNativeShell } from './lib/nativeShell'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { EffectiveUserIdProvider } from './context/EffectiveUserIdContext'
import { FamilyProvider } from './context/FamilyContext'
import { ProfileProvider } from './context/ProfileContext'
import { UserPreferencesProvider } from './context/UserPreferencesContext'
import { UndoProvider } from './context/UndoContext'

// On a native shell, Capacitor manages the viewport and safe areas directly.
// Remove the web-only body top padding so it is not applied twice.
if (isNative()) {
  document.body.style.paddingTop = '0'
  void initNativeShell()
}

initSentryClient()

if (import.meta.env.DEV) {
  console.info('[Foreldre app version]', {
    version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
    buildTime: typeof __APP_BUILD_FINGERPRINT__ !== 'undefined' ? __APP_BUILD_FINGERPRINT__ : 'unknown',
    gitSha: typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : 'unknown',
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <EffectiveUserIdProvider>
        <FamilyProvider>
          <ProfileProvider>
            <UserPreferencesProvider>
              <UndoProvider>
                <RouterProvider router={router} />
              </UndoProvider>
            </UserPreferencesProvider>
          </ProfileProvider>
        </FamilyProvider>
      </EffectiveUserIdProvider>
    </AuthProvider>
  </StrictMode>
)
