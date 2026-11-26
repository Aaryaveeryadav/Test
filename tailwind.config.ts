import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif']
      },
      colors: {
        cream: '#FFF9F2',
        blush: {
          50: '#FDF4F2',
          100: '#FBEAE7',
          200: '#F5D3CF'
        },
        hl: '#BFD7EA',
        ink: '#26221E'
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(38 34 30 / 0.05), 0 4px 14px -2px rgb(38 34 30 / 0.06)',
        pop: '0 2px 4px 0 rgb(38 34 30 / 0.06), 0 10px 28px -6px rgb(38 34 30 / 0.16)'
      }
    }
  },
  plugins: []
}

export default config
