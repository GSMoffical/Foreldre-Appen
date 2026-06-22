import { AppNotice } from '../../../components/AppNotice'
import type { InviteNotice } from '../../invites/hooks/useInviteAcceptance'

interface AppNoticeStackProps {
  inviteNotice: InviteNotice | null
  onDismissInvite: () => void
  inviteProcessing: boolean
  scheduleError: string | null
  onDismissScheduleError: () => void
  familyError: string | null
  hideFamilyBanner: boolean
  onDismissFamilyError: () => void
  showPartnerBanner: boolean
  onPartnerBannerAction: () => void
  onDismissPartnerBanner: () => void
}

export function AppNoticeStack({
  inviteNotice,
  onDismissInvite,
  inviteProcessing,
  scheduleError,
  onDismissScheduleError,
  familyError,
  hideFamilyBanner,
  onDismissFamilyError,
  showPartnerBanner,
  onPartnerBannerAction,
  onDismissPartnerBanner,
}: AppNoticeStackProps) {
  return (
    <div className="shrink-0 space-y-2 px-3 pt-2">
      {showPartnerBanner && (
        <AppNotice variant="info" onDismiss={onDismissPartnerBanner}>
          <span>
            Del kalenderen med partneren din —{' '}
            <button
              type="button"
              className="font-semibold underline underline-offset-2"
              onClick={onPartnerBannerAction}
            >
              inviter nå
            </button>
          </span>
        </AppNotice>
      )}
      {inviteNotice && (
        <AppNotice variant={inviteNotice.variant === 'success' ? 'success' : 'error'} onDismiss={onDismissInvite}>
          {inviteNotice.message}
        </AppNotice>
      )}
      {inviteProcessing && <AppNotice variant="info">Behandler invitasjon...</AppNotice>}
      {scheduleError && (
        <AppNotice variant="error" onDismiss={onDismissScheduleError}>
          {scheduleError}
        </AppNotice>
      )}
      {familyError && !hideFamilyBanner && (
        <AppNotice variant="warning" onDismiss={onDismissFamilyError}>
          {familyError}
        </AppNotice>
      )}
    </div>
  )
}
