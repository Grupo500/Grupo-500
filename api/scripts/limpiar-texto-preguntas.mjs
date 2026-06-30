// Limpia el enunciado y contexto de preguntas que ya tienen imagen subida.
// Para esas preguntas, elimina los párrafos que son volcados de tabla (números,
// porcentajes, precios) porque la información ya está visible en la imagen.
// Seco por defecto (--apply para escribir a la DB).

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APLICAR = process.argv.includes("--apply");

// Misma lógica que ExamenCliente.tsx / PreviewCliente.tsx
function esParrafoTabla(p) {
  const t = p.trim();
  if (!t) return false;
  if (/^(Fuente:|Tabla\s*$)/i.test(t)) return true;
  const tokens = t.split(/\s+/);
  if (tokens.length < 5) return false;
  const nums = tokens.filter(tok =>
    /^[\d.,]+%?$/.test(tok) ||
    /^\$[\d.,]+$/.test(tok) ||
    /^\d{4}$/.test(tok)
  );
  const ratio = nums.length / tokens.length;
  if (ratio > 0.28) return true;
  if (/\d\.\d{3}/.test(t) && ratio > 0.18) return true;
  return false;
}

function limpiarTexto(texto) {
  if (!texto) return texto;
  const parrafos = texto.split('\n\n').filter(Boolean);
  const limpios = parrafos.filter(p => !esParrafoTabla(p));
  if (limpios.length === parrafos.length) return null; // sin cambios
  return limpios.join('\n\n').trim() || null;
}

async function main() {
  // Solo preguntas con imagen
  const preguntas = await prisma.preguntaExamen.findMany({
    where: { imagenUrl: { not: null } },
    select: { id: true, numero: true, sesion: true, examenId: true, enunciado: true, contexto: true, imagenUrl: true },
    orderBy: [{ examenId: 'asc' }, { sesion: 'asc' }, { numero: 'asc' }],
  });

  console.log(`\nPreguntas con imagen: ${preguntas.length}\n`);

  const cambios = [];

  for (const p of preguntas) {
    const nuevoEnunciado = limpiarTexto(p.enunciado);
    const nuevoContexto  = limpiarTexto(p.contexto);

    if (nuevoEnunciado === null && nuevoContexto === null) continue; // sin cambios

    cambios.push({
      id: p.id,
      examenId: p.examenId,
      sesion: p.sesion,
      numero: p.numero,
      enunciado: nuevoEnunciado ?? p.enunciado,
      contexto: nuevoContexto ?? p.contexto,
      enunciadoOriginal: p.enunciado,
      contextoOriginal: p.contexto,
    });
  }

  if (cambios.length === 0) {
    console.log("✅ No hay párrafos de tabla que limpiar.");
    return;
  }

  console.log(`Preguntas con texto de tabla a limpiar: ${cambios.length}\n`);

  for (const c of cambios) {
    console.log(`─── Simulacro ${c.examenId} · S${c.sesion} · Pregunta ${c.numero} (id=${c.id})`);

    if (c.enunciadoOriginal !== c.enunciado) {
      const antes = c.enunciadoOriginal.split('\n\n').filter(Boolean).length;
      const despues = c.enunciado.split('\n\n').filter(Boolean).length;
      console.log(`  enunciado: ${antes} párrafos → ${despues} párrafos (se eliminan ${antes - despues})`);
      // Mostrar párrafos eliminados
      c.enunciadoOriginal.split('\n\n').filter(Boolean).forEach(par => {
        if (esParrafoTabla(par)) {
          console.log(`    ✂ "${par.slice(0, 80).trim()}${par.length > 80 ? '…' : ''}"`);
        }
      });
    }

    if (c.contextoOriginal !== c.contexto) {
      const antes = (c.contextoOriginal ?? '').split('\n\n').filter(Boolean).length;
      const despues = (c.contexto ?? '').split('\n\n').filter(Boolean).length;
      console.log(`  contexto: ${antes} párrafos → ${despues} párrafos (se eliminan ${antes - despues})`);
    }
  }

  if (!APLICAR) {
    console.log(`\n⚠  Modo seco. Ejecuta con --apply para guardar los cambios en la DB.\n`);
    return;
  }

  console.log(`\nAplicando cambios...`);
  for (const c of cambios) {
    await prisma.preguntaExamen.update({
      where: { id: c.id },
      data: {
        enunciado: c.enunciado,
        ...(c.contexto !== undefined && { contexto: c.contexto }),
      },
    });
    process.stdout.write(`  ✓ Pregunta ${c.numero} (S${c.sesion})\n`);
  }

  console.log(`\n✅ ${cambios.length} preguntas actualizadas.\n`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
