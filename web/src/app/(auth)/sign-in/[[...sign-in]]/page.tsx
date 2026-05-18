import { SignIn } from '@clerk/nextjs'
import Image from 'next/image'
import { Poppins } from 'next/font/google'

const poppins = Poppins({ subsets: ['latin'], weight: ['700'] })

export default function SignInPage() {
  return (
    <div className="h-dvh w-full overflow-y-auto overflow-x-hidden flex flex-col items-center justify-center gap-4 px-4 py-4" style={{ background: '#21b9f7' }}>

      {/* Logo */}
      <div className="flex flex-col items-center gap-2">
        <Image
          src="/logo-grupo500.png"
          alt="Grupo 500"
          width={120}
          height={120}
          className="rounded-full object-cover w-36 h-36 md:w-32 md:h-32 lg:w-28 lg:h-28"
          priority
        />
        <p className={`${poppins.className} text-xl md:text-lg lg:text-base font-bold tracking-tight text-on-surface mt-0.5`}>Grupo 500</p>
        <p className="text-sm md:text-xs font-medium text-on-surface-variant -mt-1">Pre-ICFES</p>
      </div>

      {/* Clerk SignIn */}
      <div className="w-full max-w-sm">

        {/* Título encima de la tarjeta */}
        <p className="text-[13px] font-semibold text-on-surface-variant mb-2 text-center">
          Inicia sesión con:
        </p>

        <SignIn
          forceRedirectUrl="/verificando"
          signUpUrl="/sign-up"
          appearance={{
            layout: {
              socialButtonsPlacement: 'top',
            },
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
              rootBox:          'mx-auto',
              card:             'shadow-none border border-black/[0.07] rounded-xl',
              header:           'hidden',
              socialButtonsBlockButtonText: 'text-xs font-medium',
              socialButtonsBlockButton:
                'border border-black/[0.08] hover:bg-black/[0.03] transition-colors rounded-lg',
              dividerLine:      'bg-black/[0.08]',
              dividerText:      'text-xs text-[#5a74a8]',
              formFieldLabel:   'text-xs font-medium text-[#2a4172]',
              formFieldInput:   'border border-black/[0.10] focus:border-[#1a7de0]/50 rounded-lg !text-[13px] !py-1.5 !px-3 bg-[#f4f8ff]',
              formButtonPrimary:
                'bg-[#1a7de0] hover:bg-[#1570cc] text-white font-semibold rounded-lg transition-colors shadow-none',
              footerActionLink: 'text-[#1a7de0] hover:text-[#1570cc] font-medium',
              footer:           'hidden',
              identityPreviewText: 'text-sm',
              identityPreviewEditButtonIcon: 'text-[#1a7de0]',
              alertText:        'text-sm',
            },
          }}
        />
      </div>
    </div>
  )
}
