# Lógica financiera

Todo el motor **puro** (sin I/O) está en `server/src/finanzas.js`.
El ensamblado está en `computarDiagnostico()` de `server/src/index.js`.

**Regla de oro:** todos los montos son enteros en pesos COP. Nunca `float`, nunca decimales.

---

## Fórmulas

| Concepto | Fórmula / regla | Dónde |
|---|---|---|
| Neto | `bruto × (1 − salud − pensión)` si asalariado | `netoMensual()` |
| Capacidad de ahorro | `neto − fijos − cuotas` | `computarDiagnostico` |
| Presupuesto variable | el del usuario, o 70 % de la capacidad | `computarDiagnostico` |
| **Disponible hoy** | `(presupuesto variable − gastado) ÷ días restantes`, redondeado a $100 | `computarDiagnostico` |
| Ahorro para metas | `capacidad − presupuesto variable` | `ahorro_mensual_metas` |
| **Reparto de metas** | ahorro mensual **÷ número de metas activas** (partes iguales) | `computarDiagnostico` → `metas[]` |
| Deudas | Sistema francés, `i = (1+EA)^(1/12) − 1`, cuotas liberadas se encadenan, tope 240 meses | `simDeudas()` |
| Estrategias | avalancha (tasa desc) vs bola de nieve (saldo asc) | `simDeudas(orden)` |
| Score de salud 0-100 | ahorro 30 · endeudamiento 25 · fondo 20 · fijos 15 · constancia 10 | `saludFinanciera()` |
| Fondo de emergencia | `(fijos + cuotas) × 3` | Onboarding + `NuevaMeta.tsx` |
| 4×1000 | `monto × 0,004` en Transferencia y PSE | `POST /api/gastos` |
| Gasto hormiga | `monto < umbral_hormiga` (hoy $20.000) | `POST /api/gastos` |

---

## ⚠️ Ojo matemático — no "arreglar" esto

Pagando **solo cuotas mínimas**, avalancha y bola de nieve cuestan **igual**. La diferencia
solo aparece **con abonos extra**.

El copy ya lo refleja correctamente con `ventaja_avalancha` / `ventaja_avalancha_extra`.
Si alguien reporta esto como bug, no lo es.

---

## Parámetros Colombia

Tabla `parametros` (clave, valor, anio, descripcion). Editables por SQL.

| Clave | Valor actual |
|---|---|
| `salud_empleado` | 0.04 |
| `pension_empleado` | 0.04 |
| `gmf` | 0.004 |
| `umbral_hormiga` | 20000 |
| `tasa_usura_ea` | 26.5 |
| `salario_minimo` | 1750000 |
| `auxilio_transporte` | 210000 |
| `dias_prueba` | **36500** (= app gratuita) |

> Los valores son **de referencia**: verificar contra el decreto anual y la Superfinanciera
> antes de una campaña seria.

Cambiarlos:
```bash
ssh -i "$PC_SSH_KEY" "$PC_VPS" \
  'sqlite3 /opt/plata-clara/server/data/plata-clara.db \
   "UPDATE parametros SET valor=X WHERE clave=\"clave\";" && systemctl restart plata-clara'
```

---

## Textos legales obligatorios

- *"Plata Clara organiza, no asesora"*
- *"estimados, no garantías"*
