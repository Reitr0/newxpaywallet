// tailwind.config.js


const { themeSchema } = require('./src/shared/style/themeSchema');
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Surfaces & text
        app:              'var(--color-app)',
        card:             'var(--color-card)',
        item:             'var(--color-item)',
        input:            'var(--color-input)',
        elevated:         'var(--color-elevated)',
        overlay:          'var(--color-overlay)',
        title:            'var(--color-title)',
        body:             'var(--color-body)',
        muted:            'var(--color-muted)',
        inverse:          'var(--color-inverse)',
        link:             'var(--color-link)',
        number:           'var(--color-number)',

        // Status
        up:               'var(--color-up)',
        down:             'var(--color-down)',
        success:          'var(--color-success)',
        warning:          'var(--color-warning)',
        danger:           'var(--color-danger)',

        // Soft accents
        'buy-soft':       'var(--color-buy-soft)',
        'sell-soft':      'var(--color-sell-soft)',

        // Borders / focus
        'border-strong':  'var(--color-border-strong)',
        'border-subtle':  'var(--color-border-subtle)',
        focus:            'var(--color-focus)',

        // Charts
        'chart-grid':     'var(--color-chart-grid)',
        'chart-axis':     'var(--color-chart-axis)',

        // Buttons (primary / secondary / danger / outline)
        'btn-primary-bg':     'var(--color-btn-primary-bg)',
        'btn-primary-text':   'var(--color-btn-primary-text)',
        'btn-primary-hover':  'var(--color-btn-primary-hover)',
        'btn-primary-press':  'var(--color-btn-primary-press)',

        'btn-secondary-bg':   'var(--color-btn-secondary-bg)',
        'btn-secondary-text': 'var(--color-btn-secondary-text)',
        'btn-secondary-hover':'var(--color-btn-secondary-hover)',
        'btn-secondary-press':'var(--color-btn-secondary-press)',

        'btn-danger-bg':      'var(--color-btn-danger-bg)',
        'btn-danger-text':    'var(--color-btn-danger-text)',
        'btn-danger-hover':   'var(--color-btn-danger-hover)',
        'btn-danger-press':   'var(--color-btn-danger-press)',

        'btn-outline-bg':     'var(--color-btn-outline-bg)',
        'btn-outline-text':   'var(--color-btn-outline-text)',
        'btn-outline-border': 'var(--color-btn-outline-border)',
        'btn-outline-hover':  'var(--color-btn-outline-hover)',
        'btn-outline-press':  'var(--color-btn-outline-press)',
      },
    },
  },
  plugins: [
    ({ addBase }) =>
      addBase({
        ':root': themeSchema.light,
        '.dark': themeSchema.dark,
      }),
  ],
  darkMode: 'class',
};
