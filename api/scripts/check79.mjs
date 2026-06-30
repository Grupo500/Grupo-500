import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const r = await p.preguntaExamen.findFirst({ where: { examenId: 2, sesion: 2, numero: 79 } });
const { area, contexto, opcionA, opcionB, opcionC, opcionD, opcionE, opcionF, opcionG, opcionH, correcta, enunciado } = r;
console.log(JSON.stringify({ area, contexto: contexto?.slice(0,120) ?? null, enunciado: enunciado?.slice(0,80), opcionA, opcionB, opcionC, opcionD, opcionE, opcionF, opcionG, opcionH, correcta }, null, 2));
await p.$disconnect();
