# Legal Document Generation Platform — Implementation Plan

> **Language:** JavaScript (no TypeScript)
> **Delivery model:** Single Admin Portal (Admin Mode + Customer Simulation)

---

## 1. Overview

```
                  ADMIN MODE                       CUSTOMER SIMULATION
  ┌───────────────────────────────┐              ┌────────────────────────┐
  │ Question Sets   (Module 1)    │              │ Dynamic Questionnaire  │
  │ Rule Engine     (Module 2)    │────────────▶│ (conditional/repeat)   │
  │ Templates + Mapping (Module3) │  published   │ Save draft / Submit    │
  └───────────────────────────────┘   versions   └───────────┬────────────┘
                                                             ▼
                                     Raw Answers → Validate → Rule Engine
                                                             ▼
                                         Canonical JSON → Render Payload
                                                             ▼
                                        BullMQ (1 job per document)
                                                             ▼
                                   DOCX gen → LibreOffice PDF → store
                                                             ▼
                                   Review → Approve → Download (DOCX/PDF)
```

One questionnaire can generate **multiple documents** (Will, Trust, POA, etc.) via independent **Document Definitions**.

---

## 2. Tech Stack (JavaScript)

| Layer | Choice | Notes |
|---|---|---|
| Backend | **Node 20 LTS + Express 5** | JS-first; NestJS decorators/DI are TS-centric. Modular folders (routes → controller → service) mirror NestJS structure so a later migration is trivial. |
| Database | **PostgreSQL 16 + Sequelize v6** | Pure JS — no codegen, no TS build step. JSONB for question defs, rules, canonical JSON, versions. Prisma was rejected: v7's generator emits TS only and its JS-compatible `prisma-client-js` is deprecated. |
| Queue | **BullMQ + Redis** | One job per document; separate worker processes. |
| Templates | **docxtemplater v3 + PizZip** | Loops (`{#children}`), conditions (`{?flag}`), placeholders. |
| PDF | **LibreOffice headless (soffice)** | Dedicated worker pool, isolated processes, timeouts. |
| Storage | **Local disk** behind `StorageService` interface | Swap to S3 later by adding one provider. No code changes elsewhere. |
| Frontend | **React + Vite + Tailwind + TanStack Query** | SSE for job progress (simpler than WebSocket). |
| Dev infra | **Local services** | PostgreSQL + Redis installed locally; LibreOffice headless; no Docker. |

---

## 3. Repository Layout

> Full detailed structure: **`docs/ARCHITECTURE.md`** (authoritative). Summary below.

```
document-engine/                     # npm workspaces: backend + frontend
├── docs/                            # ARCHITECTURE.md, POC_RESULTS.md, API.md
├── storage/                         # local disk: templates/, artifacts/, temp/
├── backend/                         # Express API + workers
│   ├── src/
│   │   ├── server.js / app.js       # entry + app assembly
│   │   ├── config/                  # env config, Sequelize instance
│   │   ├── db/                      # models/ (one per table), migrations/, seeders/
│   │   ├── modules/                 # questions, rules, templates, submissions,
│   │   │                            #   generation, review, downloads, esign
│   │   │                            #   (routes → controller → service + pure libs)
│   │   ├── common/                  # storage/ (interface + disk), middleware, errors
│   │   └── queues/                  # BullMQ connections, job names
│   ├── workers/                     # docx.worker.js, pdf.worker.js, render.service.js
│   └── poc/                         # Phase 0 POC (temporary, removed after Phase 1)
└── frontend/                        # React + Vite
    └── src/
        ├── api/                     # fetch wrappers + SSE
        ├── components/              # layout/, questionnaire/, ui/
        ├── hooks/                   # use-job-progress, use-questionnaire
        └── pages/                   # admin/{question-sets,rules,templates},
                                     #   simulation/, review/, downloads/
```

---

## 4. Data Model (core tables)

| Table | Purpose | Key columns |
|---|---|---|
| `question_sets` | Versioned question sets | `status` (draft/published), `latestVersion` |
| `question_set_versions` | Immutable snapshots | `definition` (JSONB: questions, conditionals, repeatable groups, validation) |
| `rules` | Business rules per question set | `version`, `definition` (JSONB) |
| `templates` | Uploaded DOCX, immutable on publish | `name`, `status` |
| `template_versions` | Each upload = new version | `storageKey`, `extractedVariables` (JSONB) |
| `document_definitions` | Template ↔ canonical JSON mapping | `templateVersionId`, `mappings` (JSONB) |
| `submissions` | Raw customer answers | `answers` (JSONB), `status` (draft/submitted) |
| `canonical_payloads` | Rule-engine output | `payload` (JSONB), immutable |
| `generation_jobs` | Per-document queue jobs | `jobId`, `status`, `progress`, `error`, `attempts` |
| `artifacts` | Generated DOCX/PDF | `kind`, `storageKey`, `jobId` |
| `review_artifacts` | Reviewed/approved versions (never overwrite) | `status` (pending/approved), `storageKey` |
| `e_sign_requests` | Future | schema only, unused |

