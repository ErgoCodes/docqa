# DocQA

Asistente RAG sobre documentos: sube un PDF, pregúntale en lenguaje natural y
recibe respuestas citadas por documento y página.

## Estado

En desarrollo. Tablero de tareas: [DocQA en Notion](https://app.notion.com/p/3e019c33c39081348924d13fbfd11d15)

## Requisitos

El levantamiento completo está en [REQUIREMENTS.md](./REQUIREMENTS.md).

## Stack

React 19 · Vite · TanStack Query/Router · Tailwind · Fastify · TypeScript · Zod ·
BullMQ · Redis · MongoDB Atlas (Vector Search) · MinIO · API de embeddings · API
de Claude (Haiku).

## Empezar

```bash
cp .env.example .env    # completar con tus claves
docker compose up
```

## Decisiones técnicas

Notas puntuales sobre la implementación; el README completo con arquitectura,
GIF y uso de IA es una tarea propia del tablero.

**Autenticación (RF-01)**

- El token de renovación es un valor **opaco** aleatorio, no un JWT: su
  estado vive en MongoDB de todos modos, así que un JWT añadiría una segunda
  fuente de verdad que puede contradecir a la primera. Se guarda su hash
  SHA-256, nunca el token — y SHA-256, no Argon2, porque con 256 bits de
  entropía no hay diccionario que atacar; Argon2 es para secretos de baja
  entropía elegidos por humanos.
- Cada renovación **rota** el token: el usado queda inservible y se emite
  uno nuevo con la misma `familyId`. Si se reutiliza un token ya rotado, se
  interpreta como robo y se revoca la familia entera, no solo ese token.
  Compromiso conocido: dos pestañas refrescando en el mismo instante también
  matan la familia (`replacedByHash` ya está en el esquema para añadir una
  ventana de gracia si hiciera falta, sin migrar datos).
- `db/indexes.ts` crea los índices con `createIndex` en el arranque, que es
  idempotente salvo que cambien las opciones de un índice ya existente. Para
  este tamaño de proyecto es suficiente; en producción sería una migración
  versionada.

**Documentos (RF-02, RF-04)**

- Validación estructural real: no se confía en el `Content-Type` enviado por el
  cliente ni en la extensión del archivo. Se comprueban los magic bytes (`%PDF-`)
  para fallo rápido y se carga la estructura completa con `pdf-lib` (descartando
  archivos corruptos o cifrados) antes de persistir o encolar.
- Aislamiento directo en base de datos (RNF-01): `findById` y las consultas de
  documentos filtran por `_id` y `userId` en el mismo predicado de MongoDB,
  garantizando que ninguna consulta devuelva datos de otro usuario y retornando 404
  (sin delatar si el ID existe en otra cuenta).
- Claves de almacenamiento aleatorias (`${userId}/${uuid}.pdf`): el nombre en MinIO
  se desacopla del título del archivo original para evitar colisiones y vectores de
  path traversal.
- Orden de persistencia sin compensación: se almacena el blob en MinIO antes de
  insertar el registro en MongoDB; si falla la inserción en base de datos o el
  encolado, queda un blob huérfano inofensivo en MinIO, evitando registros
  rotos en la base de datos sin sobre-ingeniería de rollback.

**CI (RNF-12)**

- Dos jobs en paralelo: `checks` (lint, tipos, tests unitarios y cobertura de
  dominio en `api`) no depende de ningún servicio externo, así que da
  feedback en segundos; `integration` levanta un contenedor de MongoDB solo
  para las pruebas que sí lo necesitan (`test:integration`), sin frenar al
  primero.
- La cobertura del 80% (RNF-11) se comprueba con un script aparte,
  `test:coverage`, en vez de forzarla dentro del `test` normal — así seguir
  iterando en local con `pnpm test` no paga el costo de instrumentar
  cobertura en cada corrida.
