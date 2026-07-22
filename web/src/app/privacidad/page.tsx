export const metadata = {
  title: 'Política de Privacidad — Grupo 500',
  description: 'Política de tratamiento de datos personales de Grupo 500 Educación S.A.S.',
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-slate-900 mb-2">{titulo}</h2>
      <div className="text-[15px] leading-relaxed text-slate-700 space-y-3">{children}</div>
    </section>
  )
}

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Política de Privacidad</h1>
        <p className="text-sm text-slate-500 mb-10">Última actualización: julio de 2026</p>

        <Seccion titulo="1. Responsable del tratamiento">
          <p>
            El responsable del tratamiento de los datos personales recolectados a través de la plataforma
            Grupo 500 (sitio web, aplicación móvil y demás canales digitales, en adelante "la Plataforma")
            es <strong>GRUPO 500 EDUCACIÓN S.A.S.</strong>, con domicilio en Colombia, quien actuará
            directamente o por medio de terceros encargados del tratamiento (como proveedores de
            infraestructura tecnológica), garantizando la adopción de las medidas técnicas, humanas y
            administrativas necesarias para proteger la información personal de los titulares y evitar su
            adulteración, pérdida, consulta, uso o acceso no autorizado o fraudulento.
          </p>
          <p>
            Este tratamiento se realiza de conformidad con la Constitución Política de Colombia, la Ley
            1581 de 2012, el Decreto 1074 de 2015 y demás normas que las modifiquen, adicionen o
            complementen.
          </p>
        </Seccion>

        <Seccion titulo="2. Datos que recolectamos">
          <p>Dependiendo de cómo interactúes con la Plataforma, podemos recolectar:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Nombre completo y tipo/número de documento de identidad.</li>
            <li>Correo electrónico y número de teléfono/WhatsApp.</li>
            <li>Información académica: colegio, curso matriculado, calendario, resultados de simulacros.</li>
            <li>Información de pagos e historial de matrícula (no procesamos ni almacenamos datos de tarjetas; los pagos se gestionan a través de pasarelas externas).</li>
            <li>Fotografía de perfil (opcional, cargada por el usuario o tomada de su cuenta de Google).</li>
            <li>Datos de inicio de sesión, si usas "Continuar con Google" (nombre, correo y foto de tu cuenta de Google, según los permisos que autorices).</li>
            <li>Información técnica básica del dispositivo (tipo de dispositivo, sistema operativo) para el correcto funcionamiento de notificaciones push, cuando las habilitas.</li>
          </ul>
        </Seccion>

        <Seccion titulo="3. Finalidades del tratamiento">
          <p>Los datos personales recolectados serán utilizados para:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Registrar, autenticar y gestionar tu cuenta en la Plataforma.</li>
            <li>Administrar la matrícula, el progreso académico y la generación de certificados.</li>
            <li>Gestionar cobros, recordatorios de pago y estados de cuenta.</li>
            <li>Enviar notificaciones relevantes (correo, WhatsApp o push) sobre tu curso, pagos o novedades académicas.</li>
            <li>Atender solicitudes, peticiones, quejas o reclamos.</li>
            <li>Realizar análisis estadístico interno, auditoría y prevención de fraude.</li>
            <li>Cumplir obligaciones legales, contractuales y regulatorias.</li>
          </ul>
          <p>
            No vendemos ni compartimos tus datos personales con terceros para fines publicitarios ajenos a
            Grupo 500.
          </p>
        </Seccion>

        <Seccion titulo="4. Con quién compartimos datos">
          <p>
            Para operar la Plataforma trabajamos con proveedores de infraestructura que procesan datos en
            nuestro nombre, bajo acuerdos de confidencialidad: hosting y base de datos (Railway), hosting
            del sitio web (Vercel), almacenamiento de imágenes y archivos (Cloudinary), autenticación con
            Google, y pasarelas de pago para el procesamiento de matrículas. Estos proveedores no están
            autorizados a usar tus datos para fines distintos a la prestación del servicio contratado.
          </p>
        </Seccion>

        <Seccion titulo="5. Uso de nombre, imagen y testimonios">
          <p>
            En programas específicos (como referidos, rankings de rendimiento académico o campañas
            promocionales), y únicamente mediante autorización previa, expresa y voluntaria otorgada a
            través de los formularios dispuestos para tal fin, Grupo 500 podrá usar tu nombre, imagen, voz,
            fotografías, videos o testimonios en publicaciones institucionales, redes sociales o material
            promocional. Esta autorización es siempre opcional y su no otorgamiento no limita ni afecta el
            acceso a los servicios de la Plataforma.
          </p>
        </Seccion>

        <Seccion titulo="6. Principios aplicables">
          <p>
            El tratamiento de tus datos se rige por los principios de legalidad, finalidad, libertad,
            veracidad o calidad, transparencia, acceso y circulación restringida, seguridad y
            confidencialidad.
          </p>
        </Seccion>

        <Seccion titulo="7. Tus derechos">
          <p>Como titular de tus datos personales, puedes en cualquier momento:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Conocer, actualizar y rectificar tus datos personales.</li>
            <li>Solicitar prueba de la autorización otorgada.</li>
            <li>Ser informado sobre el uso dado a tus datos.</li>
            <li>Revocar la autorización y/o solicitar la supresión de tus datos, cuando sea procedente.</li>
            <li>Presentar consultas, peticiones, quejas o reclamos relacionados con el tratamiento de tu información.</li>
            <li>Acceder de manera gratuita a los datos objeto de tratamiento.</li>
          </ul>
        </Seccion>

        <Seccion titulo="8. Cómo ejercer tus derechos">
          <p>
            Puedes ejercer estos derechos escribiendo a{' '}
            <a href="mailto:pregrupo500@gmail.com" className="text-blue-600 underline">pregrupo500@gmail.com</a>{' '}
            o por WhatsApp al{' '}
            <a href="https://wa.me/573164134212" className="text-blue-600 underline">+57 316 413 4212</a>.
            Daremos trámite a tu solicitud dentro de los términos establecidos en la Ley 1581 de 2012 y
            demás normas aplicables.
          </p>
        </Seccion>

        <Seccion titulo="9. Conservación de la información">
          <p>
            Tus datos personales se conservarán únicamente durante el tiempo necesario para cumplir las
            finalidades aquí descritas, las obligaciones legales o contractuales aplicables, o mientras
            subsista la autorización otorgada. Puedes solicitar la eliminación de tu cuenta y datos
            asociados en cualquier momento a través de los canales de contacto anteriores.
          </p>
        </Seccion>

        <Seccion titulo="10. Aplicación móvil">
          <p>
            La aplicación móvil de Grupo 500 (Android/iOS) accede al mismo servicio y a los mismos datos
            que la versión web — no recolecta información adicional distinta a la aquí descrita. La app
            puede solicitar permiso para enviarte notificaciones push; puedes desactivarlas en cualquier
            momento desde los ajustes de tu dispositivo.
          </p>
        </Seccion>

        <Seccion titulo="11. Cambios a esta política">
          <p>
            Grupo 500 Educación S.A.S. podrá modificar o actualizar esta política en cualquier momento,
            publicando la versión vigente en esta misma página.
          </p>
        </Seccion>
      </div>
    </main>
  )
}
