# Admin UX Review — Question Sets, Rules, and Template Mapping

**Scope:** Review-only. No code changes. Goal is to make the core feature (question-set → rules → template mapping) usable by a **non-technical admin** who will not, and should not, type technical values (question IDs, `{answers.<id>}` templates, canonical `grantor.fullName` dotted paths, or raw JSON).

**Status:** All three features (render test, generate-sample-from-rules, gated 4-step wizard with custom PathSelect + auto-suggest + confidence badges, publish auto-redirect) are built and working. This document is about the UX *rethink*, not about whether the pipeline works.

---

## 1. Executive Summary

The engine's data pipeline is:

```
Question Set (fields)  →  Rules (flags + computed + group maps)  →  Canonical JSON  →  Template mapping (tag → canonical path)  →  render
```

Technically this is a clean, ID-based pipeline and it produces correct documents (verified end-to-end). But every admin screen currently exposes the **technical representation** — raw identifiers and dotted paths — and forces the admin to understand three separate internal vocabularies:

| Admin input | Today is | Should be |
|---|---|---|
| Question ID | `qr9tznj` (must be typed/kept unique) | auto-generated, invisible |
| Rule flag key | `hasSpouse` (monospace, must be unique) | plain sentence "Spouse is included if…" |
| Computed value | `{answers.executorName}…` (hand-typed template) | point-and-click from a field picker |
| Include groups | comma list of group ids | checkboxes of group titles |
| Group maps | `{item.name}` templates | visual row mapping |
| Test sandbox | raw JSON `answers` + raw canonical JSON | "Generate a sample submission" button |
| Template mapping | dotted path string + editable JSON | tree with type badges + dropdown autocomplete (already partly done) |

**Core finding:** the mapping step is the furthest along (PathSelect + suggestions + confidence badges), but the *question-set* and *rules* editors are still fully "developer-facing." Per the user's framing ("rethink input and mapping… this still looks technical"), the fix is not more validation — it is **restructuring the input so admins express intent in plain language and the system resolves IDs/paths for them**.

---

## 2. Current UI Challenges by Screen

### 2.1 Question Set Editor (`QuestionSetEditorPage.jsx`)

Verified against the file:

1. **Raw ID exposed.** Each field row shows a monospace `ID` input whose value is a generated token (`qr9tznj`, `successor1Name`). Admins must not touch these, yet they're editable at full width (line 18–25). Risk: an accidental edit silently breaks rules/templates/mappings that reference the ID.
2. **Section id is a free-text fork.** The section id input (line 136) is free text and only reachable by scrolling; a typo makes sections unreferencable by condition `group:` or `includeGroups`.
3. **Condition editor is raw (`when…`).** "condition field id" + "equals value" (lines 66–89). `field` must be typed as the exact internal id. No dropdown of previously defined fields — SurveyJS shows a picker of the fields defined above.
4. **Types are raw labels with no behavioral hints.** `type` select shows `text/number/date/dropdown/yesno/checkbox`. But the form never tells the admin what each type *does* — e.g. `date` renders a date picker, `yesno` renders two buttons, `dropdown` requires options. There is no "sample question" preview to explain type semantics.
5. **Dropdown options are a comma-separated string** (line 96–100). Works, but no per-option value/label distinction (needed if an admin wants "Mr." displayed but `Mr.` stored, or numeric values behind labels). Real tools (SurveyJS, Formstack) model options as `{value, label}` rows.
6. **Repeatable group is heavy.** Its editor mirrors all of the above (raw ids, min/max, raw fields). It's a second-class, indigo-highlighted section with monospace ids. For a legal-document use case this is the "beneficiaries/children" list, which is central — it should not feel like a power feature hidden under a toggle.
7. **No live preview.** "Save Draft" is the only feedback other than validation errors on publish. There is no "rendered form" preview, so an admin cannot verify question order/conditions/types until a real submission arrives.

### 2.2 Rules Editor (`RulesEditorPage.jsx`)

Verified against the file:

