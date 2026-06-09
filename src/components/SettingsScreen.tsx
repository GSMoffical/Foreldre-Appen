import { useState } from 'react'
import { cardSection, typSectionCap, btnSecondary, btnDanger, btnDangerOutline } from '../lib/ui'
import { SectionDots } from './SectionDots'
import { useAuth } from '../context/AuthContext'
import { useUserPreferences } from '../context/UserPreferencesContext'
import { useEffectiveUserId } from '../context/EffectiveUserIdContext'
import { usePermissions } from '../hooks/usePermissions'
import { requestNotificationPermission } from '../hooks/useReminders'

interface SettingsScreenProps {
  onClearAllEvents?: () => Promise<void>
  onRestartOnboarding?: () => void
}

export function SettingsScreen({
  onClearAllEvents,
  onRestartOnboarding,
}: SettingsScreenProps) {
  const { user, signOut, deleteAccount } = useAuth()
  const { hapticsEnabled, setHapticsEnabled } = useUserPreferences()
  const { isLinked, unlink } = useEffectiveUserId()
  const { canClearAllEvents, isCalendarOwner } = usePermissions()
  const [notifStatus, setNotifStatus] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [clearDone, setClearDone] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDeleteAccount() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAccount()
      // AuthContext will clear the user — app will redirect to login automatically
    } catch {
      setDeleteError('Noe gikk galt. Prøv igjen eller kontakt support.')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  async function handleUnlink() {
    await unlink()
  }

  async function handleClearAllEvents() {
    if (!onClearAllEvents) return
    await onClearAllEvents()
    setClearDone(true)
    setConfirmClear(false)
  }

  async function handleEnableNotifications() {
    const result = await requestNotificationPermission()
    setNotifStatus(result)
  }

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col px-4 pt-5 pb-10">
      <div className="flex items-center gap-2">
        <SectionDots />
        <h2 className="text-display text-synkaPrimary">Innstillinger</h2>
      </div>

      <div className={`mt-6 ${cardSection} p-4`}>
        <div className="flex items-center gap-2"><SectionDots size="sm" /><p className={typSectionCap}>Konto</p></div>
        <p className="mt-1.5 text-body-sm text-synkaNavy/80 break-all">{user?.email ?? '—'}</p>
        <p className="mt-1.5 text-caption text-synkaNavy/50">
          {isCalendarOwner ? (
            <>Du er <span className="font-medium text-synkaNavy/70">eier</span> av denne kalenderen.</>
          ) : (
            <>Du er <span className="font-medium text-synkaNavy/70">invitert forelder</span> og bruker en annens familiekalender.</>
          )}
        </p>
      </div>

      {isLinked && (
        <div className="mt-4 rounded-md border border-synkaNavy/10 bg-synkaCream/50 p-4">
          <div className="flex items-center gap-2"><SectionDots size="sm" /><p className={typSectionCap}>Delt familie</p></div>
          <p className="mt-2 text-body-sm text-synkaNavy/60">
            Du ser på og redigerer en familie du ble invitert til. Hendelser kan du endre som vanlig; familien og
            invitasjoner håndteres av eieren. For å gå tilbake til din egen kalender, forlat familien.
          </p>
          {confirmUnlink ? (
            <div className="mt-3 rounded-md border border-synkaYellow/30 bg-synkaYellow/8 p-3.5 space-y-3">
              <p className="text-body-sm font-medium text-synkaNavy/80">Forlate delt familie og gå tilbake til din egen kalender?</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmUnlink(false)} className={`flex-1 ${btnSecondary}`}>Avbryt</button>
                <button type="button" onClick={handleUnlink} className="flex-1 rounded-md bg-synkaCoral py-3 text-body font-semibold text-white hover:bg-synkaCoral/90">Forlat</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmUnlink(true)} className="mt-3 rounded-pill border border-zinc-300 px-4 py-2 text-body-sm font-medium text-synkaNavy/70 hover:bg-white/50 transition">
              Forlat familie
            </button>
          )}
        </div>
      )}

      <div className={`mt-4 ${cardSection} p-4`}>
        <div className="flex items-center gap-2"><SectionDots size="sm" /><p className={typSectionCap}>Varsler</p></div>
        {notifStatus === 'granted' ? (
          <p className="mt-2 text-body-sm text-synkaNavy/60">Varsler er skrudd på. Påminnelser dukker opp før hendelser.</p>
        ) : notifStatus === 'denied' ? (
          <p className="mt-2 text-body-sm text-synkaCoral">Varsler er blokkert. Skru dem på i nettleserens innstillinger.</p>
        ) : notifStatus === 'unsupported' ? (
          <p className="mt-2 text-body-sm text-synkaNavy/50">Nettleservarsler er ikke støttet her.</p>
        ) : (
          <button type="button" onClick={handleEnableNotifications} className="mt-2 rounded-pill bg-synkaPrimary px-4 py-2 text-body-sm font-medium text-white transition hover:brightness-95">
            Skru på påminnelser
          </button>
        )}
      </div>

      <div className={`mt-4 ${cardSection} p-4`}>
        <div className="flex items-center gap-2"><SectionDots size="sm" /><p className={typSectionCap}>Tilbakemelding</p></div>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-body-sm font-medium text-synkaNavy/80">Lett vibrasjon ved lagring</p>
            <p className="mt-0.5 text-caption leading-relaxed text-synkaNavy/50">
              Kort vibrasjon når du legger til eller lagrer en hendelse. Fungerer på mange Android-telefoner; iOS støtter
              ofte ikke vibrasjon fra nettleser.
            </p>
          </div>
          <button type="button" role="switch" aria-checked={hapticsEnabled} onClick={() => setHapticsEnabled(!hapticsEnabled)} className={`relative h-7 w-12 shrink-0 rounded-pill transition-colors ${hapticsEnabled ? 'bg-synkaPrimary' : 'bg-zinc-300'}`}>
            <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-pill bg-white shadow transition-transform ${hapticsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {onRestartOnboarding && (
        <div className={`mt-4 ${cardSection} p-4`}>
          <div className="flex items-center gap-2"><SectionDots size="sm" /><p className={typSectionCap}>Hjelp</p></div>
          <p className="mt-2 text-body-sm text-synkaNavy/60">Vil du se gjennomgangen av appen på nytt?</p>
          <button type="button" onClick={onRestartOnboarding} className="mt-3 rounded-pill border border-synkaNavy/20 px-4 py-2 text-body-sm font-medium text-synkaNavy transition hover:bg-synkaNavy/5">
            Vis gjennomgang på nytt
          </button>
        </div>
      )}

      <div className={`mt-4 ${cardSection} p-4`}>
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-synkaCream text-synkaNavy/50" aria-hidden>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><SectionDots size="sm" /><p className={typSectionCap}>Personvern</p></div>
            <p className="mt-2 text-body-sm leading-relaxed text-synkaNavy/60">
              Kalenderen kan inneholde <span className="font-medium text-synkaNavy/80">navn på barn</span>,{' '}
              <span className="font-medium text-synkaNavy/80">skole og hendelser</span>, tider og steder. Tenk deg om før du
              skriver inn noe du ikke vil at andre skal se.
            </p>
            <p className="mt-2.5 text-body-sm leading-relaxed text-synkaNavy/60">
              Data lagres hos vår databasetjeneste (Supabase) og knyttes til kontoen din. Det du legger inn er synlig for
              deg og for andre du deler familien med. Vi bruker ikke innholdet til reklame og selger det ikke videre.
            </p>
            <p className="mt-2.5 text-caption text-zinc-400">
              Ved å bruke appen godtar du at du er ansvarlig for opplysningene du registrerer. Du kan slette kontoen og alle data permanent under
              Fareområde nedenfor.
            </p>
          </div>
        </div>
      </div>

      <div className={`mt-4 ${cardSection} p-4`}>
        <div className="flex items-center gap-2"><SectionDots size="sm" /><p className={typSectionCap}>Rettigheter</p></div>
        <ul className="mt-2.5 space-y-2 text-body-sm text-synkaNavy/60">
          <li className="flex gap-2">
            <span className="mt-px shrink-0 text-zinc-300">·</span>
            <span><span className="font-medium text-synkaNavy/80">Eier</span> kan invitere, legge til eller fjerne familiemedlemmer, og slette alle hendelser samlet.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-px shrink-0 text-zinc-300">·</span>
            <span><span className="font-medium text-synkaNavy/80">Invitert forelder</span> ser samme kalender og kan legge til, endre og slette hendelser, men kan ikke administrere familiemedlemmer eller sende invitasjoner. Du kan endre navn og farge på deg selv under Familie.</span>
          </li>
        </ul>
      </div>

      <div className="mt-6 rounded-md border border-synkaCoral/20 bg-synkaCoral/5 p-4">
        <p className="text-caption font-medium uppercase tracking-wide text-synkaCoral/70">Fareområde</p>
        <p className="mt-2 text-body-sm text-synkaNavy/60">
          {canClearAllEvents
            ? 'Sletter alle hendelser for familien fra databasen. Alle som deler kalenderen mister dem i appen. Kan ikke angres.'
            : 'Kun eieren av kalenderen kan slette alle hendelser samlet. Du kan fortsatt slette enkelthendelser i uke- og dagvisning.'}
        </p>
        {canClearAllEvents && (
          clearDone ? (
            <p className="mt-3 text-body-sm font-medium text-emerald-700">Alle hendelser er slettet.</p>
          ) : confirmClear ? (
            <div className="mt-3 rounded-md border border-synkaCoral/20 bg-white p-3.5 space-y-3">
              <p className="text-body-sm font-medium text-synkaCoral">Slette alle hendelser? Dette kan ikke angres.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmClear(false)} className={`flex-1 ${btnSecondary}`}>Avbryt</button>
                <button type="button" onClick={handleClearAllEvents} className={`flex-1 ${btnDanger}`}>Slett alt</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmClear(true)} className={`mt-3 ${btnDangerOutline} px-4 py-2 text-body-sm`}>
              Slett alle hendelser
            </button>
          )
        )}

        <div className="mt-6 border-t border-synkaCoral/15 pt-5">
          <p className="text-caption font-medium uppercase tracking-wide text-synkaCoral/70">
            Slett konto
          </p>
          <p className="mt-2 text-body-sm text-synkaNavy/60">
            Sletter kontoen din og alle data permanent — hendelser, gjøremål,
            familiemedlemmer og profil. Dette kan ikke angres.
          </p>
          {deleteError && (
            <p className="mt-2 text-caption text-synkaCoral">{deleteError}</p>
          )}
          {confirmDelete ? (
            <div className="mt-3 rounded-md border border-synkaCoral/30 bg-white p-3.5 space-y-3">
              <p className="text-body-sm font-medium text-synkaCoral">
                Er du helt sikker? All data slettes permanent og kan ikke gjenopprettes.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setConfirmDelete(false); setDeleteError(null) }}
                  className={`flex-1 ${btnSecondary}`}
                  disabled={deleting}
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className={`flex-1 ${btnDanger}`}
                  disabled={deleting}
                >
                  {deleting ? 'Sletter...' : 'Slett konto'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className={`mt-3 ${btnDangerOutline} px-4 py-2 text-body-sm`}
            >
              Slett konto permanent
            </button>
          )}
        </div>
      </div>

      {confirmLogout ? (
        <div className="mt-8 rounded-md border border-synkaYellow/30 bg-synkaYellow/8 p-3.5 space-y-3">
          <p className="text-body-sm font-medium text-synkaNavy/80">Er du sikker på at du vil logge ut?</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmLogout(false)} className={`flex-1 ${btnSecondary}`}>Avbryt</button>
            <button type="button" onClick={() => signOut()} className="flex-1 rounded-md bg-synkaCoral py-3 text-body font-semibold text-white hover:bg-synkaCoral/90">Logg ut</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmLogout(true)} className={`mt-8 w-full ${btnDangerOutline} border-synkaCoral/40 py-3 text-body-sm`}>
          Logg ut
        </button>
      )}
    </div>
  )
}
