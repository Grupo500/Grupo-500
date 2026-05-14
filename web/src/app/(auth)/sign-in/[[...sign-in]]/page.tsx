import { SignIn } from '@clerk/nextjs'
import { GraduationCap } from 'lucide-react'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md space-y-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-on-surface tracking-tight">Grupo 500</p>
            <p className="text-sm text-on-surface-variant mt-0.5">Plataforma Pre-ICFES</p>
          </div>
        </div>

        {/* Clerk SignIn con variables de diseño */}
        <SignIn
          appearance={{
            variables: {
              colorBackground:        '#161a24',
              colorInputBackground:   '#1e2436',
              colorText:              '#e2e8f6',
              colorTextSecondary:     '#8a93b0',
              colorPrimary:           '#adc6ff',
              colorDanger:            '#f87171',
              colorSuccess:           '#4edea3',
              colorNeutral:           '#8a93b0',
              colorInputText:         '#e2e8f6',
              borderRadius:           '0.5rem',
              fontFamily:             'Inter, sans-serif',
              fontSize:               '14px',
            },
            elements: {
              rootBox:           'w-full',
              card:              'shadow-none border border-white/[0.07] rounded-xl',
              headerTitle:       'text-base font-semibold',
              headerSubtitle:    'text-sm',
              socialButtonsBlockButton:
                'border border-white/[0.08] hover:border-white/20 transition-colors',
              dividerLine:       'bg-white/[0.07]',
              dividerText:       'text-xs',
              formFieldLabel:    'text-xs font-medium',
              formFieldInput:    'border border-white/[0.08] focus:border-primary/50 rounded-lg text-sm',
              formButtonPrimary:
                'bg-primary hover:bg-primary/90 text-[#0a0d14] font-semibold rounded-lg transition-colors shadow-none',
              footerActionLink:  'text-primary hover:text-primary/80 font-medium',
              identityPreviewText: 'text-sm',
              identityPreviewEditButtonIcon: 'text-primary',
              alertText:         'text-sm',
            },
          }}
        />
      </div>
    </div>
  )
}