1. **Flag definitions read like code.** "flag key (e.g. hasSpouse)" + a condition select ("field equals / group min / always / all") + free-text field/group ids (lines 18–69). The admin has to know: which earlier field ids exist, and that `group` means a repeatable section's id.
2. **Field/group refs are not pickers.** Lines 36–48 type the source field id and `equals` value by hand. No dropdown of fields already defined in the bound question set, no cross-screen link.
3. **Computed values are a template DSL.** The row is `key` + `{answers.x}…` monospace template (lines 179–206). The behind-screen failure we hit (using `answers.grantorFullName` instead of `answers.qr9tznj`) was a *self-inflicted* ID problem — the UI never surfaces the real ids, so an admin writes the logical name they *wish* existed.
4. **Group maps use a second DSL.** `{item.name}` placeholders resolved to `children[0].name`, entered as raw text (lines 251–281). Two different template grammars (`{answers.*}` vs `{item.*}`) plus dotted canonical keys is a lot of vocabulary.
5. **Include-groups is a comma string** (lines 219–228): children, assets, beneficiaries — no validation against actual group ids.
6. **Test sandbox is two raw JSON blocks** (lines 312–335): raw `answers` input plus the full canonical JSON output. JSON is the *worst* possible input surface for a non-technical admin ("Run rules → Canonical JSON" is literally a developer label). We did add "Generate sample from rules" on the *template* side, but the rules side still requires hand-authored JSON.

### 2.3 Template Editor Mapping Step (`TemplateEditorPage.jsx` + `PathSelect.jsx`)

Verified against the files. **Best of the three**, but still technical:

1. **Dotted-path strings are the primary input.** PathSelect (lines 3–54) is a flat, alphabetical/filtered list of `grantor.fullName`, `successorList[].name` strings with autocomplete. Functional and prefilled with high/medium/low confidence suggestions — but the *shape* of the payload is only visible as a raw JSON `<details>` block (step 1, lines 331–341).
2. **No hierarchy.** The flat list hides that `successorList[]` is an array of `{name, phone}` objects. A loop tag must be mapped to a `path[]` and an item field to `children[].name`; the flat list doesn't communicate this relationship.
3. **No type labels in the mapper.** Zapier/Stedi-style mapping shows a data-type badge (string / number / date / array) on every source field. PathSelect shows none, so a loop tag vs. a string tag look identical at a glance.
4. **Sample JSON is authoritative and editable.** The mapping and the render test both feed off a JSON textarea (steps 1 & 2). An admin who hand-tweaks it can silently diverge test behavior from reality.
5. **Signal present but not visual:** per-row "✓ value" preview exists after save (line 423–431) and confidence badges exist (lines 411–421) — both excellent. They'd be stronger if the source side were a tree rather than a string list.

---

## 3. What Field Types Does the Mapping Actually Need?

The backend already supports a fixed, complete for legal documents set (`question-set.definition.js:1`):

| Type | Stored/rendered as | Mapping UX impact |
|---|---|---|
| `text` | string | single-line free input |
| `number` | number | numeric stepper |
| `date` | date string | date picker (native) |
| `dropdown` | one of options | radio/select; needs option rows |
| `yesno` | boolean-ish | two buttons / toggle |
| `checkbox` | boolean | single checkbox (e.g. "I have a will") |

Plus two derived kinds from rules:
- **flag** → canonical boolean (e.g. `hasHealthcareAgent`) — drives conditional paragraphs; not a form field.
- **computed** → arbitrary string derived from other answers (e.g. executor clause).
- **group/repeatable** → canonical **array of objects**; appears in mapping as `path[]` + `path[].field`.

