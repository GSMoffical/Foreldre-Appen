/**
 * Design system â€” shared Tailwind class strings.
 *
 * Import these constants instead of repeating long class lists inline.
 * All strings are pure Tailwind utility classes; no custom CSS required.
 *
 * Visual direction: calm Â· modern Â· mobile-native Â· slightly premium Â· structured
 */

// â”€â”€ Typography â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/** Page/sheet title (display, 22px semibold) */
export const typDisplay = 'text-display text-zinc-900'
/** Screen section heading (17px semibold) */
export const typHeading = 'text-heading text-zinc-900'
/** Sub-section or card title (15px semibold) */
export const typSubheading = 'text-subheading font-semibold text-zinc-800'
/** Standard body copy (14px) */
export const typBody = 'text-body text-zinc-700'
/** Secondary / supporting body (14px muted) */
export const typBodyMuted = 'text-body text-zinc-500'
/** Small body (13px) */
export const typBodySm = 'text-body-sm text-zinc-700'
/** Form field labels (11px medium caps) */
export const typLabel = 'text-caption uppercase tracking-wide text-synkaNavy/60'
/** Timestamps, metadata, captions (11px) */
export const typCaption = 'text-caption text-zinc-400'
/** Section separator label â€” ALL CAPS (11px) */
export const typSectionCap = 'text-caption uppercase tracking-wide text-synkaPrimary/60'

// â”€â”€ Buttons â€” full-width (sheets & forms) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Use these for primary actions inside sheets and form footers.

const _btnBase =
  'inline-flex items-center justify-center font-medium transition disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-1 touch-manipulation select-none'

/** Primary CTA â€” full width, teal fill */
export const btnPrimary =
  `${_btnBase} w-full rounded-lg bg-synkaPrimary py-3 text-body font-semibold text-white shadow-planner-sm hover:brightness-95 active:shadow-planner-press focus:ring-synkaPrimary/40`

/** Secondary CTA â€” full width, outlined */
export const btnSecondary =
  `${_btnBase} w-full rounded-lg border border-zinc-200 bg-white py-3 text-body text-zinc-800 hover:bg-zinc-50 active:bg-zinc-100 focus:ring-zinc-200/60`

/** Destructive action â€” full width, red fill */
export const btnDanger =
  `${_btnBase} w-full rounded-lg bg-synkaCoral py-3 text-body font-semibold text-white hover:bg-synkaCoral/90 active:bg-synkaCoral focus:ring-synkaCoral/40`

/** Neutral dismiss â€” full width, zinc fill */
export const btnNeutral =
  `${_btnBase} w-full rounded-lg bg-zinc-100 py-3 text-body text-zinc-700 hover:bg-zinc-200 active:bg-zinc-300 focus:ring-zinc-200`

// â”€â”€ Buttons â€” inline / compact â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Use these for add buttons in screen headers, row actions, and chip-style controls.

/** Small teal add-button (screen headers, FAB-style) */
export const btnPrimaryPill =
  `${_btnBase} rounded-pill bg-synkaPrimary px-4 py-1.5 text-body-sm font-semibold text-white shadow-planner-sm hover:brightness-95 active:shadow-planner-press focus:ring-synkaPrimary/40`

/** Small outlined add-button (secondary header action) */
export const btnSecondaryPill =
  `${_btnBase} rounded-pill border border-synkaPrimary px-4 py-1.5 text-body-sm font-semibold text-synkaPrimary hover:bg-synkaPrimary/10 active:bg-synkaPrimary/20 focus:ring-synkaPrimary/30`

/** Compact row action â€” ghost chip (Rediger, etc.) */
export const btnRowAction =
  `${_btnBase} rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-caption font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 focus:ring-zinc-200`

/** Text-only link button */
export const btnGhost =
  `${_btnBase} rounded-lg px-3 py-1.5 text-label font-medium text-synkaPrimary hover:bg-synkaPrimary/8 focus:ring-synkaPrimary/30`

// â”€â”€ Inputs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/** Standard text input â€” use on all form fields */
export const inputBase =
  'w-full rounded-md border border-synkaNavy/15 bg-white/60 px-3.5 py-3 text-body text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-synkaPrimary focus:bg-white focus:ring-1 focus:ring-synkaPrimary/20 disabled:opacity-60'

