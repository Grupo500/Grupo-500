import { Header } from './Header'

/**
 * La franja de marca es cosa de escritorio (Hotman, 21-ago).
 *
 * - **Escritorio: siempre.** Hay alto de sobra y la franja es la marca de la
 *   app; quitarla dejaba las pantallas internas empezando en el vacío.
 * - **Celular: nunca.** Repetía el nombre de la app encima de cada pantalla de
 *   la app, y se llevaba 52px de la parte de arriba, que es la que se ve sin
 *   desplazar. Los tres botones que vivían ahí —inicio, notificaciones y
 *   actualizar— bajaron al renglón del título de cada portada, con
 *   `AccionesPortada`.
 *
 * Se oculta con CSS y no dejando de renderizarla, para que el servidor y el
 * navegador pinten lo mismo: decidirlo con el ancho de la ventana provoca un
 * parpadeo en la primera carga.
 */
export function HeaderCondicional() {
  return (
    <>
      {/* Sin franja, el espacio de la muesca del teléfono lo reserva esta
          tira: si no, el título se mete debajo del reloj y la señal cuando la
          app está instalada en la pantalla de inicio. */}
      <div className="flex-shrink-0 md:hidden" style={{ height: 'env(safe-area-inset-top)' }} />
      <Header className="max-md:hidden" />
    </>
  )
}
