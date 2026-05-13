import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <SignUp
        appearance={{
          elements: {
            rootBox: 'w-full max-w-md',
            card: 'bg-surface border border-white/[0.08] shadow-float rounded-lg',
            headerTitle: 'text-on-surface',
            formButtonPrimary: 'bg-primary text-on-primary hover:bg-primary/90',
            formFieldInput: 'bg-surface-lowest border-outline-variant text-on-surface',
            footerActionLink: 'text-primary',
          },
        }}
      />
    </div>
  )
}
