import { SignUp } from '@clerk/nextjs'
import { GraduationCap } from 'lucide-react'

export default function SignUpPage() {
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

        <SignUp
          forceRedirectUrl="/verificando"
          appearance={{
            variables: {
              colorBackground:      '#ffffff',
              colorInputBackground: '#f4f8ff',
              colorText:            '#001d3d',
              colorTextSecondary:   '#2a4172',
              colorPrimary:         '#1a7de0',
              colorDanger:          '#c0392b',
              colorSuccess:         '#087a50',
              colorNeutral:         '#5a74a8',
              colorInputText:       '#001d3d',
              borderRadius:         '0.5rem',
              fontFamily:           'Inter, sans-serif',
              fontSize:             '14px',
            },
            elements: {
              rootBox:          'w-full',
              card:             'shadow-none border border-black/[0.07] rounded-xl',
              header:           'hidden',
              formFieldLabel:   'text-xs font-medium',
              formFieldInput:   'border border-white/[0.08] focus:border-primary/50 rounded-lg text-sm',
              formButtonPrimary:
                'bg-primary hover:bg-primary/90 text-[#0a0d14] font-semibold rounded-lg transition-colors shadow-none',
              footerActionLink: 'text-primary hover:text-primary/80 font-medium',
              alertText:        'text-sm',
            },
          }}
        />
      </div>
    </div>
  )
}