**Finding:** the type vocabulary is sufficient and matches the document's real needs. The problem is *not* missing types; it's that types are (a) shown as raw tokens, and (b) never exposed as labelled metadata in the mapping tree. Confirmed missing affordances for a friendly mapping UI: **hierarchical tree navigation**, **type badges on each source field**, **search/filter within the tree**, and **inline example value per field** (the sample canonical already provides the values — we just don't render them beside the paths today).

---

## 4. How Real Products Solve This (web research)

### SurveyJS (form design)
- **Element IDs are auto-assigned and hidden** from the designer; respondents and integrations never see them.
- Field pickers, **conditional-show logic is a dropdown over previously defined fields** (never raw ids), and options are value/label rows.
- Live preview pane next to the designer.
→ Echoes: hide IDs; conditions reference earlier fields *by label* via dropdown; options = rows.

### Keelstone / document-automation template builders (e.g. DocuX, PandaDoc-style clause tokens)
- **Point-and-click token insertion**: designer selects a paragraph, clicks a merge-field from a sidebar; the editor inserts `{FieldName}` or wraps loops `{#loop}…{/loop}` automatically — **no hand-typed placeholders**.
- Token names are **human labels**, not keys (`Purchaser Full Name`), and the system stores the mapping underneath.
→ Echoes: computed/template authoring should be "pick a field → insert token", never `{answers.x}` typing; loop wrap should be a toolbar action, not a string.

### Zapier / Stedi / Make (field mapping) — the closest analog to our mapping step
- **Hierarchical, collapsible tree** of the source schema (not a flat string list), with **data-type badges** per node (text/number/date/array).
- **Click-to-map** with dropdown autocomplete and fuzzy matching — precisely our suggestions/badges, but rendered over a tree.
- **"Enhanced field mapping"** for nested arrays: expand `successorList[] → name`, map without typing dotted paths.
- Confidence indication from guessed matches (grey "maybe" mapping) — we already ship High/Medium/Low badges.
→ Echoes: keep suggestions + confidence, but swap the flat list + JSON textarea for a Zapier-style tree with type badges and in-tree search, and show the sample value inline.

### Formstack / Typeform (conditional logic)
- Conditional visibility built with dropdown-based "this field shows when *that answer*…", and per-question preview.

---

## 5. Recommendations (ordered by impact on "making the main feature easy")

### P0 — Question set editor: de-technicalize
1. **Make question/section IDs read-only, auto-generated, hidden behind "Advanced".** Editor shows `Label`, `Type`, `Required` (+ condition). Generate ids via the existing `uid()`; show a stable short human slug (`grantor-full-name`) only in an expandable "Advanced" panel for power users, never as the primary field.
2. **Condition editor becomes pickers.** "Show this question only if" → dropdown of *prior* fields (by label) + equals value (dropdown of that field's options when the source is a dropdown/yesno). No raw id typing.
3. **Type select shows semantic help.** Under the type, one-line helper (e.g. "date → picker with a calendar"). Add **"+ Add question" prefilling Label only**; id auto.
4. **Dropdown options as rows** (label + optional value), not a comma string.
5. **Split section id** (auto) from section title (the label) so conditions reference titles.

### P0 — Rules editor: replace DSLs with pickers
6. **Flags as sentence cards**, not key+when rows. Example card: "`Spouse included` — true when **`Marital status`** equals **`Married`**" where both blank spots are dropdowns fed from the *bound question set's* fields (frontend already loads question sets for templates; reuse for rules). Keep the flag `key` internal/auto with an "Advanced" field.
7. **Computed rows become field picker + template with token insertion.** Left: "output field" label. Right: a rich text/template input with a **"insert answer field"** @-menu populated from the bound question set (and repeatable fields with loop syntax). Merge-group `flags`, field picker, and auto ids. Removes the entire `{answers.…}` and `{item.…}` hand-typing surface.
8. **includeGroups → checkboxes of group titles; group maps → drag-down rows** with pickers on both sides (`canonical row.field` ⇐ `item.name`), not text.
9. **Test sandbox: primary path is "Generate sample from rules"** (already exists on the template side) rendered as a *read-only* preview tree with values. Raw JSON stays only in an expandable "Advanced" slot. Never ask the admin to write JSON.

### P1 — Template mapping: tree-ify and type-badge it
10. **Replace the flat PathSelect list with a hierarchical tree** built from the already-generated canonical sample (`paths` + the sample object): expandable `successorList[]` → `name`, with **type badges** (string/number/date/array) and **inline sample values** on each node (we already have the values in the sample canonical, so this is pure frontend).
11. **Keep and surface**: suggestion confidence badges, per-row ✓ preview, mapped-count chips. Render the sample JSON textarea as collapsible "Advanced" instead of the default view; the tree becomes the default.
12. **Loop tagging via toolbar**: selecting a loop tag offers "wrap with {#loop}…{/loop}" mapping to `path[]` automatically; item tags offer `path[].name` via the tree. Title/tooltip already present; extend to the tree form.

### P2 — Cross-screen consistency
13. **One source of truth for IDs.** All three screens already reference the same question set; add a small "Show field reference" panel (label → id / canonical path) so power users can cross-check without memorizing ids.
14. **Validation messages in plain language**, e.g. `Missing label for question 3` instead of `sections[1].questions[2]: missing label`.

---

## 6. Non-Goals (per user: "ignore less priority stuff")

- Subscription/billing/admin-account UX.
- End-user (respondent) form UX, theming, mobile.
- Document formatting/PDF branding, page layout options.
- Performance and infra.
- Anything outside question-set authoring, rules, and template mapping.

---

## 7. Suggested "north star"

After the rethink, a **reasonable non-technical admin** should be able to go from blank to published with **zero typing of ids, dotted paths, JSON, or placeholders**:

1. Build the form with human labels + types + simple conditions (ids behind the scenes).
2. Add flags/computed clauses by *picking* answer fields in sentences; generate a sample submission.
3. Map tags by picking leaves on a type-tagged tree (with confidence hints), run the render test, publish.

Every remaining text input should be either a human label, a number, an option value, or a UUID that is auto-generated and hidden.