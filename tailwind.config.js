/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ui: {
          canvas: 'var(--ui-bg)',
          panel: 'var(--ui-panel)',
          rail: 'var(--ui-rail)',
          input: 'var(--ui-input)',
          text: 'var(--ui-text)',
          muted: 'var(--ui-muted)',
          line: 'var(--ui-line)',
          accent: 'var(--ui-accent)',
          'accent-hover': 'var(--ui-accent-hover)',
          soft: 'var(--ui-soft)',
          hover: 'var(--ui-hover)',
          'on-accent': 'var(--ui-on-accent)',
          warning: 'var(--ui-warning)',
          'warning-soft': 'var(--ui-warning-soft)',
          success: 'var(--ui-success)',
          'success-soft': 'var(--ui-success-soft)',
          danger: 'var(--ui-danger)',
          'danger-soft': 'var(--ui-danger-soft)',
        },
      },
    },
  },
  plugins: [],
}
