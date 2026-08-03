# Architecture

> Single Admin Portal: **Admin Mode** (configuration) + **Customer Simulation** (demo questionnaire).
> JavaScript, Express, PostgreSQL (Sequelize), BullMQ + Redis, docxtemplater, LibreOffice headless, local disk storage.

---

## 1. Repository Layout

```
document-engine/                     # root (npm workspaces: backend + frontend)
├── package.json                     # workspaces: ["backend", "frontend"]
├── IMPLEMENTATION_PLAN.md
├── README.md
├── .gitignore                       # storage/, node_modules/, .env
├── docs/
│   ├── ARCHITECTURE.md              # this file
│   ├── POC_RESULTS.md               # Phase 0 findings
│   └── API.md                       # route + payload reference
├── storage/                         # local disk storage (gitignored)
│   ├── templates/                   # uploaded DOCX templates (immutable)
│   ├── artifacts/                   # generated DOCX/PDF (immutable)
│   └── temp/                        # worker scratch space
├── backend/                         # Express API + workers (npm workspace)
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── server.js                # entry point: HTTP API
│   │   ├── app.js                   # express app assembly (routes, middleware)
│   │   ├── config/
│   │   │   ├── index.js             # env + app config
│   │   │   └── db.js                # Sequelize instance
│   │   ├── db/
│   │   │   ├── index.js             # model registration + associations
│   │   │   ├── models/              # one file per table (see §4)
│   │   │   ├── migrations/          # sequelize-cli migrations
│   │   │   └── seeders/
│   │   ├── modules/                 # feature modules (routes → controller → service)
│   │   │   ├── questions/           # question sets, versions, publish
│   │   │   │   ├── questions.routes.js
│   │   │   │   ├── questions.controller.js
│   │   │   │   ├── questions.service.js
│   │   │   │   └── question-set.definition.js   # JSONB schema of a question set
│   │   │   ├── rules/
│   │   │   │   ├── rules.routes.js
│   │   │   │   ├── rules.controller.js
│   │   │   │   ├── rules.service.js
│   │   │   │   └── rule-engine.js               # PURE evaluation (no express)
│   │   │   ├── templates/
│   │   │   │   ├── templates.routes.js
│   │   │   │   ├── templates.controller.js
│   │   │   │   ├── templates.service.js         # upload, version, publish gate
│   │   │   │   ├── variable-extractor.js        # regex scan of {tokens}
│   │   │   │   └── document-definition.service.js # mapping canonical → template vars
│   │   │   ├── submissions/
│   │   │   │   ├── submissions.routes.js
│   │   │   │   ├── submissions.controller.js
│   │   │   │   ├── submissions.service.js       # draft/save/submit
│   │   │   │   └── questionnaire-renderer.js    # dynamic questionnaire builder
│   │   │   ├── generation/
│   │   │   │   ├── generation.routes.js
│   │   │   │   ├── generation.controller.js
│   │   │   │   ├── generation.service.js        # enqueue jobs, job status
│   │   │   │   ├── prepare-payload.js           # canonical JSON → render payloads
│   │   │   │   └── progress.events.js           # SSE hub (in-memory)
│   │   │   ├── review/
│   │   │   │   ├── review.routes.js
│   │   │   │   ├── review.controller.js
│   │   │   │   └── review.service.js            # reviewed artifacts, approve
│   │   │   ├── downloads/
│   │   │   │   ├── downloads.routes.js
│   │   │   │   └── downloads.controller.js      # file streaming + audit list
│   │   │   └── esign/                           # schema only (Phase 9, stub)
│   │   │       └── esign.model.js
│   │   ├── common/
│   │   │   ├── errors.js                        # AppError classes
│   │   │   ├── async-handler.js
│   │   │   ├── logger.js
│   │   │   ├── middleware/
│   │   │   │   ├── error-handler.js
│   │   │   │   └── not-found.js
│   │   │   └── storage/
│   │   │       ├── storage.interface.js         # contract: save/read/delete/url
│   │   │       ├── disk.storage.js              # local FS implementation
│   │   │       └── index.js                     # provider factory
│   │   └── queues/
│   │       ├── connection.js                    # BullMQ redis connection
│   │       ├── job-names.js
│   │       ├── queues.js                        # queue definitions + options
│   │       └── job-context.js                   # job → DB row helpers
│   └── workers/                                 # separate processes
│       ├── index.js                             # worker entry (env: DOCX|PDF|BOTH)
│       ├── docx.worker.js                       # docxtemplater render pool
│       ├── pdf.worker.js                        # LibreOffice conversion pool
│       └── render.service.js                    # shared: template load + render
└── frontend/                                    # React + Vite (npm workspace)
    ├── package.json
    ├── vite.config.js                           # dev proxy → backend
    ├── index.html
    └── src/
        ├── main.jsx
        ├── app.jsx                              # layout + navigation shell
        ├── router.jsx
        ├── api/                                 # fetch wrappers, one per module
        │   ├── client.js                        # base fetch + error handling
        │   ├── questions.js
        │   ├── rules.js
        │   ├── templates.js
        │   ├── submissions.js
        │   ├── generation.js                    # + SSE subscription
        │   └── downloads.js
        ├── hooks/
        │   ├── use-job-progress.js              # SSE hook
        │   └── use-questionnaire.js             # dynamic form state
        ├── components/
        │   ├── layout/                          # sidebar (Admin | Simulation), topbar
        │   ├── questionnaire/                   # dynamic renderer (input types, groups)
        │   │   ├── QuestionField.jsx
        │   │   ├── RepeatableGroup.jsx
        │   │   └── QuestionnaireForm.jsx
        │   └── ui/                              # Button, Card, Badge, Toast, Spinner
        └── pages/
            ├── admin/
            │   ├── question-sets/               # list, editor, publish
            │   ├── rules/                       # rule editor + test sandbox
            │   └── templates/                   # upload, mapping, render/pdf test, publish
            ├── simulation/                      # customer questionnaire page
            ├── review/                          # review workflow
            └── downloads/                       # download center + audit
```

