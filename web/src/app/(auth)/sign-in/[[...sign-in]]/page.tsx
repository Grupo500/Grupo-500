import { SignIn } from '@clerk/nextjs'
import Image from 'next/image'
import { Poppins } from 'next/font/google'

const poppins = Poppins({ subsets: ['latin'], weight: ['700'] })

export default function SignInPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-8 p-4 py-8" style={{ background: 'var(--bg)' }}>

      {/* Logo */}
      <div className="flex flex-col items-center gap-2">
        <Image
          src="/logo.png"
          alt="Grupo 500"
          width={120}
          height={120}
          className="drop-shadow-sm"
          priority
        />
        <p className={`${poppins.className} text-sm font-bold tracking-normal uppercase text-primary mt-1`}>App Grupo 500</p>
      </div>

      {/* Clerk SignIn */}
      <SignIn
        forceRedirectUrl="/verificando"
        signUpUrl="/sign-up"
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
            rootBox:           'mx-auto',
            card:              'shadow-none border border-black/[0.07] rounded-xl',
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
  )
}
