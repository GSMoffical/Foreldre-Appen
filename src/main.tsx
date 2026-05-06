import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

console.info('[Foreldre app version]', {
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown',
  buildTime: typeof __APP_BUILD_FINGERPRINT__ !== 'undefined' ? __APP_BUILD_FINGERPRINT__ : 'unknown',
  gitSha: typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : 'unknown',
})
import { AuthProvider } from './context/AuthContext'
import { EffectiveUserIdProvider } from './context/EffectiveUserIdContext'
import { FamilyProvider } from './context/FamilyContext'
import { ProfileProvider } from './context/ProfileContext'
import { UserPreferencesProvider } from './context/UserPreferencesContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { UndoProvider } from './context/UndoContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
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
    </ErrorBoundary>
  </StrictMode>
)
