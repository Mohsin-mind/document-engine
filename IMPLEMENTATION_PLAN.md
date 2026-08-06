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

> **Multi-document flow:** A single published questionnaire can be bound to multiple `document_definitions` (e.g., Will, Trust, POA). On customer submit, the backend queries all published definitions for that question set, builds a render payload per document, enqueues one `GenerationJob` per document, and produces independent DOCX + PDF artifacts. The customer sees all generated documents in the Download Center.

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

### Phase 10 — Admin UX Rethink: Question Sets, Rules & Mapping · [P1]

> **Goal:** the admin screens are functionally complete but "developer-facing" (raw ids, `{answers.*}` DSLs, dotted paths, raw JSON). Non-technical admins must be able to go **blank → published** without typing a single internal id, dotted path, JSON block, or placeholder token. **UI/UX only — the pipeline (question sets → rules → canonical JSON → mappings → generation) is unchanged.** Detailed review: `docs/ADMIN_UX_REVIEW.md`.

Tasks:

**Question Set editor:**
- [x] P0 Auto-generate + hide question/section/group ids behind an "Advanced" panel (read-only; never the primary input). New rows get `q…` ids on add; existing ids untouched.
- [x] P0 Conditions built with **pickers** (dropdown of previously defined fields by label + equals value; against that field's options when it's a dropdown/yesno) — no raw id typing.
- [x] P0 User-friendly type labels + helper text per type (Text / Number / Date / Yes / No / Checkbox).
- [x] P0 Dropdown options as **per-line rows** (add/remove), not a comma-separated string.
- [x] P1 Section title is the primary label; id auto + advanced.

**Rules editor:**
- [x] P0 Flags as **sentence cards** (e.g. "`Spouse included` — true when `Marital status` equals `Married`"), pickers fed from the bound question set; flag `key` auto-slug + advanced override.
- [x] P0 Computed rows with **grouped field insertion** (answers, flags, list item fields) instead of hand-typed `{answers.<id>}`. Includes a **live preview** that evaluates the sentence against sample answers/flags when sample data exists. Prior computed values are not yet chainable (backend `rule-engine.js` does not resolve `{computedKey}` tokens).
- [x] P0 `includeGroups` as **checkboxes of group titles**; group maps with pickers on both sides.
- [x] P0 **"Generate sample from rules"** becomes the primary test path (reuse `generateSampleCanonical`); raw JSON demoted to an Advanced slot.

**Template mapping:**
- [x] P0 Replace flat PathSelect with a **hierarchical tree** (Zapier-style): collapsible `successorList[] → name`, **type badges** (string/number/date/array) and **inline sample values** per node from the generated canonical.
- [x] P0 Raw sample JSON demoted to a collapsed **Advanced** section; tree is the default view.
- [x] P1 Keep + surface existing confidence badges, per-row ✓ previews, loop toolbar (`{#loop}…{/loop}` ↔ `path[]`).

**Cross-cutting:**
- [x] P2 Small "Show field reference" panel (label → id → canonical path) on all three screens for power users.
- [x] P2 Plain-language validation messages (`Missing label for question 3` instead of `sections[1].questions[2]: missing label`).

**Exit criteria:** an admin publishes a working document with minimal typed ids, dotted paths, JSON, or placeholder tokens; primary inputs are human labels, dropdown selections, and auto-generated ids. Computed value templates still use `{answers.xxx}`, `{flags.xxx}`, and `{item.xxx}` tokens, but they are inserted via a grouped dropdown with live preview rather than hand-typed.

---

### Phase 11 — Production-Hardening Review (post-demo) · [P1/P2]

> **Origin:** review of the demo wiring (one questionnaire → two documents, canonical ids in UI, immutable published versions). The flow is correct; the items below fix the workarounds we had to introduce so they become proper product behaviour. **Rule of thumb going forward: the canonical JSON and template mappings should be the stable, human-readable contract between rule authors and document designers — never raw internal ids.**

Tasks:

**Semantic keys for repeatable groups (kill the id/rename hack):**
- [ ] P1 Give each repeatable group an optional `key` (auto-slug, adjustable) in the question-set definition — the same way flags/computed already have `key` (`approved UI pattern`).
- [ ] P1 Rule `includeGroups`/`groupMaps` continue to reference groups by their `key`; `evaluate` emits the canonical list under the **key** (falling back to the raw id for existing sets).
- [ ] P1 Canonical paths become readable and stable: `children[].Child Full Name` instead of `q8q1k39[].Child Full Name`.
- [ ] P1 Remove the frontend rename/display maps (`PathSelect.jsx`, `TemplateEditorPage.jsx`, `SampleTree.jsx`) once keys are stored — no more display-only translation.
- [ ] P1 Backfill demo data: add `key: "children"` to the Estate Planning questionnaire and re-map the IRLT template to `children[]` via the new-version flow (below).