**Versioning rule:** published versions are immutable. Any edit creates a new draft version.

---

## 5. Phases (ordered, priority inside each)

Priority legend:
- **P0** — must-have for the end-to-end demo to work
- **P1** — completes the product, needed for "real" use
- **P2** — nice to have / future

---

### Phase 0 — Technical Spike (POC) · [P0]

**Goal:** prove docxtemplater + LibreOffice work with real lawyer-authored DOCX.

Tasks:
- [x] Acquire 1–3 real DOCX templates (lawyer-authored)
- [x] Render placeholders, loops, conditions with docxtemplater + PizZip
- [x] Handle Word run fragmentation (multi-run placeholders)
- [x] Convert DOCX → PDF with soffice headless; compare visually with MS Word
- [x] Verify fonts, numbering, page breaks, headers/footers survive
- [x] Test large template + repeatable sections (e.g., 20 beneficiaries)
- [x] Write findings into `docs/POC_RESULTS.md`

**Exit criteria:** all render correctly → proceed. Any blocker → stop and reassess.

---

### Phase 1 — Foundation · [P0]

- [x] P0 Monorepo scaffold: npm workspaces (backend + frontend), Express API, Vite app (no Docker — all services run locally)
- [x] P0 Sequelize models (tables above) + seed script + migrations
- [x] P0 `StorageService` interface + disk provider (`storage/` folder)
- [x] P0 BullMQ connections + job-name constants + worker stubs
- [x] P0 Basic admin shell UI (layout + routing: Admin Mode / Customer Simulation)
- [x] P1 Error handling middleware + structured logging
- [x] P1 Health endpoints (`/health`, Redis/DB checks)

---

### Phase 2 — Question Management (Admin) · [P0]

- [x] P0 CRUD for question sets with **draft/published versions**
- [x] P0 Question types: text, number, date, dropdown, yes/no, checkbox
- [x] P0 Conditional questions (JSONB rules like `when: {field, equals, value}`)
- [x] P0 Repeatable groups (children, assets, beneficiaries)
- [x] P0 Validation rules (required, min/max, regex, date ranges)
- [x] P0 Publish flow: version snapshot, immutable after publish
- [x] P1 Copy-from-published (edit creates new draft from latest published)
- [ ] P2 Question-set preview in admin UI

**Output:** published `question_set_version` + `definition` JSONB.

---

### Phase 3 — Rule Engine (Admin) · [P0]

- [x] P0 Rule CRUD per question set (draft/published, same versioning)
- [x] P0 Rule types: flags (`hasSpouse`), computed values, computed text
- [x] P0 Rule evaluation engine (pure JS, no template business logic)
- [x] P0 Sample rules: `if married → hasSpouse`, `children>0 → showGuardianClause`
- [x] P0 Output **Canonical JSON**:

```json
{
  "customer": { "fullName": "..." },
  "flags": { "hasSpouse": true, "showGuardianClause": false },
  "computed": { "executorClause": "..." },
  "children": [ { "name": "...", "dob": "..." } ]
}
```

- [x] P1 Rule test sandbox (paste sample answers → view canonical output)

**Exit criterion:** DOCX templates never contain business logic.

---

### Phase 4 — Template Management + Mapping (Admin) · [P1]

- [x] P1 Upload DOCX → stored as new immutable template version
- [x] P1 **Variable extraction** (regex scan of `{...}` tokens) → variable list
- [x] P1 Mapping UI: template variable → canonical JSON path
  - `clientName → customer.fullName`
  - `children → children[]`
- [x] P1 Mapping validation (missing/unmapped variables, invalid paths)
- [x] P1 **DOCX render test** (sample canonical JSON → generate DOCX)
- [x] P1 **PDF conversion test** (render → soffice → PDF)
- [x] P1 Preview (download test DOCX/PDF)
- [x] P1 Publish (immutable; rejected if any check fails)
- [x] P0 `document_definitions`: one questionnaire ↔ multiple templates, each with own mapping

