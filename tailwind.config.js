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
        brandSky: '#f0fdf4',      // light teal-green (green-50)
        brandSkyDeep: '#dcfce7',  // deeper teal-green (green-100)
        brandTeal: '#1aab50',     // green accent — toned from green-500 for calmer feel
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
        // Existing utility sizes (keep)
        'micro': ['0.75rem', { lineHeight: '1.25', letterSpacing: '0.05em' }],
        'rail': ['0.6875rem', { lineHeight: '1.25' }],
        // Semantic type scale (new — use these going forward)
        'display': ['1.375rem', { lineHeight: '1.15', letterSpacing: '-0.01em' }], // 22px
        'heading': ['1.0625rem', { lineHeight: '1.3' }],                           // 17px
        'subheading': ['0.9375rem', { lineHeight: '1.4' }],                        // 15px
        'body': ['0.875rem', { lineHeight: '1.5' }],                               // 14px
        'body-sm': ['0.8125rem', { lineHeight: '1.45' }],                          // 13px
        'label': ['0.75rem', { lineHeight: '1.25' }],                              // 12px
        'caption': ['0.6875rem', { lineHeight: '1.2' }],                           // 11px
      },
      borderRadius: {
        'card': '20px',    // large surface cards
        'block': '16px',   // activity blocks, medium cards
        'pill': '9999px',  // FAB-style add buttons, person chips
        'sheet': '28px',   // bottom sheet top radius (new)
      },
      boxShadow: {
        soft: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        card: '0 2px 8px -2px rgb(0 0 0 / 0.08), 0 4px 12px -4px rgb(0 0 0 / 0.06)',
        planner: '0 2px 8px -1px rgb(0 0 0 / 0.10), 0 1px 3px -1px rgb(0 0 0 / 0.07)',
        'planner-sm': '0 1px 4px -1px rgb(0 0 0 / 0.09)',
        'planner-press': '0 1px 2px 0 rgb(0 0 0 / 0.08)',
        // New elevation tokens
        'sheet': '0 -4px 32px -4px rgb(0 0 0 / 0.10), 0 -1px 4px 0 rgb(0 0 0 / 0.05)',
        'float': '0 4px 20px -4px rgb(0 0 0 / 0.12), 0 2px 8px -2px rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [],
}