### Module convention

Every feature module follows the same shape:

```
modules/<name>/
  <name>.routes.js       # express router: HTTP in/out only
  <name>.controller.js   # request parsing, status codes, response shape
  <name>.service.js      # business logic, DB access (via models), queue calls
  <name>.definition.js   # pure data: JSONB schemas, validation, rule shapes
```

**Rules:**
- Controllers never talk to Sequelize directly; services never touch `req`/`res`.
- `rule-engine.js`, `prepare-payload.js`, `variable-extractor.js` are **pure functions** (no DB, no express) so they are unit-testable and reusable from workers.
- Only heavy work (DOCX render, PDF conversion) is queued.

---

## 2. Request Flow (end-to-end)

```
  Admin Mode                          Customer Simulation
┌──────────────────────────┐        ┌───────────────────────────────┐
│ question sets (CRUD)     │        │ GET  /api/sim/questionnaire   │
│ rules (CRUD)             │        │ POST /api/sim/drafts          │ (save draft)
│ templates (upload, map)  │        │ POST /api/sim/submit          │ (raw answers)
└──────────┬───────────────┘        └──────────────┬────────────────┘
           │ published versions                    │
           ▼                                       ▼
   (DB: question_set_versions,              submissions (raw answers)
    rules, template_versions,               → validate (server-side)
    document_definitions)                   → rule-engine → canonical payload
                                             → prepare-payload (per document
                                               definition: render payloads)
                                                       │
                                                       ▼
                                POST /api/generation/jobs (1 job per document)
                                                       │
                                          ┌────────────▼───────────┐
                                          │  BullMQ                │
                                          │  docx.queue            │
                                          │  pdf.queue             │
                                          └────────────┬───────────┘
                                                       ▼
                              docx-worker: template + render payload → DOCX artifact
                              pdf-worker:  soffice headless → PDF artifact
                              (both update generation_jobs progress; SSE push)
                                                       │
                                                       ▼
                              Review (admin) → upload reviewed DOCX → reviewed PDF → approve
                              Download center: DOCX/PDF streaming + audit history
```

---

## 3. Queue Design (BullMQ)

| Queue | Consumers | Concurrency | Job data | Notes |
|---|---|---|---|---|
| `docx.queue` | `docx-worker` | 2 | `{ generationJobId, templateVersionId, documentDefinitionId, renderPayload, artifactKey }` | docxtemplater render, CPU-light but isolated for retries |
| `pdf.queue` | `pdf-worker` | 1–2 | `{ generationJobId, docxKey, pdfKey }` | LibreOffice headless, ~1–3s per doc; timeouts |

- **One `generation_jobs` row per document**, referenced by every job payload.
- Workers are **stateless**: they read template/render payload from DB + storage, write artifacts to storage, update `generation_jobs.progress/status/error`.
- Retry policy: 3 attempts, exponential backoff; final failure → `failed` status + logged error JSONB.
- Dead-letter: jobs move to `docx.queue:dead` / `pdf.queue:dead` for inspection.
- `progress.events.js` keeps an in-memory SSE hub keyed by `submissionId`; workers push progress via a small `publishProgress` helper (Redis pub/sub if multi-instance later).
- Graceful shutdown: `worker.close()` after draining.

---

## 4. Data Model (Sequelize)

All versioned entities follow: **published rows are immutable; editing creates a new draft row.**