/** Multi-line textarea */
export const textareaBase =
  'w-full rounded-md border border-synkaNavy/15 bg-white/60 px-3.5 py-3 text-body text-zinc-900 placeholder-zinc-400 outline-none resize-none transition focus:border-synkaPrimary focus:bg-white focus:ring-1 focus:ring-synkaPrimary/20'

/** Select / dropdown â€” matches inputBase */
export const selectBase =
  'w-full rounded-md border border-synkaNavy/15 bg-white/60 px-3.5 py-3 text-body text-zinc-900 outline-none transition focus:border-synkaPrimary focus:bg-white focus:ring-1 focus:ring-synkaPrimary/20'

/** Field label (sits above the input) */
export const inputLabel = 'mb-1.5 block text-caption uppercase tracking-wide text-synkaNavy/60'
/** Hint text below input */
export const inputHint = 'mt-1 text-caption text-zinc-400'
/** Validation error below input */
export const inputError = 'mt-1 text-caption text-synkaCoral'

// â”€â”€ Bottom sheet container â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/** Outer sheet panel â€” pair with `rounded-t-lg shadow-sheet` */
export const sheetPanel =
  'pointer-events-auto flex w-full min-h-[52dvh] max-h-[min(92dvh,920px)] flex-col overflow-y-auto overflow-x-hidden rounded-t-lg bg-synkaCream shadow-sheet scrollbar-none'

/** Sticky drag-handle bar at top of sheet */
export const sheetHandle =
  'sticky top-0 z-10 flex shrink-0 justify-center bg-synkaCream pt-2.5 pb-1'

/** The drag indicator pill */
export const sheetHandleBar = 'h-1 w-10 rounded-pill bg-synkaPrimary/20'

/** Body padding for form sheets */
export const sheetFormBody =
  'flex min-h-0 flex-1 flex-col px-5 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-2 space-y-5'

/** Body padding for detail / read sheets */
export const sheetDetailBody =
  'flex min-h-0 flex-1 flex-col px-5 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-1'

// â”€â”€ Cards & surfaces â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/** Primary content card (white, rounded-xl) */
export const cardBase = 'rounded-xl border border-zinc-100 bg-white shadow-card'

/** Settings-style section card */
export const cardSection = 'rounded-md border border-synkaNavy/10 bg-white/50 shadow-soft'

/** Inset / nested surface (slightly recessed) */
export const cardInset = 'rounded-lg border border-zinc-100 bg-zinc-50/60'

/** Grouped list container (task groups, event lists) */
export const cardList = 'rounded-lg border border-zinc-100 bg-white'

// â”€â”€ Sheet typography helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/** Primary title inside a sheet (h2) */
export const sheetTitle = 'text-heading text-synkaNavy'
/** Date / context subtitle below a sheet title */
export const sheetSubtitle = 'text-body-sm text-zinc-500'

// â”€â”€ Progressive disclosure toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/** Inline "Mer / Skjul" toggle â€” consistent across all sheets */
export const btnDisclosure =
  'inline-flex items-center gap-1.5 text-label font-medium text-synkaPrimary hover:text-synkaPrimary/70 transition'

// â”€â”€ Person selector chips (inside sheets) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/** Selected person chip */
export const personChipActive =
  'rounded-pill px-3 py-1 text-caption font-semibold bg-synkaPrimary text-white transition'
/** Unselected person chip */
export const personChipInactive =
  'rounded-pill border border-synkaNavy/20 px-3 py-1 text-caption font-medium bg-synkaCream text-synkaNavy/70 transition'

// â”€â”€ Custom dropdown trigger (acts like a <select> but needs chevron) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/** Button that opens a custom listbox dropdown â€” visually matches inputBase */
export const dropdownTrigger =
  'flex w-full items-center justify-between rounded-md border border-synkaNavy/15 bg-white/60 px-3.5 py-3 text-body text-zinc-900 outline-none transition hover:border-synkaNavy/30 focus:border-synkaPrimary focus:ring-1 focus:ring-synkaPrimary/20'

// â”€â”€ Screen layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
/** Outer screen column wrapper */
export const screenWrapper =
  'flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col overflow-x-hidden'

/** Scrollable inner column */
export const screenInner =
  'flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto scrollbar-none'

/** Horizontal padding for screen content (4 = 16px) */
export const screenPad = 'px-4'

/** Screen section header row (title left, action right) */
export const screenHeaderRow = 'flex items-center justify-between px-4 pb-4 pt-5'

/** Vertical gap between screen sections */
export const sectionGap = 'space-y-6'