**Publish pipeline (gate):** Upload → Extract → Map → Validate → DOCX test → PDF test → Preview → Publish.

---

### Phase 5 — Customer Simulation · [P0]

- [x] P0 Dynamic questionnaire renderer from published `question_set_version`
- [x] P0 Conditional question visibility (client-side + server-side)
- [x] P0 Repeatable groups UI (add/remove rows)
- [x] P0 Validation on submit (server-side re-validates raw answers)
- [x] P0 Save draft (resume later)
- [x] P0 Submit → store **raw answers** (immutable)
- [x] P1 Progress indicator through questionnaire sections

---

### Phase 6 — Validation & Document Preparation · [P0]

Pipeline (server-side, on submit):

```
Raw answers → validate → rule engine → canonical JSON → per-document render payload
```

- [x] P0 Validate raw answers against question-set validation rules
- [x] P0 Run rule engine → store `canonical_payloads` (immutable)
- [x] P0 Build render payload per document definition (mapping + placeholder substitution)
- [x] P0 Return payload preview (which docs will be generated)

---

### Phase 7 — Generation Queue · [P0]

- [x] P0 Enqueue **one BullMQ job per document** (Will, Trust, POA…)
- [x] P0 `docx-worker`: docxtemplater render → artifact stored
- [x] P0 `pdf-worker`: soffice conversion (isolated pool, concurrency 2–4)
- [x] P0 Job status + progress updates (`generation_jobs`, SSE to frontend)
- [x] P0 Retries + timeouts + error logging per job
- [x] P1 Concurrency controls per queue (BulMQ limiter)
- [x] P1 Graceful shutdown / dead-letter queue
- [ ] P2 Job metrics (BullMQ dashboard integration)

**Only heavy ops are queued** — nothing else blocks the web process.

---

### Phase 8 — Review Workflow + Download Center · [P1]

> **Flow note:** the customer flow needs **no admin intervention** — on submit, background workers generate the final DOCX + PDF, which appear directly in the Download Center. The review workflow below is kept as optional admin tooling (dormant API, no UI) for future "lawyer review" needs.

- [x] P1 Download center: DOCX + PDF per artifact, generation status (automatic, no review gate)
- [x] P1 Review list: generated DOCX per job with status (API only)
- [x] P1 Review in admin → upload reviewed DOCX → generate reviewed PDF (API only)
- [x] P1 Approve (reviewed versions stored as **new artifacts**, never overwrite) (API only)
- [ ] P1 Audit history (job events, review events, timestamps)

---

### Phase 9 — E-Sign Readiness · [P2]

- [ ] P2 `e_sign_requests` schema + provider-agnostic status model (pending/sent/signed/failed)
- [ ] P2 Webhook endpoint stub for provider callbacks
- [ ] P2 (Future) send approved PDF → webhook → store signed PDF

---

## 6. Priority Matrix

| Feature | Phase | Priority |
|---|---|---|
| docxtemplater + LO POC | 0 | P0 |
| Scaffold + DB + storage + queues | 1 | P0 |
| Question sets (types, conditionals, groups, validation, versioning) | 2 | P0 |
| Rule engine → canonical JSON | 3 | P0 |
| Customer simulation (questionnaire, draft, submit) | 5 | P0 |
| Validation + prep pipeline | 6 | P0 |
| Generation queue (DOCX + PDF workers) | 7 | P0 |
| Template upload/extraction/mapping | 4 | P1 |
| Render/PDF tests + publish gate | 4 | P1 |
| Review workflow | 8 | P1 |
| Download center + audit | 8 | P1 |
| E-sign schema | 9 | P2 |

**Critical path:** Phase 0 → 1 → 2 → 3 → 5 → 6 → 7 (delivers a working demo).
**Parallelizable after Phase 1:** Phases 2 and 4 (admin CRUD vs. template pipeline) can proceed alongside each other; Phase 5 depends on 2, Phase 6 depends on 3 + 4.

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Lawyer DOCX has fragmented runs / broken loops | Phase 0 POC with real files before any code |
| LibreOffice rendering differs from MS Word | POC comparison + pin LO version locally |
| Queue keys evicted by Redis cache policy | Dedicated Redis or non-evicting policy for BullMQ keys |
| Worker filesystem drift (api vs workers) | Single local machine in dev; shared `storage/` root (symlink-safe keys) |
| Versioning complexity (5 versioned entities) | Single `published/immutable` rule + JSONB snapshots; avoid table-per-version |
| Slow PDF conversion under load | Isolated LO worker pool, concurrency caps, timeouts, retries |
