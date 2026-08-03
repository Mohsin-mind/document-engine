# Phase 0 — POC Results (docxtemplater + LibreOffice)

> Date: 2026-08-03 · Tools: `docxtemplater@3.69.3`, `pizzip@3.1.7`, `LibreOffice 6.4.7.2`

## Verdict: PROCEED ✅

Rendering, loops, conditions, header/footer placeholders and DOCX→PDF conversion all verified with a synthetic lawyer-style Will template. 15/15 automated checks passed.

## What was tested

| Area | Result | Notes |
|---|---|---|
| Simple placeholders `{customer.fullName}` | ✅ | Replaced in body, header, footer |
| **Word run fragmentation** (placeholder split across runs) | ✅ | Split `{customer.full` + `Name}` merged and replaced correctly |
| Loops `{#children}...{/children}` | ✅ | 3 items rendered; empty array collapses cleanly |
| Conditions `{#flag}...{/flag}` | ✅ | Truthy renders, falsy collapses |
| Computed text substitution | ✅ | |
| Numbered list (numbering.xml) | ✅ | Present in generated DOCX/PDF |
| DOCX → PDF (soffice headless) | ✅ | Both outputs generated (20 KB) |
| No leftover `{...}` in output | ✅ | |

## Critical findings (apply to real templates)

1. **`{?tag}` condition syntax is gone in v3.69.** Core conditions now use the loop syntax `{#flag}...{/flag}` (boolean check). A template using `{?tag}` fails with a confusing **"Unopened loop"** error. Templates written for older docs/examples must be migrated. (The `{?text}` paragraph syntax only exists in the separate paid *Paragraph Placeholder* module.)
2. **Dotted tags need a custom parser.** Since ~3.60 the default parser does exact key lookup only — `{customer.fullName}` silently renders missing unless you pass `parser`. We use a **safe dotted-path parser** (no eval), so canonical JSON paths like `customer.fullName`, `children[].name` work.
   - Do **not** use the bundled `angular-expressions` parser for user templates — it executes arbitrary expressions (template injection risk).
3. **Loop-internal placeholders** (`{name}`, `{dob}` inside `{#children}`) resolve against the loop item scope automatically.
4. **Paragraph loops**: `paragraphLoop: true` needed for clean paragraph-level repetition; `linebreaks: true` for multi-line values.
5. **Whitespace**: `xml:space="preserve"` runs keep leading spaces — fine for output, beware when asserting text in tests (normalize whitespace).
6. **LibreOffice 6.4 (local)** converts fine. Warnings about missing JVM (`javaldx`) are harmless for DOCX→PDF. For production parity, pin a newer LO version (7.x) and test against MS Word-rendered files.
7. **nullGetter**: default renders `undefined` strings into legal docs — we override to produce `[MISSING:tag]` so unmapped variables are loud in test renders, and empty string for loops.

## Carried into Phase 1+

- `backend/workers/render.service.js` contains the proven implementation: safe dotted parser + `renderDocx()` + `convertToPdf()` (temp-file based, timeouts).
- Template management (Phase 4) must enforce the `{#...}` condition style and run an extraction + validation pass before publishing.
