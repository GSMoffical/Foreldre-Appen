import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import { EffectiveUserIdProvider } from './context/EffectiveUserIdContext'
import { FamilyProvider } from './context/FamilyContext'
import { ProfileProvider } from './context/ProfileContext'
import { UserPreferencesProvider } from './context/UserPreferencesContext'
import { UndoProvider } from './context/UndoContext'
import { initSentryClient } from './lib/sentry'

initSentryClient()

console.info('[Foreldre app version]', {
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
  buildTime: typeof __APP_BUILD_FINGERPRINT__ !== 'undefined' ? __APP_BUILD_FINGERPRINT__ : 'unknown',
  gitSha: typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : 'unknown',
})

function SentryRootFallback() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-[16px] font-semibold text-zinc-900">Noe gikk galt. Prøv å laste siden på nytt.</p>
      <button
        type="button"
        className="rounded-full bg-brandTeal px-5 py-2 text-[14px] font-medium text-white shadow-planner hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-brandTeal focus:ring-offset-2"
        onClick={() => window.location.reload()}
      >
        Last siden på nytt
      </button>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<SentryRootFallback />} showDialog={false}>
      <AuthProvider>
        <EffectiveUserIdProvider>
          <FamilyProvider>
            <ProfileProvider>
              <UserPreferencesProvider>
                <UndoProvider>
                  <App />
                </UndoProvider>
              </UserPreferencesProvider>
            </ProfileProvider>
          </FamilyProvider>
        </EffectiveUserIdProvider>
      </AuthProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>
)