**Template versioning gap (found during demo):**
- [x] P1 Add "create draft v2 from published" — a version-clone endpoint (`POST /templates/:id/versions`) that copies the published storage key + extracted variables into a new draft row; no closed-by-design dead end for editing a published template.
- [x] P1 UI button "New version from published" on the published template editor; old version stays immutable.

**Explicit questionnaire binding (remove "most recent wins"):**
- [ ] P2 `getPublishedQuestionnaire` (submission.service.js:22) selects **one** newest published set implicitly. Add an explicit `questionnaire selection` (query param, stored on the submission) when more than one published questionnaire is intended to coexist.
- [ ] P2 Document the "one active questionnaire" model formally for the single-product demo.

**Data hygiene:**
- [ ] P1 Cleanup/unpublish orphaned single-document question sets + rules (Healthcare Directive `aa890acd…`, IRLT `62104561…`) once the merged questionnaire is the only active one (they are no longer bound to any template definition).
- [ ] P2 Add an `unpublish` action for question sets/rules/templates (currently only publish exists).

**Scope/sample hardening:**
- [ ] P2 Replace `sample.answers.js` label heuristics with explicit per-question fixtures so sample values never silently regress.

**Exit criteria:** a reviewer maps a new template against canonical keys like `children[].Child Full Name` with zero raw ids anywhere; a published template can be re-mapped via the new-version flow without recreating it; the admin UI shows human labels in every dropdown and selection (no rename shims).

---

### Phase 12 — Repeatable Section Definition Cleanup · [P1]

> **Origin:** a section's "Repeatable group" checkbox and its `questions` list were mutually exclusive at render time only. The simulation renders a repeatable section as a table and silently ignores any regular questions (`repeatable ? table : questions`), but the editor still offered "+ Add question" and those questions were validated nowhere, yet still surfaced as pickable fields in the Rules editor. Fix = make the *model* exclusive, not just the renderer. **Note:** this phase was the stopgap; Phase 13 replaces the "section-level checkbox" approach with a repeatable-*question* type and obsoletes the hide/warn wiring below.

Tasks (stopgap, shipped):

- [x] P1 **Editor (`QuestionSetEditorPage.jsx`)**: hide "+ Add question" + warn on leftover questions when a section is a repeatable list. *(Super/fully superseded by Phase 13 — the checkbox is gone entirely.)*
- [x] P1 **Backend guard** (`question-set.definition.js#validateQuestionSetDefinition`): a section with both `repeatable` and a non-empty `questions` list fails validation on create/update/publish. *(Kept in Phase 13 as the "legacy `section.repeatable` only with empty questions" rule.)*
- [ ] P1 Confirming data hygiene: legacy dirty sections (questions + repeatable in one section) get migrated to a nested repeatable question on first edit (Phase 13 load normalization) — no manual copy needed.
- [ ] P2 Toggle-guard note: legacy sections in the wild self-heal via the Phase 13 load-normalization on edit (no destructive auto-removal).

**Exit criteria:** no dead fields can exist between the list and question views — a section either has one repeatable in its question list or no list at all (see Phase 13).

---

### Phase 13 — Repeatable as a First-Class Question (Dynamic Panel) · [P1]

> **Origin:** Phase 12 fixed the bug but kept the limitation that a repeatable must be its own section — you can't ask "Children list" between "Are you married?" and "Do you own pets?" in one Family section. Adopt the SurveyJS Dynamic Panel model: **a repeatable is a question type nested in `section.questions`**; a section holds normal questions and at most one repeatable list, rendered in definition order. Answers stay `answers[<group id>] = [{...}]`, so the rule engine (`includeGroups`, `when.group`, `condition.group`, `groupMaps`), sample generation and template mappings (`children[].fullName`, docxtemplater loops) are **unchanged** — the group id simply moves from `section.repeatable.id` to the question's `id`.

Tasks:

- [x] P1 **Definition schema:** a question with `type: 'repeatable'` carries `label`, `addLabel`, `min`, `max`, `fields`; its `id` is the canonical group id.
- [x] P1 **Backend validation** (`question-set.definition.js`): nested lists share the section-level list validator (unique ids incl. row fields, ≥ 1 field, labels + types + options); at most **one** repeatable per section; legacy `section.repeatable` still accepted only with empty `questions` (Phase 12 guard) and validated by the same code path. `collectQuestionIds` includes nested group + field ids.
- [x] P1 **Admin editor** (`QuestionSetEditorPage.jsx`): the "Repeatable group" checkbox is removed; "+ Add list (repeatable)" adds a repeatable row next to "+ Add question"; the list editor (label, add-label, min/max, row fields with types/options/required, "show only if", advanced ids) lives inside the question row; legacy definitions are **normalized on load** into the nested shape (migration-by-edit — saving persists the new shape).
- [x] P1 **Simulation** (`SimulationPage.jsx`): sections render questions and the inline list in definition order (legacy top-level `section.repeatable` sections still render via the old branch). Answer keys `answers[<id>]` and error keys `<id>[<ri>].<field>` are unchanged; repeatable rows can be conditioned ("show only if").
- [x] P1 **Shared validation + sample generator:** repeatable questions validate rows and produce 4 sample rows for child lists — same behavior as the legacy block.
- [x] P1 **Rules editor + template mapping:** `qsFields`, `qsGroups`, field-reference rows and the template rename map read both shapes (nested + legacy), so pickers, `includeGroups` checkboxes, group maps, `{item.X}` insertion and the `children[]` tree labels keep working with either shape.
- [x] P1 **Seeder:** the `children` section migrated to a nested repeatable question; group id `children` preserved, so seeded rules (`hasChildren`, `includeGroups`, `groupMaps.children.fullName`) are untouched.
- [ ] P2 Per-row conditional logic (`children[i].age < 18`) and list-aggregation rules ("any child under 18") — out of scope; the engine supports list-level counts only.

