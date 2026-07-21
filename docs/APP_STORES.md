# Publicar Grupo 500 en Google Play y App Store

La app móvil (`mobile/`) es un envoltorio [Capacitor](https://capacitorjs.com) que abre `https://grupo500educacion.co` en un WebView nativo — no duplica código, cualquier cambio en `web/` se refleja automáticamente en la app sin recompilar ni volver a publicar (excepto cambios de ícono/splash/config nativa, que sí requieren recompilar).

## Estado actual

- ✅ Proyecto Android generado y validado (`npx cap doctor` → "Android looking great").
- ✅ Proyecto iOS generado (`mobile/ios/`), pero **no se puede compilar sin una Mac con Xcode**.
- ✅ Íconos y splash screen generados a partir del logo de Grupo 500.
- ⏳ Cuentas de desarrollador: **pendientes, las creas tú** (no puedo pagarlas ni crearlas por ti).

## Lo que falta hacer, en orden

### 1. Cuentas de desarrollador

- **Google Play Console**: [play.google.com/console](https://play.google.com/console) — pago único de $25 USD.
- **Apple Developer Program**: [developer.apple.com/programs](https://developer.apple.com/programs) — $99 USD/año. Necesitas una Mac (propia o alquilada, ej. MacinCloud) para compilar y subir la app de iOS.

### 2. Android — compilar y probar

Requiere JDK y Android Studio instalados (ya tienes un emulador configurado, según mencionaste).

```bash
cd mobile
npm install
npx cap sync android
cd android
./gradlew assembleDebug
```

El APK de prueba queda en `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. Instálalo en tu emulador o en un celular Android real para confirmar que:
- Abre y carga `grupo500educacion.co` correctamente.
- El login funciona (Google y usuario/contraseña).
- Las funciones clave (dashboard, estudiantes, certificados, etc.) se ven bien en pantalla móvil.

### 3. Android — firmar y subir a Play Store

1. Generar un keystore de firma (una sola vez, **guárdalo en un lugar seguro** — si lo pierdes no podrás actualizar la app nunca más):
   ```bash
   keytool -genkey -v -keystore grupo500-release.keystore -alias grupo500 -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Compilar el paquete de release (`.aab`, formato que exige Play Store):
   ```bash
   cd mobile/android
   ./gradlew bundleRelease
   ```
3. En Play Console: crear la app → completar ficha (nombre, descripción, categoría, ícono, capturas de pantalla) → subir el `.aab` en "Producción" o primero en "Prueba interna" → completar el cuestionario de clasificación de contenido → agregar la **URL de política de privacidad** (obligatoria).

### 4. iOS — compilar y subir a App Store (requiere Mac)

1. En una Mac: `cd mobile && npx cap sync ios && npx cap open ios` (abre Xcode).
2. En el portal de Apple Developer: crear el identificador de la app (`com.grupo500.app`), certificados de distribución y perfil de aprovisionamiento.
3. En Xcode: seleccionar el equipo de firma, Product → Archive, subir con Xcode Organizer o Transporter.
4. En App Store Connect: crear la ficha de la app (capturas, descripción, categoría, clasificación de edad, política de privacidad).

### 5. Checklist de revisión de las tiendas

Como la app es esencialmente un WebView de un sitio existente, ambas tiendas (sobre todo Apple) revisan que no se sienta como "solo un sitio envuelto":
- Splash screen nativo (ya configurado) y sin flashes/parpadeos raros al abrir.
- Navegación fluida, sin barras de navegador visibles (Capacitor ya lo hace).
- Manejo correcto de gestos nativos (volver atrás en Android, swipe en iOS).
- Política de privacidad pública y accesible desde una URL real.
- Sin contenido roto ni enlaces a "próximamente" — todo lo que se muestre debe funcionar.
- Apple exige explícitamente valor agregado más allá de un browser: el splash screen, íconos nativos y la ausencia de UI de navegador ya ayudan a esto.

## Cambiar ícono o URL de producción más adelante

- **Ícono/splash**: reemplaza los archivos en `mobile/assets/` (`icon-only.png`, `icon-foreground.png`, `icon-background.png`, `splash.png`, `splash-dark.png` — mínimo recomendado 1024×1024 para íconos, 2732×2732 para splash) y corre `npx capacitor-assets generate` de nuevo desde `mobile/`. **El logo fuente actual (512×512) es más pequeño que lo recomendado** — para mejor calidad en las tiendas, conviene subir una versión de al menos 1024×1024 antes de publicar.
- **Dominio**: si el dominio de producción cambia, edita `server.url` en `mobile/capacitor.config.ts` y vuelve a compilar/subir una nueva versión a ambas tiendas.
