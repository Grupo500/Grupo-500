// Mueve las imágenes de preguntas de Supabase Storage a Cloudinary y actualiza
// imagen_url en la base de Railway. Cloudinary descarga la imagen directo desde
// la URL pública de Supabase. Idempotente: public_id fijo por pregunta + overwrite.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import cloudinaryPkg from "cloudinary";

const cloudinary = cloudinaryPkg.v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const DUMP = "C:/Users/prueb/AppData/Local/Temp/claude/C--Users-prueb-Documents-GitHub-Claude-Proyectos/c7504d98-1c78-47c2-b8f3-209db34a5f05/scratchpad/supabase-dump.json";
const data = JSON.parse(readFileSync(DUMP, "utf8"));
const prisma = new PrismaClient();

// Solo las que tienen imagen ya subida (apuntando a Supabase)
const conImagen = data.sim_preguntas.filter(
  (p) => p.imagen_url && /supabase\.co/.test(p.imagen_url)
);

console.log(`Imágenes a migrar: ${conImagen.length}`);

let ok = 0, fallos = 0;
try {
  for (const p of conImagen) {
    try {
      const res = await cloudinary.uploader.upload(p.imagen_url, {
        folder: "simulacros/preguntas",
        public_id: String(p.id),
        overwrite: true,
        resource_type: "image",
      });
      await prisma.preguntaExamen.update({
        where: { id: BigInt(p.id) },
        data: { imagenUrl: res.secure_url },
      });
      ok++;
      console.log(`✓ pregunta ${p.id} → ${res.secure_url}`);
    } catch (e) {
      fallos++;
      console.log(`✗ pregunta ${p.id}: ${e.message}`);
    }
  }

  // Verificación: cuántas imagen_url en Railway ya apuntan a Cloudinary
  const enCloudinary = await prisma.preguntaExamen.count({
    where: { imagenUrl: { contains: "res.cloudinary.com" } },
  });
  const enSupabase = await prisma.preguntaExamen.count({
    where: { imagenUrl: { contains: "supabase.co" } },
  });
  console.log(`\n=== Resultado ===\nMigradas OK: ${ok} | Fallos: ${fallos}`);
  console.log(`En Railway → apuntando a Cloudinary: ${enCloudinary} | aún a Supabase: ${enSupabase}`);
} finally {
  await prisma.$disconnect();
}
