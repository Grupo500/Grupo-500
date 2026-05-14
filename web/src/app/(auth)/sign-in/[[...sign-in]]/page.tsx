import { SignIn } from '@clerk/nextjs'
import Image from 'next/image'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md flex flex-col gap-8">

        {/* Logo */}
        <div className="w-full flex flex-col items-center gap-2">
          <Image
            src="/logo.png"
            alt="Grupo 500"
            width={120}
            height={120}
            className="drop-shadow-sm"
            priority
          />
          <p className="text-sm text-on-surface-variant mt-0.5 text-center w-full">Plataforma Pre-ICFES</p>
        </div>

        {/* Clerk SignIn con variables de diseño */}
        <SignIn
          forceRedirectUrl="/verificando"
          appearance={{
            variables: {
              colorBackground:        '#ffffff',
              colorInputBackground:   '#f4f8ff',
              colorText:              '#001d3d',
              colorTextSecondary:     '#2a4172',
              colorPrimary:           '#1a7de0',
              colorDanger:            '#c0392b',
              colorSuccess:           '#087a50',
              colorNeutral:           '#5a74a8',
              colorInputText:         '#001d3d',
              borderRadius:           '0.5rem',
              fontFamily:             'Inter, sans-serif',
              fontSize:               '14px',
            },
            elements: {
              rootBox:           'w-full',
              cardBox:           'w-full',
              card:              'w-full shadow-none border border-black/[0.07] rounded-xl',
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
              header:            'hidden',
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
