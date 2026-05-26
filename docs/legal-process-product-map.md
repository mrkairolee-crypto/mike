# Mike legal-process product map

This document maps Mike's current feature set to practical legal-process use cases and prioritizes the first production-quality flow to harden.

## Current product shape

Mike is an AI legal document workspace with:

- Next.js frontend in `frontend/`
- Express/TypeScript backend in `backend/`
- Supabase Auth/Postgres
- S3-compatible object storage such as Cloudflare R2
- Claude, Gemini, and OpenAI model-provider support
- DOC/DOCX/PDF document ingestion and viewing
- legal assistant chat, document drafting, document editing, and tabular review workflows

## Core feature surfaces

### 1. Assistant chat

Relevant files:

- `frontend/src/app/(pages)/assistant/page.tsx`
- `frontend/src/app/(pages)/assistant/chat/[id]/page.tsx`
- `backend/src/routes/chat.ts`
- `backend/src/lib/chatTools.ts`

Capabilities:

- Ask legal questions with document context.
- Enforce document citations through the assistant system prompt.
- Generate DOCX outputs using assistant tools.
- Edit existing DOCX documents with versioned outputs.
- Apply workflow prompts selected by the user.

Legal-process fit:

- contract Q&A
- clause explanation
- first-pass drafting
- negotiation mark-up support
- document summary generation

### 2. Projects / matters

Relevant files:

- `frontend/src/app/(pages)/projects/page.tsx`
- `frontend/src/app/(pages)/projects/[id]/page.tsx`
- `backend/src/routes/projects.ts`
- `backend/src/lib/access.ts`
- `backend/schema.sql`

Capabilities:

- Create project/matter workspaces.
- Track `cm_number` for client/matter-style identifiers.
- Add documents and folders.
- Share projects by email.
- Run project-scoped assistant chats.
- Run project-scoped tabular reviews.

Legal-process fit:

- matter workspace
- deal room / diligence room
- team review workspace
- project-level document organization

### 3. Document management and versioning

Relevant files:

- `backend/src/routes/documents.ts`
- `backend/src/lib/storage.ts`
- `backend/src/lib/documentVersions.ts`
- `backend/src/lib/docxTrackedChanges.ts`
- `frontend/src/app/components/shared/DocView.tsx`
- `frontend/src/app/components/shared/DocxView.tsx`

Capabilities:

- Upload PDF, DOCX, and DOC files.
- Convert DOC/DOCX to PDF where LibreOffice is available.
- Store originals and renditions in object storage.
- Track document versions.
- Accept/reject assistant-generated tracked edits.
- Download documents and ZIP bundles.

Legal-process fit:

- document intake
- review set management
- versioned mark-up
- generated-work-product archive

### 4. Tabular review

Relevant files:

- `frontend/src/app/(pages)/tabular-reviews/page.tsx`
- `frontend/src/app/(pages)/tabular-reviews/[id]/page.tsx`
- `frontend/src/app/components/tabular/*`
- `backend/src/routes/tabular.ts`
- `frontend/src/app/components/tabular/exportToExcel.ts`

Capabilities:

- Create structured review matrices across many documents.
- Define columns with legal extraction prompts.
- Generate cell answers with reasoning and citations.
- Chat over review results.
- Export to Excel.

Legal-process fit:

- contract due diligence
- disclosure-schedule review
- commercial agreement portfolio review
- e-discovery issue-tag review
- lease/employment/NDA review grids

### 5. Workflow templates

Relevant files:

- `frontend/src/app/components/workflows/builtinWorkflows.ts`
- `backend/src/lib/builtinWorkflows.ts`
- `backend/src/routes/workflows.ts`

Current built-ins include:

- Generate CP Checklist
- Credit Agreement Summary
- Shareholder Agreement Summary
- Change of Control Review
- Commercial Agreement Review
- Credit Agreement Review
- E-Discovery Review
- Supply Agreement Review
- SPA Review
- NDA Review
- Commercial Lease Review
- Limited Partnership Agreement Review
- Shareholder Agreement Review
- Employment Agreement Review

Legal-process fit:

- reusable legal playbooks
- firm-standard diligence checklists
- practice-area templates
- first-pass lawyer review accelerators

## Legal-process fit matrix

- Contract review: strong current fit
- Corporate/finance diligence: strong current fit
- CP checklist production: strong current fit
- Multi-document extraction: strong current fit
- Legal drafting/mark-up: promising, needs output validation
- Litigation/e-discovery: present but needs review workflow hardening
- Matter lifecycle management: partial, needs task/deadline/audit layer
- Court filing/deadline management: not currently a core feature
- Billing/timekeeping: not currently a core feature
- Enterprise legal compliance: needs hardening before real client use

## Priority flow to harden first

### Flow: Contract due diligence workspace

Why this flow first:

- It uses Mike's strongest existing pieces: projects, document upload, tabular review, citations, Excel export, assistant chat, and generated summaries/checklists.
- It maps directly to legal process value: turn a document set into a review matrix and follow-up work product.
- It avoids overextending into court filing, billing, or full matter management before core document-review trust is proven.

### Target user journey

1. Create a project with client/matter number.
2. Upload agreement set into folders.
3. Select a built-in workflow such as Commercial Agreement Review, Credit Agreement Review, NDA Review, or Change of Control Review.
4. Generate a tabular review across selected documents.
5. Inspect cited answers and source highlights.
6. Ask assistant follow-up questions about risky cells.
7. Export Excel review matrix.
8. Generate a summary or CP checklist DOCX where applicable.
9. Share project/review with another reviewer.
10. Preserve audit evidence of who generated/exported/shared what.

### Acceptance criteria for a usable pilot

- Upload and conversion works for representative PDF/DOCX legal documents.
- Review generation produces cited answers for every required column.
- Citation click-through highlights the cited text reliably.
- Excel export preserves document rows, review columns, answers, and reasoning/citation context.
- Shared project user can view the same review without cross-matter leakage.
- Delete flow removes database rows and storage objects for the test matter.
- No raw document text or secrets appear in logs.
- Model provider used for each generated answer is auditable.

## Recommended implementation phases

### Phase 1 — Trust and safety baseline

- Remove frontend service-role secret examples.
- Add access-control tests for projects, documents, downloads, tabular reviews, and workflow shares.
- Add expiring/revocable download tokens.
- Add deletion cleanup for project cascades and failed uploads.
- Add basic audit-event table for upload, download, share, delete, model-run, export, and document-generation events.

### Phase 2 — Diligence workflow polish

- Unify built-in workflow definitions into one source of truth.
- Add template versioning for workflow prompts.
- Add tabular-review generation status/progress and retry semantics.
- Add review-quality checks: missing citation, answer not found, conflicting answer, low confidence.
- Add one-click export bundle: Excel matrix plus generated summary DOCX.

### Phase 3 — Pilot operations

- Add CI gates for backend build, frontend build, frontend lint, tests, and audit checks.
- Add safe demo seed data and sample documents.
- Add operator docs for Supabase/R2 setup, model-provider data-use settings, retention, backup, and incident response.
- Run a small pilot with synthetic or public legal documents before any real client data.

## Non-goals for the first pilot

- Court deadline calendaring
- E-filing integrations
- Billing and timekeeping
- Full document-management-system replacement
- Firm-wide ethical wall management
- Production use with privileged/client-confidential documents before security hardening