**Exit criteria:** an admin builds a "Family" section mixing normal questions with a Children list in one screen and publishes it; the definition never stores the old dual-mode section shape; canonical JSON and template loops are byte-identical to before the refactor.

---

### Phase 14 — Template Mapping Consistency Fixes (render-context bug + human labels) · [P1]

> **Origin:** admin review with a fresh question set + `simple.docx`: mapping `Child Full Name → <listId>[].name` passed validation but the render test failed with `[MISSING:Child Full Name]`; the tree also showed raw ids (`whatIsYourTrustName`, `name`) and full question text for list labels.

Tasks:

- [x] P1 **Render-context bug** (`render.context.js#buildRenderContext`): item-path mappings (`list[].field`) wrote the value into the *canonical* array instead of the *docx loop* array. A loop tag that differs from the canonical key (`{#Children}` ← `howManyChildren[]`) therefore rendered `[MISSING:Child Full Name]` inside the loop. Fixed with two passes: pass 1 applies scalar/loop mappings and records which docx tags map to each canonical array; pass 2 writes item values into every mapped docx loop array. Verified e2e against `simple.docx` (extract → validate → context → docxtemplater → zero `[MISSING]` markers) and the legacy `children`-named-loop case.
- [x] P1 **Human labels everywhere** (`TemplateEditorPage.jsx`, `PathSelect.jsx`): the rename map now covers **all** question ids (scalar + repeatable) and passes per-list **row-field labels**; the tree and the mapping input display `What is your trust name?` and `How many childrens do you have?[].Child Full Name` instead of raw ids (`whatIsYourTrustName`, `name`). Typing human labels round-trips back to real canonical paths (`dehumanify`).
- [x] P1 **Stale "mappings validated" gate**: `mappingGate` no longer trusts the server's `mapped-validated` flag after the admin edits a mapping (a `mappingDirty` flag forces re-validation before proceeding to the render test).
- [ ] P2 Ambiguous-label collisions in the reverse map (two questions with identical labels) — picker still works; typed lookup resolves to the last match.

**Exit criteria:** any docx loop tag can map to any canonical list (names differ) and still render item values; no raw question/field ids in the mapping tree or mapped-path display; a mapping edit forces re-validation.

---

### Phase 15 — Database Naming & Trim (schema hygiene) · [P1]

> **Origin:** schema review — 12 tables; `e_sign_requests` was dead (no module/route ever wrote or read it), `canonical_payloads` was a 1:1 cache blob that nothing read, and three table names did not reveal their role at a glance.

Tasks:

- [x] P1 **Drop `e_sign_requests`** (table, model, associations) — unused since creation; e-sign remains Phase 9/P2 scope (recreate via migration when wired up).
- [x] P1 **`document_definitions` → `document_mappings`** (model `DocumentMapping`, plus FK `generation_jobs.document_definition_id` → `document_mapping_id`): the table is the mapping/config record binding `template_version_id + question_set_id`, not a "document".
- [x] P1 **`rules` → `question_set_rules`** (model `QuestionSetRule`) so it rings as per-question-set transform rules. API paths (`/api/rules`) unchanged.
- [x] P1 **Fold `canonical_payloads` into `submissions.canonical`** (JSONB). Data copied `UPDATE submissions SET canonical = payload FROM canonical_payloads` before dropping the table (safe down-migration included). Nothing ever read the separate table back.
- [x] P1 **Migration + verification**: `20260806000100-db-rename-trim.js` applied to the dev DB (renames, column rename, backfill, drops); Sequelize model/association smoke test confirms `document_mapping_id` + `canonical` columns; `npm run build` unaffected (frontend talks only to `/api/templates` + `/api/rules`).
- [ ] P2 App relies on the sample seeder only for a working demo; `db:seed` was found broken pre-existing (`queryInterface.upsert` not a Sequelize v6 function) — needs rewriting to `bulkInsert`/`ON CONFLICT` if re-run is desired.

**Exit criteria:** 10 tables; every name states its relationship at a glance; no orphan/unwritten table; existing rows preserved (renames + canonical backfill).

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
| **Admin UX rethink (questions/rules/mapping)** | **10** | **P1** |
| **DB naming & trim (rename + drop dead tables)** | **15** | **P1** |
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
