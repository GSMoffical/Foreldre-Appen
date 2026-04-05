# Family Calendar — Parenting Calendar App

A premium, mobile-first (390×844) parenting calendar prototype: **day-first** timeline with **person-coded** events, week strip, family filters, and **time-as-geometry** layout.

## Features

- **Today-first, week-aware** day view with horizontal week strip
- **Person-coded colors** for events and filter chips (works for flexible family setups)
- **Time as geometry**: event block height = duration; gaps = free time (labeled when ≥ 45 min)
- **Current time** line when viewing today
- **Next up** card and day summary (activity count, free time)
- **Overlapping events** laid out side-by-side
- **Event detail** bottom sheet on tap
- **Auto-scroll** to current time (today) or first event when changing days

## Tech stack

- React 18, TypeScript, Vite
- Tailwind CSS, Framer Motion

## Run instructions

### Prerequisites

- Node.js 18+ and npm (or yarn/pnpm)

### Install

```bash
cd parenting-calendar
npm install
```

### Development

```bash
npm run dev
```

Open the URL shown (e.g. http://localhost:5173). For the intended layout, use the browser at **390×844** or Chrome DevTools device toolbar (e.g. iPhone 13).

**Using Supabase (login + events/family)?** See **[SETUP.md](./SETUP.md)** for creating tables, enabling Email auth, and `.env.local`.

**Invited second parent?** Before launch, apply **`supabase-invites.sql`** and the **`supabase-family-members-rls-linked.sql`** launch gate so invited users can read **`family_members`** for the owner (see SETUP §4).

### Build

```bash
npm run build
```

Output is in `dist/`. Preview the production build:

```bash
npm run preview
```

### Testing

```bash
npm test
npm run test:e2e
```

For manual release checks on mobile/iPad flows, run the list in [`docs/CRITICAL-FLOW-SMOKE.md`](./docs/CRITICAL-FLOW-SMOKE.md).

## Layout scale

- **Timeline:** 6:00 AM – 10:00 PM
- **1 hour = 80px** (documented in `src/lib/time.ts` as `PIXELS_PER_HOUR`)
- Gap labels only for free time ≥ 45 minutes

## Project structure

- `src/types` — Person, Event, DaySummary, WeekDayMeta, etc.
- `src/data/mockSchedule.ts` — Weekly template by weekday; works for any week
- `src/lib/time.ts` — parseTime, timeToY, durationToHeight, formatTimeRange
- `src/lib/schedule.ts` — visible events, gaps, day summary, week indicators
- `src/lib/overlaps.ts` — overlap detection and column layout
- `src/components` — AppShell, MobileFrame, FamilyFilterBar, WeekStrip, DayHeader, TimelineContainer, ActivityBlock, EventDetailSheet, etc.
- `src/hooks/useScheduleState.ts` — selected day, filters, derived state

## Future improvements

- School calendar sync
- Travel-time estimation between events
- AI conflict suggestions
- Performance tuning and offline robustness
- Broader end-to-end test coverage
