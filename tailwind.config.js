/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Person-coded: tints of Synka brand palette
        emma: { tint: '#c8ecea', accent: '#166b4f' }, // synkaTealLight / synkaPrimary
        leo:  { tint: '#fef9d4', accent: '#c9920a' }, // yellow tint / amber
        mom:  { tint: '#fce8e2', accent: '#e05a3a' }, // coral tint / synkaCoral
        dad:  { tint: '#d4ede8', accent: '#0f4d38' }, // teal tint / synkaPrimaryDark
        family: { tint: '#faf0e4', accent: '#6b5a45' }, // synkaCream / warm brown
        // Synka brand palette
        synkaPrimary:     '#166b4f',
        synkaPrimaryDark: '#0f4d38',
        synkaTeal:        '#7bc7c4',
        synkaTealLight:   '#c8ecea',
        synkaYellow:      '#f5c842',
        synkaCream:       '#faf0e4',
        synkaCreamDeep:   '#f5ebe0',
        synkaNavy:        '#0f1e2b',
        synkaCoral:       '#e05a3a',
        // RGB triplets in index.css so `bg-surface/95` etc. work with time-of-day tint
        surface: 'rgb(var(--color-surface-rgb) / <alpha-value>)',
        muted: '#71717a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Existing utility sizes (keep)
        'micro': ['0.75rem', { lineHeight: '1.25', letterSpacing: '0.05em' }],
        'rail': ['0.6875rem', { lineHeight: '1.25' }],
        // Semantic type scale
        'display':  ['22px', { lineHeight: '1.2',  fontWeight: '600' }],
        'heading':  ['17px', { lineHeight: '1.3',  fontWeight: '600' }],
        'subheading': ['15px', { lineHeight: '1.4', fontWeight: '600' }],
        'body':     ['15px', { lineHeight: '1.5',  fontWeight: '400' }],
        'body-sm':  ['13px', { lineHeight: '1.5',  fontWeight: '400' }],
        'label':    ['12px', { lineHeight: '1.25' }],
        'caption':  ['11px', { lineHeight: '1.4',  fontWeight: '500' }],
      },
      borderRadius: {
        'none': '0',
        'xs':   '4px',
        'sm':   '8px',
        'md':   '12px',
        'lg':   '16px',
        'xl':   '24px',
        'pill': '999px',
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
