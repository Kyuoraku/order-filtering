# orders-api / frontend

UI interna para que el equipo de operaciones revise órdenes y apruebe el procesamiento expedito.
Requisitos en `Fullstack_AI_Test.pdf`, decisiones en `../docs/decisiones.md` y backlog en `feature_list.json`.

## Stack

- Vite + React + TypeScript
- MUI (componentes y estilos)
- TanStack Query (datos del servidor)
- Jest + Testing Library (tests de componentes)
- Playwright (tests e2e)

## Uso

```bash
npm install
npm run dev        # servidor de desarrollo en http://localhost:5173
npm run build      # chequeo de tipos + build de producción
npm run lint
npm test           # Jest
npx playwright install chromium   # solo la primera vez
npm run e2e        # Playwright (levanta el dev server solo)
```
