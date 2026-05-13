import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <span className="text-primary font-bold text-lg">G</span>
            </div>
            <div className="text-left">
              <p className="text-xl font-bold text-on-surface">Grupo 500</p>
              <p className="text-xs text-on-surface-variant">Plataforma Pre-ICFES</p>
            </div>
          </div>
        </div>

        <SignIn
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'bg-surface border border-white/[0.08] shadow-float rounded-lg',
              headerTitle: 'text-on-surface',
              headerSubtitle: 'text-on-surface-variant',
              formButtonPrimary: 'bg-primary text-on-primary hover:bg-primary/90',
              formFieldInput: 'bg-surface-lowest border-outline-variant text-on-surface',
              footerActionLink: 'text-primary hover:text-primary/80',
            },
          }}
        />
      </div>
    </div>
  )
}
