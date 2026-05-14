import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Todos los colores apuntan a CSS variables → soportan dark/light automáticamente
        background:  'var(--bg)',
        surface: {
          DEFAULT:  'var(--surface)',
          low:      'var(--surface-low)',
          high:     'var(--surface-high)',
          highest:  'var(--surface-highest)',
          lowest:   'var(--surface-lowest)',
        },
        primary: {
          DEFAULT:   'var(--primary)',
          on:        'var(--primary-on)',
        },
        secondary: {
          DEFAULT:   'var(--secondary)',
          on:        'var(--secondary-on)',
        },
        tertiary: {
          DEFAULT:   'var(--tertiary)',
          on:        'var(--tertiary-on)',
        },
        error: {
          DEFAULT:   'var(--error)',
          container: 'var(--error-container)',
        },
        outline: {
          DEFAULT: 'var(--outline)',
          variant: 'var(--outline-variant)',
        },
        'on-surface':         'var(--on-surface)',
        'on-surface-variant': 'var(--on-surface-variant)',
        'on-primary':         'var(--primary-on)',
        'on-secondary':       'var(--secondary-on)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display':       ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg':   ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-md':   ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'title-lg':      ['20px', { lineHeight: '28px', fontWeight: '500' }],
        'body-lg':       ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md':       ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'label-md':      ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '600' }],
      },
      borderRadius: {
        sm:      '4px',
        DEFAULT: '8px',
        md:      '12px',
        lg:      '16px',
        xl:      '24px',
        full:    '9999px',
      },
      boxShadow: {
        card:         'var(--shadow-card)',
        float:        'var(--shadow-float)',
        glow:         '0 0 20px color-mix(in srgb, var(--primary) 20%, transparent)',
        'glow-green': '0 0 20px color-mix(in srgb, var(--secondary) 25%, transparent)',
        'glow-amber': '0 0 20px color-mix(in srgb, var(--tertiary) 25%, transparent)',
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
      maxWidth: { container: '1440px' },
    },
  },
  plugins: [animate],
}

export default config
