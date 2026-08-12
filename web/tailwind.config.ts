import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'
// El calendario de ReUI usa container queries (@container, @[8rem]:) para que
// los chips y las cabeceras se adapten al ancho de su celda, no al del viewport.
// En Tailwind v4 son nativas; en la v3 de este proyecto vienen de este plugin.
import containerQueries from '@tailwindcss/container-queries'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          low:     'var(--surface-low)',
          high:    'var(--surface-high)',
          highest: 'var(--surface-highest)',
          lowest:  'var(--surface-lowest)',
        },
        primary: {
          DEFAULT:   'var(--primary)',
          on:        'var(--primary-on)',
          container: 'var(--primary-container)',
          dim:       'var(--primary-dim)',
        },
        secondary: {
          DEFAULT:   'var(--secondary)',
          on:        'var(--secondary-on)',
          container: 'var(--secondary-container)',
          dim:       'var(--secondary-dim)',
        },
        tertiary: {
          DEFAULT:   'var(--tertiary)',
          on:        'var(--tertiary-on)',
          container: 'var(--tertiary-container)',
          dim:       'var(--tertiary-dim)',
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

        // ── Puente para los componentes de ReUI (src/components/reui) ──
        // Vienen escritos con el vocabulario de shadcn (bg-muted,
        // text-muted-foreground, border-border…), que no existe en este
        // proyecto: aquí se usa un sistema Material propio. En vez de editar
        // los 13 archivos del calendario —que así siguen actualizándose desde
        // el registry sin tocarlos— se traduce cada nombre al token de la app.
        // Todos apuntan a las mismas variables CSS, así que el claro/oscuro
        // sale gratis.
        foreground:   'var(--on-surface)',
        card:         'var(--surface-lowest)',
        popover:      'var(--surface-lowest)',
        muted:        'var(--surface-low)',
        input:        'var(--outline-variant)',
        ring:         'var(--primary)',
        border:       'var(--outline-variant)',
        'card-foreground':      'var(--on-surface)',
        'popover-foreground':   'var(--on-surface)',
        'muted-foreground':     'var(--on-surface-variant)',
        'primary-foreground':   'var(--primary-on)',
        'secondary-foreground': 'var(--secondary-on)',
        // `accent` en shadcn es el fondo de hover neutro, no un color de
        // marca: se mapea a una superficie, no al --accent de la app.
        accent:                 'var(--surface-high)',
        'accent-foreground':    'var(--on-surface)',
        destructive:            'var(--error)',
        'destructive-foreground': 'var(--error-container)',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display':      ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg':  ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-md':  ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'title-lg':     ['20px', { lineHeight: '28px', fontWeight: '500' }],
        'body-lg':      ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md':      ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'data-mono':    ['14px', { lineHeight: '20px', fontWeight: '500' }],
        'label-md':     ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '600' }],
      },
      // Stitch design system: 4px default, 8px cards, 12px modals
      borderRadius: {
        sm:      '4px',
        DEFAULT: '6px',
        md:      '8px',
        lg:      '12px',
        xl:      '16px',
        '2xl':   '24px',
        full:    '9999px',
      },
      boxShadow: {
        card:       'var(--shadow-card)',
        float:      'var(--shadow-float)',
        diffused:   'var(--shadow-diffused)',
        'focus-ring': '0 0 0 2px var(--primary)',
      },
      spacing: {
        '4.5': '1.125rem',
        '18':  '4.5rem',
        '22':  '5.5rem',
        '58':  '14.5rem',
        '68':  '17rem',
        '72':  '18rem',
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'spin-slow':  'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(10px) scale(0.98)' },
          to:   { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      maxWidth: { container: '1440px' },
    },
  },
  plugins: [animate, containerQueries],
}

export default config
