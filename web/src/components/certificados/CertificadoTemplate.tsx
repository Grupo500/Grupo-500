import React from 'react'

interface CertificadoData {
  nombreEstudiante: string
  tipoDocumento: string
  documento: string
  colegio: string
  ciudadColegio: string
  curso: string
  calendario: string
  duracionHoras: number
  tipo: 'CURSANDO' | 'COMPLETADO'
  fechaEmision: string
  numeroCertificado: number
  firmaAndres?: string
}

interface Props {
  data: CertificadoData
  innerRef?: React.Ref<HTMLDivElement>
}

function formatFechaLarga(iso: string) {
  const d = new Date(iso)
  const dia = d.getDate()
  const mes = d.toLocaleDateString('es-CO', { month: 'long' })
  const anio = d.getFullYear()
  return `${dia} días del mes de ${mes} de ${anio}`
}

// ── Iconos como <img> con data URL — html2canvas renderiza <img> con verticalAlign perfectamente ──
const EMAIL_ICON  = "data:image/svg+xml,%3Csvg width='14' height='14' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='2' y='4' width='20' height='16' rx='2' stroke='%23555' stroke-width='1.8'/%3E%3Cpath d='M2 7l10 7 10-7' stroke='%23555' stroke-width='1.8' stroke-linecap='round'/%3E%3C/svg%3E"
const WA_ICON     = "data:image/svg+xml,%3Csvg width='14' height='14' viewBox='0 0 24 24' fill='%2325D366' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.417A9.953 9.953 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a7.95 7.95 0 01-4.054-1.107l-.29-.172-2.953.84.847-2.876-.19-.298A7.96 7.96 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8zm4.406-5.884c-.242-.121-1.432-.707-1.654-.787-.222-.08-.384-.121-.545.121-.162.242-.627.787-.769.949-.141.162-.283.182-.525.06-.242-.12-1.021-.376-1.944-1.199-.719-.641-1.204-1.433-1.345-1.675-.141-.242-.015-.373.106-.493.109-.108.242-.283.363-.424.12-.141.161-.242.242-.403.08-.162.04-.303-.02-.424-.061-.12-.545-1.314-.747-1.799-.196-.473-.396-.409-.545-.417l-.464-.008c-.162 0-.424.06-.646.303-.222.242-.848.829-.848 2.022 0 1.192.868 2.344.989 2.506.121.162 1.708 2.607 4.138 3.655.578.25 1.029.398 1.38.51.58.184 1.108.158 1.526.096.465-.069 1.432-.585 1.634-1.15.201-.565.201-1.049.141-1.15-.06-.1-.222-.162-.464-.283z'/%3E%3C/svg%3E"
const IG_ICON     = "data:image/svg+xml,%3Csvg width='14' height='14' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='2' y='2' width='20' height='20' rx='5' fill='%23dc2743'/%3E%3Ccircle cx='12' cy='12' r='4.5' stroke='white' stroke-width='1.8' fill='none'/%3E%3Ccircle cx='17.5' cy='6.5' r='1' fill='white'/%3E%3C/svg%3E"

const CONTACTOS = [
  { src: EMAIL_ICON, alt: 'Email',     text: 'pregrupo500@gmail.com'      },
  { src: IG_ICON,    alt: 'Instagram', text: '@Preicfes_grupo500'          },
  { src: WA_ICON,    alt: 'WhatsApp',  text: '+57 (316) 8819 037' },
]

