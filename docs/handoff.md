# Handoff: order-filtering

Estado al 2026-10-27. Resume **todas las decisiones tomadas por Nico** y lo que sigue abierto,
para que cualquier persona o agente pueda retomar el trabajo.

> Regla de trabajo: no tomar decisiones de negocio ni de arquitectura por cuenta propia.
> Lo que no figura como decidido acá **está abierto**: consultar a Nico antes de asumir.

Detalle completo de cada decisión: [`docs/decisiones.md`](decisiones.md). Las decisiones D13 a D15 están en el PR #2 y
todavía no llegan a `main`; su resumen está abajo.

## Contexto

Herramienta interna para que el equipo de operaciones revise órdenes y decida si son elegibles para procesamiento
expedito. Requisitos: `Fullstack_AI_Test.pdf`. Respuesta de la evaluación: `eligible`, `score` (0–100), `reasons`,
`warnings`, más `validUntil` (D12).

## Estado del trabajo

| Área | Estado |
|------|--------|
| Backend | BE-01 (esqueleto en Go, separado en capas) en el **PR #2**, rama `backend/BE-01-skeleton`. Backlog en `backend/feature_list.json` (BE-01 a BE-13). |
| Frontend | Backlog en `frontend/feature_list.json` (F01 a F14), mantenido por el hilo de frontend. Rama `feature/frontend-scaffold`. |
| Convención de ramas | `backend/*` toca solo `backend/` y `docs/`; `frontend/*` toca solo `frontend/`. PRs contra `main`. |

## Decisiones de negocio y backend

| # | Decisión |
|---|----------|
| D1 | Sistema de **rules independientes**, aplicadas de forma iterable sobre la orden. Agregar una regla no modifica las existentes. Cada hard rule que falla agrega un texto a `reasons`; cada descuento de score agrega un texto a `warnings`. |
| D2 | `orderId` **no puede ser null** (las órdenes llegan formadas desde otro servicio). Si es null, la orden se rechaza. |
| D3 | El servicio es **idempotente** por `orderId`: si una orden ya procesada llega sin cambios, se devuelve lo almacenado. |
| D4 | **No** se valida `totalAmount` contra los items (puede haber descuentos, envío, mora, etc.). Se toma como llega. |
| D5 | "Must re-evaluate eligibility" se aplica solo si el `orderId` es nuevo o llega con algún atributo distinto. |
| D6 | Concurrencia: **mutex por orden** (`orderId`) y escrituras atómicas. Órdenes distintas corren en paralelo. |
| D7 | Backend en **Go**. |
| D8 | Cuentan como "cambio" solo los atributos que evalúan las reglas: `items`, `totalAmount`, `customer.tier`, `shipping.addressValidated`, `riskFlags`, `inventoryStatus.available`, `inventoryStatus.lastCheckedAt`, `createdAt`. `status`, `customer.name` y `shipping.country` no cuentan. |
| D9 | Detectar que una orden sin cambios venció por el paso del tiempo **no es responsabilidad de este servicio** (se cubre con D12). |
| D10 | Si `score < 60` se agrega a `reasons` "rechazado por bajo score", **aunque también falle una hard rule**. |
| D11 | El servicio **no chequea stock**: usa `inventoryStatus` tal como viene en la orden. No hay lock por producto. |
| D12 | `validUntil` (dateTime): campo de la **response**, lo calcula este servicio a partir de las rules; en el request siempre viene vacío. Cuando vence, el agente no revisa más la orden, la orden debe re-evaluarse y **el frontend la oculta** (el backend no filtra). Enviar las vencidas a un stream con un job que las reenvíe queda **fuera de alcance**. |
| D13 | **"Eligible but risky"** = orden elegible con score **entre 60 y 70 inclusive**. |
| D15 | Si `createdAt` viene **vacío**, la orden se rechaza mediante una **rule nueva** (hard rule: no elegible + texto en `reasons`). |

## Decisiones de frontend

| # | Decisión |
|---|----------|
| D14 | La UI va en **inglés**. |
| — | Stack: **Vite + TypeScript**, **MUI**, **TanStack Query**, **Jest + Testing Library**, **Playwright** (definido con el hilo de frontend). |
| — | El frontend no recalcula elegibilidad: confía en el backend (requisito del PDF). |

## Abierto

Prioridad: primero lo que bloquea tareas próximas.

1. **Montos límite por tier** (STANDARD, GOLD, PLATINUM) para la regla de −20. Bloquea BE-05.
2. **Cómo llega "eligible but risky" al frontend:** campo propio en la response o derivado del score. El front no debe recalcular.
3. **Proxy de Vite vs. CORS** en el backend para el desarrollo local.
4. **Regla de −10 por antigüedad cuando `createdAt` viene vacío** (la orden ya la rechaza D15): ¿no resta o resta igual?
5. **Router de Go:** `net/http` estándar (usado provisoriamente en BE-01), chi o gin.
6. **Contrato de la API:** el hilo de frontend propuso `GET /api/orders`, `GET /api/orders/{id}` con un campo `evaluation` {eligible, score, reasons, warnings, validUntil} y `POST /api/orders/{id}/approve-expedited` que devuelve la orden actualizada o un error {code, message, reasons}. Falta la confirmación de Nico.
7. **Cálculo de `validUntil`:** ¿vence cuando cambia el resultado o solo cuando deja de ser elegible?; valor para órdenes ya no elegibles; ¿cada regla informa su propio vencimiento?
8. **Idempotencia y aprobación:** qué se almacena (evaluación, aprobación o ambas); respuesta ante una orden ya aprobada; aprobar una orden con `validUntil` vencido; orden aprobada que llega cambiada y ya no es elegible; transición de `status`; códigos HTTP de los errores.
9. **`orderId` null:** cómo se rechaza (HTTP 400, `status = REJECTED` o reason) y por qué canal entran las órdenes (ingesta o datos precargados).
10. **Motor de reglas:** ¿se evalúan todas las reglas o se corta en la primera hard rule?; ¿se calcula el score si falla una hard rule?; ¿límite del score a 0–100?; mecanismo de registro de reglas; formato e idioma de `reasons`/`warnings`.
11. **Edge cases por campo:** `customer`/`shipping`/`inventoryStatus` null completos; `tier` fuera del enum; `items` null vs vacío; `quantity` null, 0 o negativa; `totalAmount` null o negativo; `addressValidated = null`; `riskFlags` ausente o con `HIGH_VALUE` repetido; `lastCheckedAt` null o futuro; límites exactos de 10 min y 48 h; zona horaria de los timestamps.
12. **Reflejar cambios después de aprobar:** refetch, polling o push.