| Model | Table | Key columns | Notes |
|---|---|---|---|
| `QuestionSet` | `question_sets` | `name`, `status`, `latestVersionId` | root entity |
| `QuestionSetVersion` | `question_set_versions` | `versionNo`, `status(draft/published)`, `definition` (JSONB) | questions, conditionals, repeatable groups, validation |
| `Rule` | `rules` | `questionSetId`, `versionNo`, `status`, `definition` (JSONB) | evaluated by rule-engine |
| `Template` | `templates` | `name`, `status`, `latestVersionId` | root entity |
| `TemplateVersion` | `template_versions` | `versionNo`, `status`, `storageKey`, `extractedVariables` (JSONB), `docxTestStatus`, `pdfTestStatus` | immutable once published |
| `DocumentDefinition` | `document_definitions` | `templateVersionId`, `mappings` (JSONB), `status` | template var → canonical path, e.g. `clientName → customer.fullName` |
| `Submission` | `submissions` | `questionSetVersionId`, `status(draft/submitted)`, `answers` (JSONB), `submittedAt` | raw answers, immutable after submit |
| `CanonicalPayload` | `canonical_payloads` | `submissionId`, `payload` (JSONB) | rule-engine output, immutable |
| `GenerationJob` | `generation_jobs` | `submissionId`, `documentDefinitionId`, `status`, `progress`, `docxArtifactId`, `pdfArtifactId`, `error` (JSONB), `attempts` | one per document |
| `Artifact` | `artifacts` | `submissionId`, `kind(docx/pdf)`, `storageKey`, `source(original/reviewed)`, `jobId` | generated files, immutable |
| `ReviewArtifact` | `review_artifacts` | `artifactId`, `status(pending/approved)`, `reviewedDocxKey`, `reviewedPdfKey` | never overwrites originals |
| `ESignRequest` | `e_sign_requests` | `artifactId`, `status(pending/sent/signed/failed)`, `providerRef` | Phase 9, schema only |

Conventions: `id` UUID PK, `createdAt/updatedAt` on all, JSONB columns for definitions/payloads, index on `(status, createdAt)` for job queues.

---

## 5. Storage Abstraction

```js
// common/storage/storage.interface.js
const StorageInterface = {
  async save({ key, data }) {},     // data: Buffer/stream
  async read({ key }) {},           // → Buffer
  async delete({ key }) {},
  async url({ key, downloadName }) {}, // → path served via /files/:key
};
```

- `disk.storage.js`: writes under `storage/`, key = `templates/<id>.docx`, `artifacts/<submissionId>/<docId>.docx|pdf`.
- Provider selected by `STORAGE_DRIVER=disk` in config — an `s3.storage.js` can be added later without touching callers.
- Files are served through `GET /api/files/:key` (controller streams from storage, sets `Content-Disposition`), so no public directory exposure.

---

## 6. API Surface (prefix `/api`)

| Method | Route | Purpose |
|---|---|---|
| GET/POST | `/admin/question-sets` | list / create question sets |
| GET/PUT | `/admin/question-sets/:id` | read / edit draft |
| POST | `/admin/question-sets/:id/publish` | snapshot + publish |
| GET/POST | `/admin/rules` · `/admin/rules/:id/publish` | rule CRUD + versioning |
| POST | `/admin/templates` | upload DOCX (→ new TemplateVersion) |
| GET | `/admin/templates/:id/variables` | extracted `{tokens}` |
| PUT | `/admin/templates/:id/document-definition` | save mapping |
| POST | `/admin/templates/:id/test` | DOCX render test + PDF test |
| POST | `/admin/templates/:id/publish` | publish gate (all checks must pass) |
| GET | `/sim/questionnaire?questionSetVersionId=` | dynamic questionnaire definition |
| POST | `/sim/drafts` · `/sim/submit` | save draft / submit raw answers |
| POST | `/api/generation/jobs` | enqueue one job per document |
| GET | `/api/generation/jobs?submissionId=` | job status list |
| GET | `/api/generation/progress?submissionId=` | SSE stream |
| GET/POST | `/admin/review/*` | review workflow |
| GET | `/api/downloads/:submissionId` | artifact list + audit |
| GET | `/api/files/:key` | stream file |

---

## 7. Frontend Structure Notes

- **Shell**: sidebar with two sections — Admin Mode (Question Sets / Rules / Templates) and Customer Simulation (Questionnaire / Review / Downloads).
- **API layer**: one module per backend module; `client.js` adds `X-Request-Id`, JSON errors, 401 handling.
- **Questionnaire renderer**: driven by the JSONB definition from `GET /sim/questionnaire`; client-side conditional visibility + server-side revalidation on submit.
- **SSE**: `use-job-progress` hook subscribes to `/api/generation/progress` and updates a job list; state via TanStack Query.
- **Publish gates** shown as checklists in template UI (upload → map → validate → DOCX test → PDF test → preview → publish).

---

## 8. Phase 0 POC (temporary)

Lives in `backend/poc/` while Phase 0 runs; findings are captured in `docs/POC_RESULTS.md` and the folder is removed once Phase 1 absorbs the working pieces (`render.service.js`).
