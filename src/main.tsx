import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
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
