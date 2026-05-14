import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // Colegios
  const colegios = await Promise.all([
    prisma.colegio.upsert({ where: { nombre: 'Colegio La Salle' }, update: {}, create: { nombre: 'Colegio La Salle', ciudad: 'Bogotá' } }),
    prisma.colegio.upsert({ where: { nombre: 'Instituto Técnico Central' }, update: {}, create: { nombre: 'Instituto Técnico Central', ciudad: 'Bogotá' } }),
    prisma.colegio.upsert({ where: { nombre: 'Colegio San Bartolomé' }, update: {}, create: { nombre: 'Colegio San Bartolomé', ciudad: 'Bogotá' } }),
    prisma.colegio.upsert({ where: { nombre: 'INEM Francisco de Paula Santander' }, update: {}, create: { nombre: 'INEM Francisco de Paula Santander', ciudad: 'Bogotá' } }),
    prisma.colegio.upsert({ where: { nombre: 'Colegio Mayor de San Bartolomé' }, update: {}, create: { nombre: 'Colegio Mayor de San Bartolomé', ciudad: 'Medellín' } }),
  ])
  console.log(`✅ ${colegios.length} colegios creados`)

  // Cursos
  const cursos = await Promise.all([
    prisma.curso.upsert({ where: { id: 'curso-icfes-intensivo' }, update: {}, create: { id: 'curso-icfes-intensivo', nombre: 'Curso Intensivo ICFES', descripcion: 'Preparación completa para el ICFES con simulacros semanales y refuerzo personalizado.', precio: 850000, duracionDias: 90 } }),
    prisma.curso.upsert({ where: { id: 'curso-icfes-basico' }, update: {}, create: { id: 'curso-icfes-basico', nombre: 'Curso Básico ICFES', descripcion: 'Fundamentos de las áreas evaluadas en el ICFES. Ideal para estudiantes de 10°.', precio: 450000, duracionDias: 60 } }),
    prisma.curso.upsert({ where: { id: 'curso-matematicas' }, update: {}, create: { id: 'curso-matematicas', nombre: 'Refuerzo Matemáticas', descripcion: 'Nivelación y profundización en matemáticas para ICFES.', precio: 280000, duracionDias: 30 } }),
    prisma.curso.upsert({ where: { id: 'curso-lectura-critica' }, update: {}, create: { id: 'curso-lectura-critica', nombre: 'Lectura Crítica', descripcion: 'Comprensión lectora, análisis textual y argumentación.', precio: 280000, duracionDias: 30 } }),
  ])
  console.log(`✅ ${cursos.length} cursos creados`)

  // Estudiantes de prueba
  const estudiantes = await Promise.all([
    prisma.estudiante.create({
      data: { nombre: 'Sofía Rodríguez', email: 'sofia.rodriguez@gmail.com', telefono: '3001234567', fechaNacimiento: new Date('2007-03-15'), colegioId: colegios[0].id, acudiente: { create: { nombre: 'María Rodríguez', email: 'maria.rodriguez@gmail.com', telefono: '3107654321', relacion: 'Madre' } } },
    }),
    prisma.estudiante.create({
      data: { nombre: 'Andrés García', email: 'andres.garcia@gmail.com', telefono: '3209876543', fechaNacimiento: new Date('2006-08-22'), colegioId: colegios[1].id, acudiente: { create: { nombre: 'Carlos García', email: 'carlos.garcia@gmail.com', telefono: '3154321098', relacion: 'Padre' } } },
    }),
    prisma.estudiante.create({
      data: { nombre: 'Valentina López', email: 'valentina.lopez@gmail.com', telefono: '3115551234', fechaNacimiento: new Date('2007-11-05'), colegioId: colegios[2].id, acudiente: { create: { nombre: 'Ana López', email: 'ana.lopez@gmail.com', telefono: '3169998877', relacion: 'Madre' } } },
    }),
    prisma.estudiante.create({
      data: { nombre: 'Miguel Torres', email: 'miguel.torres@gmail.com', telefono: '3006667788', fechaNacimiento: new Date('2006-05-18'), colegioId: colegios[0].id, acudiente: { create: { nombre: 'Luis Torres', email: 'luis.torres@gmail.com', telefono: '3187776655', relacion: 'Padre' } } },
    }),
    prisma.estudiante.create({
      data: { nombre: 'Camila Martínez', email: 'camila.martinez@gmail.com', telefono: '3143334455', fechaNacimiento: new Date('2007-09-30'), colegioId: colegios[3].id, acudiente: { create: { nombre: 'Rosa Martínez', email: 'rosa.martinez@gmail.com', telefono: '3122223344', relacion: 'Madre' } } },
    }),
  ])
  console.log(`✅ ${estudiantes.length} estudiantes creados`)

  // Cursos asignados a estudiantes
  await Promise.all([
    prisma.cursoEstudiante.upsert({ where: { estudianteId_cursoId: { estudianteId: estudiantes[0].id, cursoId: cursos[0].id } }, update: {}, create: { estudianteId: estudiantes[0].id, cursoId: cursos[0].id } }),
    prisma.cursoEstudiante.upsert({ where: { estudianteId_cursoId: { estudianteId: estudiantes[1].id, cursoId: cursos[0].id } }, update: {}, create: { estudianteId: estudiantes[1].id, cursoId: cursos[0].id } }),
    prisma.cursoEstudiante.upsert({ where: { estudianteId_cursoId: { estudianteId: estudiantes[2].id, cursoId: cursos[1].id } }, update: {}, create: { estudianteId: estudiantes[2].id, cursoId: cursos[1].id } }),
    prisma.cursoEstudiante.upsert({ where: { estudianteId_cursoId: { estudianteId: estudiantes[3].id, cursoId: cursos[2].id } }, update: {}, create: { estudianteId: estudiantes[3].id, cursoId: cursos[2].id } }),
    prisma.cursoEstudiante.upsert({ where: { estudianteId_cursoId: { estudianteId: estudiantes[4].id, cursoId: cursos[1].id } }, update: {}, create: { estudianteId: estudiantes[4].id, cursoId: cursos[1].id } }),
  ])
  console.log('✅ Cursos asignados a estudiantes')

  // Pagos de prueba
  const hoy = new Date()
  const proxSemana = new Date(hoy); proxSemana.setDate(hoy.getDate() + 7)
  const proxMes = new Date(hoy); proxMes.setDate(hoy.getDate() + 30)
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)

  await Promise.all([
    prisma.pago.create({ data: { estudianteId: estudiantes[0].id, monto: 850000, estado: 'PAGADO', metodo: 'TRANSFERENCIA', fechaVencimiento: ayer, fechaPago: ayer } }),
    prisma.pago.create({ data: { estudianteId: estudiantes[1].id, monto: 425000, estado: 'PAGADO', metodo: 'EFECTIVO', fechaVencimiento: ayer, fechaPago: ayer } }),
    prisma.pago.create({ data: { estudianteId: estudiantes[2].id, monto: 450000, estado: 'PENDIENTE', metodo: 'TRANSFERENCIA', fechaVencimiento: proxSemana } }),
    prisma.pago.create({ data: { estudianteId: estudiantes[3].id, monto: 280000, estado: 'VENCIDO', metodo: 'EFECTIVO', fechaVencimiento: ayer } }),
    prisma.pago.create({ data: { estudianteId: estudiantes[4].id, monto: 225000, estado: 'PENDIENTE', metodo: 'TARJETA', fechaVencimiento: proxMes } }),
  ])
  console.log('✅ Pagos de prueba creados')

  // Financiamiento de prueba para Andrés García
  const financiamiento = await prisma.financiamiento.create({
    data: {
      estudianteId: estudiantes[1].id,
      montoTotal: 850000,
      estado: 'ACTIVO',
      cuotas: {
        create: [
          { numero: 1, monto: 283334, fechaVencimiento: ayer, pagado: true, fechaPago: ayer },
          { numero: 2, monto: 283333, fechaVencimiento: proxSemana, pagado: false },
          { numero: 3, monto: 283333, fechaVencimiento: proxMes, pagado: false },
        ],
      },
    },
  })
  console.log('✅ Financiamiento de prueba creado')

  console.log('\n🎉 Seed completado exitosamente')
  console.log('📊 Resumen:')
  console.log(`   - ${colegios.length} colegios`)
  console.log(`   - ${cursos.length} cursos`)
  console.log(`   - ${estudiantes.length} estudiantes con acudientes`)
  console.log(`   - 5 pagos (2 pagados, 2 pendientes, 1 vencido)`)
  console.log(`   - 1 financiamiento en 3 cuotas`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
