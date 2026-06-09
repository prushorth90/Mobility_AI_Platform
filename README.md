# Tesla PeopleOps Commute + Charging Copilot

Internal-facing full stack demo for commute planning, charging recommendations, policy retrieval, and MCP-oriented tooling.

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + PostgreSQL

## Backend API

The backend service in [backend/server.js](backend/server.js) now uses:

- PostgreSQL persistence via repository modules under [backend/repositories](backend/repositories)
- Schema and seed SQL in [backend/db/schema.sql](backend/db/schema.sql) and [backend/db/seed.sql](backend/db/seed.sql)
- RAG indexing + retrieval services under [backend/services](backend/services)

API endpoints:

- GET /api/health
- POST /api/commute-plan
- POST /api/policy-search
- GET /api/mcp-tools
- GET /api/admin-metrics
- GET /api/employee/:employeeId/profile
- GET /api/employee/:employeeId/shift
- POST /api/rag/reindex

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create and configure environment file:

```bash
cp .env.example .env
```

3. Start local PostgreSQL with Docker:

```bash
npm run backend:db:up
```

If you use a different local Postgres instance, ensure DATABASE_URL is valid in .env.

4. Initialize schema, seed data, and build RAG index:

```bash
npm run backend:setup
```

5. Start backend (Terminal 1):

```bash
npm run backend:start
```

6. Start frontend (Terminal 2):

```bash
npm run dev
```

The frontend runs on http://localhost:5173 and proxies API requests to http://localhost:8080 via [vite.config.ts](vite.config.ts).

## Useful Scripts

- npm run dev: Start Vite frontend dev server
- npm run backend:dev: Start backend with Node watch mode
- npm run backend:start: Start backend once
- npm run backend:db:up: Start Docker Postgres container
- npm run backend:db:down: Stop and remove Docker Compose services
- npm run backend:db:init: Run SQL schema setup
- npm run backend:db:seed: Seed baseline employees, shifts, and policies
- npm run backend:rag:index: Chunk and embed policy documents into retrieval index
- npm run backend:setup: Run init + seed + RAG index in sequence
- npm run build: Build frontend production bundle
- npm run preview: Preview built frontend

## Notes

- To point the frontend at a non-local backend, set VITE_API_BASE_URL in .env.
- Embeddings can run locally (deterministic) or with OpenAI by setting EMBEDDINGS_PROVIDER and OPENAI_API_KEY.
- Each retrieval and planning workflow is logged in mcp_tool_logs for admin metrics.
