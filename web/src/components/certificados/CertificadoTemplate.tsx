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

export function CertificadoTemplate({ data, innerRef }: Props) {
  const {
    nombreEstudiante, tipoDocumento, documento,
    colegio, ciudadColegio, curso, calendario,
    duracionHoras, tipo, fechaEmision, numeroCertificado,
  } = data

  const tipoBold = tipo === 'CURSANDO' ? 'se encuentra matriculado/a' : 'ha completado satisfactoriamente'
  const modalidad = 'Modalidad Virtual'

  return (
    <div
      ref={innerRef}
      style={{
        width: '794px',
        minHeight: '1123px',
        backgroundColor: '#ffffff',
        fontFamily: 'Georgia, "Times New Roman", serif',
        position: 'relative',
        padding: '50px 65px 40px',
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
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-grupo500-transparent.png"
            alt="Grupo 500"
            style={{ width: '90px', height: '90px', objectFit: 'contain', margin: '0 auto 12px' }}
          />
          <p style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.5px', color: '#1a1a1a', margin: 0 }}>
            PREICFES GRUPO 500 &nbsp;–&nbsp; NIT: 901768155-8
          </p>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '2px solid #1a1a1a', borderBottom: '1px solid #1a1a1a', padding: '4px 0', textAlign: 'center', marginBottom: '28px' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '2px', margin: 0 }}>CERTIFICA:</p>
        </div>

        {/* Cuerpo */}
        <p style={{ fontSize: '13px', lineHeight: '1.85', textAlign: 'justify', marginBottom: '18px' }}>
          Que el/la estudiante{' '}
          <strong style={{ textTransform: 'uppercase' }}>{nombreEstudiante}</strong>
          {' '}identificado/a con {tipoDocumento} N°{' '}
          <strong>{documento || '_______________'}</strong>
          , estudiante de{' '}
          <strong style={{ textTransform: 'uppercase' }}>{colegio || 'INSTITUCIÓN EDUCATIVA'}</strong>
          {ciudadColegio ? ` de ${ciudadColegio}` : ''},{' '}
          {tipoBold} en nuestro PREICFES {modalidad}.
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

        {/* Firmas */}
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '36px' }}>
          {[
            { nombre: 'SEBASTIÁN FERNANDO FLÓREZ DUARTE', cc: '10052823 14 Bucaramanga' },
            { nombre: 'ANDRÉS FELIPE DÍAZ RIVERO', cc: '1005480173 Bucaramanga' },
          ].map((f) => (
            <div key={f.cc} style={{ textAlign: 'center', width: '45%' }}>
              <div style={{ borderBottom: '1.5px solid #1a1a1a', marginBottom: '6px', height: '40px' }} />
              <p style={{ fontSize: '11.5px', fontWeight: 700, margin: '0 0 2px' }}>{f.nombre}</p>
              <p style={{ fontSize: '11px', margin: 0, color: '#444' }}>CC: {f.cc}</p>
            </div>
          ))}
        </div>

        {/* Fecha expedición */}
        <p style={{ fontSize: '12.5px', textAlign: 'center', fontWeight: 600, marginBottom: '32px' }}>
          Se expide en Bucaramanga, a los {formatFechaLarga(fechaEmision)}
        </p>

        {/* ── Footer mejorado ── */}
        <div style={{
          borderTop: '1.5px solid #e0e0e0',
          paddingTop: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          {/* Logo pequeño */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-grupo500-transparent.png"
            alt="Grupo 500"
            style={{ width: '48px', height: '48px', objectFit: 'contain', flexShrink: 0 }}
          />

          {/* Info contacto */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <p style={{ margin: 0, fontSize: '11.5px', fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.3px' }}>
              PREICFES GRUPO 500
            </p>
            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10.5px', color: '#444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                ✉ pregrupo500@gmail.com
              </span>
              <span style={{ fontSize: '10.5px', color: '#444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                📷 @Preicfes_grupo500
              </span>
              <span style={{ fontSize: '10.5px', color: '#444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                💬 WhatsApp: 3168819037 · 3174294954
              </span>
            </div>
          </div>

          {/* Número de certificado */}
          <p style={{ margin: 0, fontSize: '10px', color: '#999', flexShrink: 0 }}>
            Certificado número {numeroCertificado}
          </p>
        </div>
      </div>
    </div>
  )
}
