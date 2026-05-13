import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Design System — Academic Intelligence
        background:  '#10131a',
        surface: {
          DEFAULT:  '#1d2027',
          low:      '#191b23',
          high:     '#272a31',
          highest:  '#32353c',
          lowest:   '#0b0e15',
        },
        primary: {
          DEFAULT:   '#adc6ff',
          container: '#4d8eff',
          on:        '#002e6a',
        },
        secondary: {
          DEFAULT:   '#4edea3',
          container: '#00a572',
          on:        '#003824',
        },
        tertiary: {
          DEFAULT:   '#ffb95f',
          container: '#ca8100',
          on:        '#472a00',
        },
        error: {
          DEFAULT:   '#ffb4ab',
          container: '#93000a',
        },
        outline: {
          DEFAULT: '#8c909f',
          variant: '#424754',
        },
        'on-surface':         '#e1e2ec',
        'on-surface-variant': '#c2c6d6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-md': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'title-lg':    ['20px', { lineHeight: '28px', fontWeight: '500' }],
        'body-lg':     ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md':     ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'label-md':    ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '600' }],
      },
      borderRadius: {
        sm:   '4px',
        DEFAULT: '8px',
        md:   '12px',
        lg:   '16px',
        xl:   '24px',
        full: '9999px',
      },
      boxShadow: {
        card:  '0 0 0 1px rgba(255,255,255,0.08)',
        float: '0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)',
        glow:  '0 0 20px rgba(173,198,255,0.15)',
        'glow-green': '0 0 20px rgba(78,222,163,0.2)',
        'glow-amber': '0 0 20px rgba(255,185,95,0.2)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '68': '17rem',
        '72': '18rem',
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      maxWidth: {
        container: '1440px',
      },
    },
  },
  plugins: [animate],
}

export default config
