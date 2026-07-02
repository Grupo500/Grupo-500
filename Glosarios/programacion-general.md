# 💻 Programación general

Términos generales del desarrollo de software y de la app Grupo 500.

---

### frontend
**Qué es:** La parte de la app que el usuario ve y toca (pantallas, botones, formularios).
**Analogía:** El salón de un restaurante: las mesas, la carta, lo que ve el cliente.
**En la práctica:** En Grupo 500 el frontend está en la carpeta `web/` (Next.js) y se despliega en Vercel.

---

### backend
**Qué es:** La parte "de atrás" que no se ve: procesa los datos, aplica las reglas y guarda la información.
**Analogía:** La cocina del restaurante: prepara todo, aunque el cliente no la vea.
**En la práctica:** En Grupo 500 el backend está en `api/` (Express) y se despliega en Railway.

---

### base de datos (BD)
**Qué es:** El lugar organizado donde se guarda toda la información (estudiantes, pagos, cursos, etc.).
**Analogía:** Un archivador gigante con tablas y fichas ordenadas.
**En la práctica:** Grupo 500 usa PostgreSQL. Cada "tabla" guarda un tipo de dato (Estudiante, Pago, Curso…).

---

### API
**Qué es:** El "puente" por el que el frontend le pide datos o acciones al backend.
**Analogía:** El mesero: lleva tu pedido a la cocina y te trae el plato. No cocinas tú, ni hablas directo con la cocina.
**En la práctica:** Cuando la app pide "dame los cursos más vendidos", hace una llamada a la API.

---

### deploy (despliegue)
**Qué es:** Publicar una nueva versión de la app para que quede disponible en internet.
**Analogía:** Estrenar la nueva versión de la obra en el teatro, con público de verdad.
**En la práctica:** Cada vez que subimos cambios, Vercel y Railway hacen deploy automático.

---

### webhook
**Qué es:** Un "aviso automático" que un servicio le manda a otro cuando pasa algo.
**Analogía:** Una alarma que suena sola cuando ocurre un evento, sin que tengas que estar preguntando.
**En la práctica:** Cuando alguien compra en Hotmart o se asigna un lead en Trengo, ellos avisan a nuestra app por un webhook y se registra solo.

---

### variable de entorno
**Qué es:** Un dato de configuración secreto o cambiante que la app lee (claves, contraseñas, URLs).
**Analogía:** Las llaves y códigos guardados en una caja fuerte, aparte del código.
**En la práctica:** La contraseña de la base de datos o las claves de Hotmart viven como variables de entorno en Railway/Vercel, no dentro del código.
