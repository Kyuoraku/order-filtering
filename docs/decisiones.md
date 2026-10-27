# Decisiones de diseño (orders-api)

Registro de decisiones **ya tomadas por Nico**. Sirve de referencia para agentes y personas.
Cualquier punto que no figure acá **no está decidido**: no asumir, consultar a Nico.

Documento de requisitos de referencia: `Fullstack_AI_Test.pdf`.

| # | Decisión | Fecha |
|---|----------|-------|
| D1 | Sistema de reglas independientes | 2026-10-27 |
| D2 | `orderId` obligatorio | 2026-10-27 |
| D3 | Idempotencia por `orderId` | 2026-10-27 |
| D4 | No validar `totalAmount` contra los items | 2026-10-27 |
| D5 | Cuándo se re-evalúa la elegibilidad | 2026-10-27 |
| D6 | Concurrencia con mutex y operaciones atómicas | 2026-10-27 |
| D7 | Backend en Go | 2026-10-27 |
| D8 | Atributos que cuentan como "cambio" | 2026-10-27 |
| D9 | Vencimiento por tiempo fuera del alcance | 2026-10-27 |
| D10 | Reason por score bajo | 2026-10-27 |
| D11 | El servicio no chequea stock | 2026-10-27 |
| D12 | `validUntil` | 2026-10-27 |
| D13 | "Eligible but risky" | 2026-10-27 |
| D14 | Idioma de la UI | 2026-10-27 |
| D15 | `createdAt` vacío se rechaza | 2026-10-27 |

---

## D1. Sistema de reglas independientes

- La lógica de negocio se implementa como un conjunto de **rules**.
- Cada rule tiene su lógica implementada **de forma independiente** de las demás.
- Las rules se aplican **de forma iterable** sobre una orden.
- Motivo: a futuro se van a agregar nuevas reglas y no deben mezclarse entre sí
  (cumple la restricción obligatoria del documento: *agregar una regla nueva no debe requerir modificar las existentes*).
- Las rules contienen las validaciones y la lógica de negocio descriptas en el documento.
- **Salida de cada tipo de regla:**
  - Cada vez que se aplica una **hard rule**, se agrega un texto explicativo a `reasons`.
  - Cada vez que se aplica una regla de la sección *"Start with score = 100 and subtract:"*,
    se agrega un texto explicativo a `warnings`.

## D2. `orderId` obligatorio

- `orderId` **no puede ser null**: las órdenes llegan ya formadas desde otro servicio.
- Si `orderId` es null, **la orden se rechaza**.

## D3. Idempotencia por `orderId`

- El servicio debe ser **idempotente**.
- `orderId` es la clave para volver a procesar órdenes ya existentes cuando alguno de sus atributos cambió.
- Si una orden con un `orderId` ya procesado llega **sin cambios** en sus atributos, se responde
  **lo mismo que ya está almacenado**.

## D4. No validar `totalAmount` contra los items

- **No** se valida `totalAmount` en relación a la cantidad y el monto de los items.
- Motivo: pueden existir descuentos, recargos por envío, mora u otros conceptos contemplables en el sistema.
- Se toma `totalAmount` tal como llega.

## D5. Cuándo se re-evalúa la elegibilidad

Requisito del endpoint `POST /api/orders/{id}/approve-expedited`: *"Must re-evaluate eligibility."*

- Se re-evalúa **solo si**:
  - el `orderId` no fue procesado todavía, **o**
  - el `orderId` ya fue procesado pero llega con algún atributo distinto.
- En cualquier otro caso aplica D3 (se devuelve lo almacenado).

## D6. Concurrencia

Requisito: soportar requests concurrentes (simplificado).

- Se usa un **mutex** para bloquear los items que se están consultando.
- Las escrituras se hacen con **operaciones atómicas**, para no comprometer la consistencia de los datos.
- El lock es **por orden** (`orderId`): dos requests sobre la misma orden se serializan; órdenes distintas corren en paralelo.
- No hay lock por producto/stock (ver D11).

## D7. Lenguaje del backend

- El backend se implementa en **Go**.

## D8. Atributos que cuentan como "cambio" (para D3/D5)

- Una orden ya procesada se considera **distinta** solo si cambió alguno de los atributos
  que evalúan los dos sets de reglas (hard rules y reglas de score).
- Según el documento, esos atributos son: `items` (vacío / cantidad total), `totalAmount`, `customer.tier`,
  `shipping.addressValidated`, `riskFlags`, `inventoryStatus.available`, `inventoryStatus.lastCheckedAt`, `createdAt`.
- Los atributos que no evalúa ninguna regla (por ejemplo `status`, `customer.name`, `shipping.country`) no cuentan como cambio.

## D9. Vencimiento por tiempo fuera del alcance

- Si una orden ya evaluada llega **sin cambios** (D8), pero pasó suficiente tiempo como para que una regla
  temporal dé otro resultado (`lastCheckedAt` > 10 min, `createdAt` > 48 h), **no es responsabilidad de este servicio**
  detectarlo: se mantiene D3 (se devuelve lo almacenado).
- Para cubrir este caso se agrega `validUntil` en esta versión (ver D12).

## D10. Reason por score bajo

- Cuando `score < 60`, se agrega a `reasons` un texto de **"rechazado por bajo score"**.
- Se agrega **aunque además falle alguna hard rule**, porque sigue siendo una razón de rechazo válida.
- Los descuentos que llevaron el score hacia abajo quedan explicados en `warnings` (D1).

## D11. El servicio no chequea stock

- Este servicio **no** es responsable de chequear los items ni el stock.
- El estado de inventario llega en cada orden (`inventoryStatus`) y se usa tal como viene en las reglas.

## D12. `validUntil`

- `validUntil` (dateTime) se agrega **en esta versión**.
- **Owner:** este servicio. Es un campo de la **response**, no del request.
  En el request siempre viene vacío.
- **Cálculo:** se calcula en base a las rules. Devuelve el día y la hora estimados hasta los que la orden sigue siendo válida.
- **Cuando vence:**
  - el agente no debería revisar más esa orden;
  - la orden debe volver a evaluarse;
  - el frontend deja de mostrarla, porque no se debe evaluar.
- **Quién oculta las vencidas:** el **frontend**. El backend no agrega esa lógica por ahora.
- **Fuera de alcance por ahora:** enviar las órdenes vencidas a un stream y programar un job que las vuelva a enviar al servicio.

## D13. "Eligible but risky"

- Una orden es **"eligible but risky"** cuando es elegible y su score está **entre 60 y 70 inclusive**.
- Cómo lo recibe el frontend (campo propio en la response o derivado) está pendiente de definir;
  el frontend no debe recalcular elegibilidad (requisito del PDF).

## D14. Idioma de la UI

- La UI va en **inglés**.

## D15. `createdAt` vacío se rechaza

- Si `createdAt` viene vacío, la orden **se rechaza**.
- Se implementa como una **rule nueva** e independiente (D1). Al ser una regla de rechazo, es una hard rule:
  la orden queda no elegible y se agrega un texto explicativo a `reasons`.
