# 🔧 Git y control de versiones

Términos sobre Git y GitHub — las herramientas que usamos para guardar, versionar y compartir el código de la app entre varias personas.

---

### commit
**Qué es:** Una "foto" guardada de tus cambios en el código en un momento dado. Cada commit lleva un mensaje que describe qué cambiaste.
**Analogía:** Un punto de guardado en un videojuego. Si algo sale mal, puedes volver a ese punto.
**En la práctica:** Después de editar archivos, haces un commit para dejar registrado ese avance. Ejemplo: *"fix: corregir el gráfico de cursos"*.

---

### push
**Qué es:** Subir tus commits (tus cambios ya guardados) desde tu computador a GitHub (la nube).
**Analogía:** Empujar hacia afuera ⬆️ — mandas lo tuyo para que quede respaldado y otros lo vean.
**En la práctica:** Al terminar una tarea haces `git push` para que tu compañero pueda ver tus cambios.

---

### pull
**Qué es:** Bajar a tu computador los cambios que otros subieron a GitHub, para tener la última versión.
**Analogía:** Jalar hacia ti ⬇️ — traes lo que hicieron los demás.
**En la práctica:** Antes de empezar a trabajar haces `git pull` para arrancar desde la versión más reciente y no chocar con lo de tu compañero.

> 💡 **Truco para no confundir push y pull:**
> - **pull** = *jalar* hacia ti (bajas lo de los demás)
> - **push** = *empujar* hacia afuera (subes lo tuyo)

---

### repositorio (repo)
**Qué es:** La carpeta del proyecto con todo su código y su historial completo de cambios.
**Analogía:** Un archivador con todas las versiones del proyecto, no solo la última.
**En la práctica:** El repo de la app vive en GitHub (`github.com/Grupo500/Grupo-500`) y cada uno tiene una copia en su computador.

---

### fast-forward
**Qué es:** Un tipo de actualización limpia: cuando tu copia local no tiene cambios propios pendientes, Git solo "adelanta" tu versión pegando encima los commits nuevos, sin fusiones ni conflictos.
**Analogía:** Ponerte al día viendo los capítulos que te faltaban de una serie, en orden, sin enredos.
**En la práctica:** Es el caso ideal al hacer `git pull`.

---

### La rutina de equipo

1. **`git pull`** al empezar → bajas lo del compañero.
2. Trabajas y haces **commits**.
3. **`git push`** al terminar → subes lo tuyo.

Así los dos siempre parten de la última versión y evitan conflictos.
