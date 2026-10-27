# orders-api backend

Backend en Go del servicio de elegibilidad para procesamiento expedito de órdenes.

- Requisitos: `Fullstack_AI_Test.pdf`
- Decisiones de diseño: [`../docs/decisiones.md`](../docs/decisiones.md)
- Backlog: [`feature_list.json`](feature_list.json)

## Estructura

| Paquete | Responsabilidad |
|---------|-----------------|
| `cmd/server` | Punto de entrada: arma las dependencias y levanta el servidor HTTP. |
| `internal/rules` | Definición de las reglas. Cada regla es independiente (D1). |
| `internal/evaluation` | Aplica las reglas a una orden y arma el resultado. |
| `internal/api` | Capa REST. Sin lógica de negocio. |
| `internal/store` | Almacenamiento en memoria y lock por orden (D6). |

## Uso

Requiere Go 1.22 o superior.

```sh
go run ./cmd/server        # escucha en :8080 (configurable con ADDR)
go build ./... && go vet ./...
```
