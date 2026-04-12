/**
 * Design system — shared Tailwind class strings.
 *
 * Import these constants instead of repeating long class lists inline.
 * All strings are pure Tailwind utility classes; no custom CSS required.
 *
 * Visual direction: calm · modern · mobile-native · slightly premium · structured
 */

// ── Typography ────────────────────────────────────────────────────────────────
/** Page/sheet title (serif display, 22px) */
export const typDisplay = 'font-display text-display font-bold text-zinc-900'
/** Screen section heading (17px semibold) */
export const typHeading = 'text-heading font-semibold text-zinc-900'
/** Sub-section or card title (15px semibold) */
export const typSubheading = 'text-subheading font-semibold text-zinc-800'
/** Standard body copy (14px) */
export const typBody = 'text-body text-zinc-700'
/** Secondary / supporting body (14px muted) */
export const typBodyMuted = 'text-body text-zinc-500'
/** Small body (13px) */
export const typBodySm = 'text-body-sm text-zinc-700'
/** Form field labels (12px medium) */
export const typLabel = 'text-label font-medium text-zinc-600'
/** Timestamps, metadata, captions (11px) */
export const typCaption = 'text-caption text-zinc-400'
/** Section separator label — ALL CAPS (11px) */
export const typSectionCap = 'text-caption font-semibold uppercase tracking-wider text-zinc-400'

// ── Buttons — full-width (sheets & forms) ─────────────────────────────────────
// Use these for primary actions inside sheets and form footers.

const _btnBase =
  'inline-flex items-center justify-center font-medium transition disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-1 touch-manipulation select-none'

/** Primary CTA — full width, teal fill */
export const btnPrimary =
  `${_btnBase} w-full rounded-2xl bg-brandTeal py-3 text-body font-semibold text-white shadow-planner-sm hover:brightness-95 active:shadow-planner-press focus:ring-brandTeal/40`

/** Secondary CTA — full width, outlined */
export const btnSecondary =
  `${_btnBase} w-full rounded-2xl border border-zinc-200 bg-white py-3 text-body text-zinc-800 hover:bg-zinc-50 active:bg-zinc-100 focus:ring-zinc-200/60`

/** Destructive action — full width, red fill */
export const btnDanger =
  `${_btnBase} w-full rounded-2xl bg-rose-600 py-3 text-body font-semibold text-white hover:bg-rose-700 active:bg-rose-800 focus:ring-rose-500/40`

/** Neutral dismiss — full width, zinc fill */
export const btnNeutral =
  `${_btnBase} w-full rounded-2xl bg-zinc-100 py-3 text-body text-zinc-700 hover:bg-zinc-200 active:bg-zinc-300 focus:ring-zinc-200`

// ── Buttons — inline / compact ────────────────────────────────────────────────
// Use these for add buttons in screen headers, row actions, and chip-style controls.

/** Small teal add-button (screen headers, FAB-style) */
export const btnPrimaryPill =
  `${_btnBase} rounded-pill bg-brandTeal px-4 py-1.5 text-body-sm font-semibold text-white shadow-planner-sm hover:brightness-95 active:shadow-planner-press focus:ring-brandTeal/40`

/** Small outlined add-button (secondary header action) */
export const btnSecondaryPill =
  `${_btnBase} rounded-pill border border-brandTeal px-4 py-1.5 text-body-sm font-semibold text-brandTeal hover:bg-brandTeal/10 active:bg-brandTeal/20 focus:ring-brandTeal/30`

/** Compact row action — ghost chip (Rediger, etc.) */
export const btnRowAction =
  `${_btnBase} rounded-xl border border-zinc-200 bg-white px-2.5 py-1 text-caption font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 focus:ring-zinc-200`

/** Text-only link button */
export const btnGhost =
  `${_btnBase} rounded-xl px-3 py-1.5 text-label font-medium text-brandTeal hover:bg-brandTeal/8 focus:ring-brandTeal/30`

