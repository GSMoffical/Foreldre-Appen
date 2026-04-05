/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Person-coded: tint (bg) and accent (border/active)
        emma: { tint: '#dcfce7', accent: '#16a34a' }, // fresh green
        leo: { tint: '#fef9c3', accent: '#ca8a04' }, // warm amber
        mom: { tint: '#fef2f2', accent: '#e11d48' }, // soft rose
        dad: { tint: '#ffedd5', accent: '#ea580c' }, // orange
        family: { tint: '#f5f5f4', accent: '#57534e' }, // warm neutral
        // Brand palette (non‑blue, warm neutrals)
        brandSky: '#fef3c7',      // light warm
        brandSkyDeep: '#fde68a',  // deeper warm
        brandTeal: '#22c55e',     // green accent
        brandNavy: '#292524',     // dark warm neutral
        brandSun: '#facc15',
        // RGB triplets in index.css so `bg-surface/95` etc. work with time-of-day tint
        surface: 'rgb(var(--color-surface-rgb) / <alpha-value>)',
        muted: '#71717a',
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        display: ['Literata', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        'micro': ['0.75rem', { lineHeight: '1.25', letterSpacing: '0.05em' }],
        'rail': ['0.6875rem', { lineHeight: '1.25' }],
      },
      borderRadius: {
        'card': '20px',
        'block': '16px',
        'pill': '9999px',
      },
      boxShadow: {
        soft: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        card: '0 2px 8px -2px rgb(0 0 0 / 0.08), 0 4px 12px -4px rgb(0 0 0 / 0.06)',
        planner: '4px 4px 0 0 rgba(41, 37, 36, 0.14)',
        'planner-sm': '2px 2px 0 0 rgba(41, 37, 36, 0.12)',
        'planner-press': '2px 2px 0 0 rgba(41, 37, 36, 0.14)',
      },
    },
  },
  plugins: [],
}
