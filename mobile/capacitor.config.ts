import type { CapacitorConfig } from '@capacitor/cli'

// La app no empaqueta el build web (webDir es un placeholder que Capacitor
// exige pero nunca sirve) — el WebView navega directo a la app en producción,
// así reusamos el mismo código de web/ sin duplicar ni reescribir nada.
const config: CapacitorConfig = {
  appId: 'com.grupo500.app',
  appName: 'Grupo 500',
  webDir: 'www',
  server: {
    url: 'https://grupo500educacion.co',
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: '#0a1628',
      showSpinner: false,
    },
  },
}

export default config