// ── Inputs ────────────────────────────────────────────────────────────────────
/** Standard text input — use on all form fields */
export const inputBase =
  'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-body text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-brandTeal focus:bg-white focus:ring-1 focus:ring-brandTeal/20 disabled:opacity-60'

/** Multi-line textarea */
export const textareaBase =
  'w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-body text-zinc-900 placeholder-zinc-400 outline-none resize-none transition focus:border-brandTeal focus:bg-white focus:ring-1 focus:ring-brandTeal/20'

/** Select / dropdown — matches inputBase */
export const selectBase =
  'w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-body text-zinc-900 outline-none transition focus:border-brandTeal focus:bg-white focus:ring-1 focus:ring-brandTeal/20 bg-white'

/** Field label (sits above the input) */
export const inputLabel = 'mb-1.5 block text-label font-medium text-zinc-600'
/** Hint text below input */
export const inputHint = 'mt-1 text-caption text-zinc-400'
/** Validation error below input */
export const inputError = 'mt-1 text-caption text-rose-600'

// ── Bottom sheet container ─────────────────────────────────────────────────────
/** Outer sheet panel — pair with `rounded-t-sheet shadow-sheet` */
export const sheetPanel =
  'pointer-events-auto flex w-full min-h-[52dvh] max-h-[min(92dvh,920px)] flex-col overflow-y-auto overflow-x-hidden rounded-t-sheet bg-white shadow-sheet scrollbar-none'

/** Sticky drag-handle bar at top of sheet */
export const sheetHandle =
  'sticky top-0 z-10 flex shrink-0 justify-center bg-white pt-2.5 pb-1'

/** The drag indicator pill */
export const sheetHandleBar = 'h-1 w-10 rounded-full bg-zinc-100'

/** Body padding for form sheets */
export const sheetFormBody =
  'flex min-h-0 flex-1 flex-col px-5 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-2 space-y-5'

/** Body padding for detail / read sheets */
export const sheetDetailBody =
  'flex min-h-0 flex-1 flex-col px-5 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-1'

// ── Cards & surfaces ──────────────────────────────────────────────────────────
/** Primary content card (white, rounded-card) */
export const cardBase = 'rounded-card border border-zinc-100 bg-white shadow-card'

/** Settings-style section card */
export const cardSection = 'rounded-2xl border border-zinc-100 bg-white shadow-soft'

/** Inset / nested surface (slightly recessed) */
export const cardInset = 'rounded-2xl border border-zinc-100 bg-zinc-50/60'

/** Grouped list container (task groups, event lists) */
export const cardList = 'rounded-2xl border border-zinc-100 bg-white'

// ── Sheet typography helpers ───────────────────────────────────────────────────
/** Primary title inside a sheet (h2) */
export const sheetTitle = 'text-[18px] font-semibold text-zinc-900'
/** Date / context subtitle below a sheet title */
export const sheetSubtitle = 'text-body-sm text-zinc-500'

// ── Progressive disclosure toggle ─────────────────────────────────────────────
/** Inline "Mer / Skjul" toggle — consistent across all sheets */
export const btnDisclosure =
  'inline-flex items-center gap-1.5 text-label font-medium text-brandTeal hover:text-brandTeal/70 transition'

// ── Person selector chips (inside sheets) ─────────────────────────────────────
/** Selected person chip */
export const personChipActive =
  'rounded-full px-3 py-1 text-caption font-semibold bg-brandNavy text-white transition'
/** Unselected person chip */
export const personChipInactive =
  'rounded-full px-3 py-1 text-caption font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition'

// ── Custom dropdown trigger (acts like a <select> but needs chevron) ───────────
/** Button that opens a custom listbox dropdown — visually matches inputBase */
export const dropdownTrigger =
  'flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-body text-zinc-900 outline-none transition hover:border-zinc-300 focus:border-brandTeal focus:ring-1 focus:ring-brandTeal/20'

// ── Screen layout ──────────────────────────────────────────────────────────────
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
