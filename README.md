# Document Engine — Legal Document Generation Platform

Single Admin Portal: **Admin Mode** (configuration) + **Customer Simulation** (demo questionnaire & document generation).

## Stack

Node.js (Express) · PostgreSQL (Sequelize) · BullMQ + Redis · docxtemplater · LibreOffice headless · React + Vite · local disk storage (S3-swappable)

## Quick start

Prereqs: Node 20+, local PostgreSQL + Redis, LibreOffice installed.

```bash
npm install

# backend env (see backend/.env.example, set real values in backend/.env)
#   DB_USER_NAME, DB_PASSWORD, DB_DATABASE, DB_HOST_NAME, DB_PORT

npm run db:migrate && npm run db:seed

npm run dev:api        # http://localhost:3000
npm run dev:worker     # BullMQ workers (docx + pdf)
npm run dev:frontend   # http://localhost:4000
```

## Docs

- `docs/ARCHITECTURE.md` — structure, flows, data model, API surface
- `docs/POC_RESULTS.md` — Phase 0 docxtemplater/LibreOffice findings
- `IMPLEMENTATION_PLAN.md` — phased roadmap with priorities

## Status

- ✅ Phase 0 (POC) — all checks passed
- ✅ Phase 1 (Foundation) — scaffold, DB models/migrations/seed, storage, queues, workers, frontend shell
- ✅ Phase 2 (Question Management) — CRUD, versioning, publish flow
- ✅ Phase 3 (Rule Engine) — flags/computed evaluation → canonical JSON, test sandbox
- ✅ Phase 4 (Templates) — upload, variable extraction, mapping, render/PDF tests, publish pipeline
- ✅ Phase 5 (Customer Simulation) — dynamic renderer, conditions, repeatable groups, draft/submit
- ✅ Phase 6 (Validation & Document Preparation) — canonical payload + document preview
- ✅ Phase 7 (Document Generation) — per-document BullMQ jobs (docx → pdf), DB-backed job status, SSE progress to frontend, retries/limits
- ✅ Phase 8 (Download Center) — final documents auto-generated in background after submit and appear in Download Center (no admin review required; review API kept dormant for future use)
- ⏳ Phase 9 (E-Sign) — future
