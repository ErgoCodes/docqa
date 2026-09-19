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
