# DocQA

Asistente RAG sobre documentos: cada usuario sube PDFs y les hace preguntas en lenguaje natural, con respuestas citadas por documento y página.

## Contexto permanente

@REQUIREMENTS.md

Ese documento es la fuente de verdad sobre *qué* hay que construir y por qué. Si una
decisión de implementación lo contradice, actualiza primero `REQUIREMENTS.md`
explicando el cambio; una contradicción sin resolver entre el código y los
requisitos se convierte en semanas de trabajo en la dirección equivocada.

## Stack

- **Frontend**: React 19, Vite, TanStack Query y Router, Tailwind.
- **API**: Node.js, Fastify, TypeScript estricto, Zod.
- **Cola y worker**: BullMQ sobre Redis.
- **Embeddings**: API de embeddings (Voyage AI u OpenAI, a decidir en fase 2).
- **Base de datos**: MongoDB Atlas con Vector Search.
- **Caché y límites**: Redis.
- **Archivos**: MinIO (compatible con S3).
- **Generación**: API de Claude (Haiku) u otro LLM.
- **Calidad**: Vitest, ESLint, GitHub Actions, Docker Compose.

## Estructura

Monorepo pnpm con tres paquetes:

```
apps/
  frontend/   # React + Vite
  api/        # Fastify — auth, documents, conversations, chunks
  worker/     # BullMQ — extracción, fragmentación, embeddings
```

## Comandos

```bash
docker compose up      # levanta MongoDB, Redis, MinIO y el resto del entorno local
pnpm install            # instala dependencias del monorepo
pnpm dev                # arranca frontend, api y worker en paralelo
pnpm test               # Vitest en todos los paquetes
pnpm lint                # ESLint en todos los paquetes
```

## Convenciones

- Prioridad de seguridad no negociable: toda consulta a MongoDB, incluida la
  búsqueda vectorial, filtra por `userId` (RNF-01). Cualquier cambio en el acceso
  a `chunks`, `documents` o `conversations` necesita el test de aislamiento entre
  usuarios en verde antes de mergear.
- El texto de los documentos es dato, nunca instrucción: el prompt del sistema lo
  separa explícitamente del contenido recuperado (RNF-05).
- TypeScript estricto en los tres paquetes; no relajar `strict` para desbloquear
  un build.
- Cobertura mínima del 80% en lógica de dominio (fragmentación, prompt, claves de
  caché, citas) — no en el proyecto entero.

### Estructura de un módulo

Cada módulo (`apps/api/src/modules/<nombre>/`) se organiza en carpetas por
responsabilidad, no en archivos sueltos con nombres genéricos. Un archivo llamado
`repository.ts` no dice si es un contrato o una implementación;
`interfaces/user.repository.ts` sí.

| Carpeta | Qué contiene |
| --- | --- |
| `interfaces/` | Contratos que el dominio necesita (puertos). Solo tipos, sin implementación. |
| `types/` | Modelos y tipos del dominio. |
| `schemas/` | Esquemas Zod de validación de entrada y salida. |
| `services/` | Lógica de dominio. Depende de `interfaces/`, nunca de implementaciones concretas. |
| `repositories/` | Implementaciones de persistencia (adaptadores de MongoDB u otros). |
| `routes/` | Capa HTTP de Fastify: traduce peticiones a llamadas al servicio. |
| `utils/` | Helpers puros y sin estado. |

Un módulo crea solo las carpetas que necesita; no hay que rellenar el molde
completo para un módulo pequeño. Los tests viven junto al archivo que prueban
(`services/auth.service.test.ts`), y la dirección de las dependencias siempre
apunta hacia `interfaces/`, nunca al revés.

## Seguimiento

Las tareas viven en Notion, no en comentarios `TODO` ni en un archivo del repo:

https://app.notion.com/p/3e019c33c39081348924d13fbfd11d15

Al terminar una tarea, muévela de estado allí. Si aparece trabajo que no estaba
planificado, créalo como tarea en el tablero en vez de dejarlo implícito en el
código — el tablero dice *qué* y *en qué estado está*; este repo dice *cómo*.