export function CertificadoTemplate({ data, innerRef }: Props) {
  const {
    nombreEstudiante, tipoDocumento, documento,
    colegio, ciudadColegio, calendario,
    duracionHoras, tipo, fechaEmision, numeroCertificado,
    firmaAndres,
  } = data

  const tipoBold = tipo === 'CURSANDO' ? 'se encuentra matriculado/a' : 'ha completado satisfactoriamente'

  return (
    <div
      ref={innerRef}
      style={{
        width: '794px',
        height: '1123px',
        backgroundColor: '#ffffff',
        fontFamily: '"Times New Roman", Times, serif',
        position: 'relative',
        padding: '50px 65px 0',
        boxSizing: 'border-box',
        color: '#1a1a1a',
      }}
    >
      {/* ── Marca de agua ── */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: 0.05, pointerEvents: 'none', zIndex: 0,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-grupo500.png" alt="" style={{ width: '420px' }} />
      </div>

      {/* ── Contenido principal ── */}
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-grupo500-transparent.png"
            alt="Grupo 500"
            style={{ width: '130px', height: '130px', objectFit: 'contain', margin: '0 auto 12px' }}
          />
          <p style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.5px', color: '#1a1a1a', margin: 0 }}>
            GRUPO 500 EDUCACIÓN S.A.S &nbsp;–&nbsp; NIT: 901768155-8
          </p>
        </div>

        {/* CERTIFICA */}
        <p style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '2px', textAlign: 'center', marginBottom: '28px' }}>
          CERTIFICA:
        </p>

        {/* Cuerpo */}
        <p style={{ fontSize: '13px', lineHeight: '1.85', textAlign: 'justify', marginBottom: '18px' }}>
          Que el/la estudiante{' '}
          <strong style={{ textTransform: 'uppercase' }}>{nombreEstudiante}</strong>
          {' '}identificado/a con {tipoDocumento} N°{' '}
          <strong>{documento || '_______________'}</strong>
          , estudiante de{' '}
          <strong style={{ textTransform: 'uppercase' }}>{colegio || 'INSTITUCIÓN EDUCATIVA'}</strong>
          {ciudadColegio ? ` de ${ciudadColegio}` : ''},{' '}
          {tipoBold} en nuestro PREICFES Modalidad Virtual.
        </p>

        <p style={{ fontSize: '13px', lineHeight: '1.85', textAlign: 'justify', marginBottom: '32px' }}>
          Pertenece al <strong>Grupo Calendario {calendario} {new Date(fechaEmision).getFullYear()}</strong>.
          El programa académico abarca un total de <strong>{duracionHoras} horas</strong>, e incluye
          asignaturas como <em>lectura crítica, ciencias sociales, inglés, matemáticas, química y biología</em>.
          El horario de las clases es de lunes a viernes de 6:00 p.m. a 8:00 p.m., mientras que los sábados
          se imparten clases en dos bloques: de 8:00 a.m. a 12:00 m. y de 2:00 p.m. a 6:00 p.m.
          Adicionalmente, se realizarán cuatro simulacros y cuatro sesiones de corrección en algunos domingos,
          ocupando la jornada completa.
        </p>

        <p style={{ fontSize: '13px', marginBottom: '36px', fontStyle: 'italic' }}>Atentamente,</p>

        {/* Firma del representante legal */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '36px' }}>
          <div style={{ textAlign: 'center', width: '55%' }}>
            <div style={{ height: '52px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              {firmaAndres && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={firmaAndres} alt="" style={{ maxHeight: '52px', maxWidth: '100%', objectFit: 'contain' }} crossOrigin="anonymous" />
              )}
            </div>
            <div style={{ borderBottom: '1.5px solid #1a1a1a', marginBottom: '6px' }} />
            <p style={{ fontSize: '11.5px', fontWeight: 700, margin: '0 0 2px' }}>ANDRÉS FELIPE DÍAZ RIVERO</p>
            <p style={{ fontSize: '11px', margin: '0 0 2px', color: '#444' }}>CC: 1005480173 Bucaramanga</p>
            <p style={{ fontSize: '11px', margin: 0, color: '#444', fontWeight: 600 }}>Representante Legal</p>
          </div>
        </div>

        {/* Fecha expedición */}
        <p style={{ fontSize: '12.5px', textAlign: 'center', fontWeight: 600 }}>
          Se expide en Bucaramanga, a los {formatFechaLarga(fechaEmision)}
        </p>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* ── Footer anclado al fondo ── */}
        <div style={{ borderTop: '1px solid #d0d0d0', padding: '14px 0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Contacto — tabla con <img> data URL: alineación garantizada en html2canvas */}
          <table cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                {CONTACTOS.map(({ src, alt, text }) => (
                  <React.Fragment key={text}>
                    <td style={{ verticalAlign: 'middle', paddingRight: '5px', paddingTop: '13px', lineHeight: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={alt} width={14} height={14} style={{ display: 'block' }} />
                    </td>
                    <td style={{ verticalAlign: 'middle', fontSize: '10.5px', color: '#444', paddingRight: '22px', whiteSpace: 'nowrap' }}>
                      {text}
                    </td>
                  </React.Fragment>
                ))}
              </tr>
            </tbody>
          </table>

          {/* Número */}
          <p style={{ margin: 0, fontSize: '10px', color: '#aaa', whiteSpace: 'nowrap' }}>
            Certificado N° {numeroCertificado}
          </p>
        </div>
      </div>
    </div>
  )
}
