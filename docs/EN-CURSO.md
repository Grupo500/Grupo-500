# Quién está en qué — tablero de coordinación entre equipos

Tres computadores trabajan sobre esta app sin verse entre sí. Este archivo es
la señalización: **se actualiza al EMPEZAR a trabajar** (no al terminar) y se
empuja de inmediato, para que las otras sesiones lo encuentren al hacer pull.

Reglas para cualquier sesión de Claude en cualquier máquina:

1. Antes de tocar nada: `git pull` y leer este archivo. Si otra máquina tiene
   tomado el frente que ibas a tocar, trabaja en otra cosa o pregunta a David.
2. Al empezar: anota tu frente abajo (máquina, fecha, qué y qué archivos o
   módulos toca) y haz push de este archivo de una vez.
3. Al terminar: borra tu línea, resume lo hecho en `SESIONES/historial.md`, push.
4. Migraciones de base de datos: se DESARROLLAN contra Postgres local y solo
   se APLICAN a producción desde la máquina de David con `migrate deploy`
   (reglas completas en CLAUDE.md, sección "Reglas de base de datos").

| Máquina | Desde | Frente | Módulos/archivos |
|---|---|---|---|
| (libre) | | | |
