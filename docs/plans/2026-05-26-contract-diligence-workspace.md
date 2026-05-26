# Contract Due Diligence Workspace Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Harden Mike's strongest legal-process flow: upload a contract set, run a cited tabular review, export the matrix, generate follow-up work product, share it safely, and delete it cleanly.

**Architecture:** Keep the existing Next.js + Express + Supabase + object-storage architecture. Add trust/safety foundations first, then improve the diligence workflow without expanding into full matter management, filing, billing, or calendaring.

**Tech Stack:** TypeScript, Express, Next.js, Supabase Postgres/Auth, S3-compatible storage, Claude/Gemini/OpenAI model providers, XLSX/DOCX document generation.

---

## Scope

### In scope

- Contract due diligence workspace pilot.
- Synthetic or public legal documents only until P0/P1 hardening is complete.
- Security/readiness fixes needed to safely evaluate the flow.
- Tests and CI gates around legal-critical behavior.
- User journey from project creation to upload, tabular review, citation inspection, export, generated summary/CP checklist, sharing, and cleanup.

### Out of scope

- Court filing.
- Deadline calendaring.
- Billing and timekeeping.
- Firm-wide ethical walls.
- Production use with client-confidential or privileged documents before hardening.

## Target user journey

1. User creates a project with a client/matter number.
2. User uploads a contract bundle into folders.
3. User chooses a workflow such as Commercial Agreement Review, NDA Review, Credit Agreement Review, or Change of Control Review.
4. User generates a tabular review across selected documents.
5. User reviews cited answers and source highlights.
6. User asks follow-up questions about risky cells.
7. User exports the Excel matrix.
8. User generates a summary or CP checklist DOCX.
9. User shares the review with a collaborator.
10. User deletes the test matter and verifies database rows plus storage objects are gone.

## Phase 0: Baseline hygiene

### Task 1: Keep server-only secrets out of frontend examples

**Objective:** Prevent operators from placing Supabase service-role secrets in frontend env files.

**Files:**

- Modify: `frontend/.env.local.example`
- Verify: `README.md`
- Verify: `docs/safe-local-testing.md`

**Steps:**

1. Remove `SUPABASE_SECRET_KEY` from `frontend/.env.local.example`.
2. Confirm `README.md` tells users the service-role key belongs in `backend/.env`.
3. Confirm `docs/safe-local-testing.md` says service-role keys stay server-side.
4. Run:

```bash
git diff --check
npm run build --prefix backend
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=dummy-anon-key \
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001 \
  npm run build --prefix frontend
```

**Expected:** diff check passes; backend build passes; frontend build passes with safe dummy public env.

### Task 2: Add explicit env validation docs

**Objective:** Make deployment/build env requirements obvious.

**Files:**

- Modify: `README.md`
- Modify: `docs/safe-local-testing.md`

**Steps:**

1. Add a short table/list of frontend public env vars.
2. Add a short table/list of backend server-only env vars.
3. State that CI build checks may use dummy public Supabase values but runtime needs real project values.
4. Verify docs do not instruct users to place service-role or model-provider keys in frontend env files.

**Expected:** New docs distinguish public frontend env from backend secrets.

## Phase 1: Access-control and download trust

### Task 3: Add backend test framework

**Objective:** Create the minimum backend test harness for pure security helpers before route tests.

**Files:**

- Modify: `backend/package.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/src/lib/downloadTokens.test.ts`
- Create: `backend/src/lib/access.test.ts`

**Steps:**

1. Install Vitest as a dev dependency in `backend/`.
2. Add scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

3. Add first tests for `downloadTokens.ts`:
   - verifies a token created by `signDownload` can be read by `verifyDownload`
   - verifies tampered payload fails
   - verifies tampered signature fails
   - verifies missing `DOWNLOAD_SIGNING_SECRET` throws
4. Add first tests for access helpers with mocked DB responses.
5. Run:

```bash
npm test --prefix backend
npm run build --prefix backend
```

**Expected:** backend tests and build pass.

### Task 4: Make download tokens expiring and purpose-scoped

**Objective:** Reduce persistent-link risk while preserving current access re-checks.

**Files:**

- Modify: `backend/src/lib/downloadTokens.ts`
- Modify: `backend/src/routes/downloads.ts`
- Modify: tests from Task 3

**Steps:**

1. Add token payload fields:
   - `p`: storage path
   - `f`: filename
   - `exp`: expiry timestamp
   - `purpose`: `download`
2. Keep signature verification with timing-safe compare.
3. Reject expired tokens.
4. Keep current `ensureDocAccess` re-check in `downloads.ts`.
5. Add tests for valid, expired, wrong-purpose, tampered, and malformed tokens.
6. Run:

```bash
npm test --prefix backend
npm run build --prefix backend
```

**Expected:** expired/tampered tokens fail; valid tokens still download if current access is allowed.

### Task 5: Add object-storage cleanup for project delete

**Objective:** Ensure deleting a test matter removes document-version storage objects, not only database rows.

**Files:**

- Modify: `backend/src/routes/projects.ts`
- Test: backend route/service test file created in this phase

**Steps:**

1. Before deleting a project, query all child documents and document versions for `storage_path` and `pdf_storage_path`.
2. Deduplicate paths.
3. Call `deleteFile` for each path.
4. Continue deleting the project row only after cleanup attempts complete.
5. Log cleanup failures without document contents.
6. Return a structured response including deleted project id and storage object cleanup count.
7. Add tests with mocked Supabase and mocked storage deletion.
8. Run:

```bash
npm test --prefix backend
npm run build --prefix backend
```

**Expected:** deleting a project calls storage deletion for all unique child-version paths.

## Phase 2: Diligence workflow quality

### Task 6: Unify built-in workflow definitions

**Objective:** Prevent frontend/backend workflow drift.

**Files:**

- Create: `shared/workflows/builtinWorkflows.json` or `shared/workflows/builtinWorkflows.ts`
- Modify: `frontend/src/app/components/workflows/builtinWorkflows.ts`
- Modify: `backend/src/lib/builtinWorkflows.ts`
- Add tests where practical

**Steps:**

1. Extract common fields: id, title, description, practice area, type, prompt markdown, columns.
2. Import the shared source from both backend and frontend or add a generation step if direct import is not practical.
3. Add workflow version metadata.
4. Verify frontend workflow list and backend workflow endpoint use the same data.
5. Run frontend and backend builds.

**Expected:** a workflow added once appears consistently in both UI and backend execution paths.

### Task 7: Add review-quality flags to tabular cells

**Objective:** Help legal users identify weak or risky generated answers.

**Files:**

- Modify: `backend/src/routes/tabular.ts`
- Modify: tabular cell schema or response shape if needed
- Modify: `frontend/src/app/components/tabular/*`

**Steps:**

1. Define quality flags:
   - missing citation
   - answer not found
   - conflicting evidence
   - low confidence / model uncertainty
2. Derive flags from generation outputs without adding new LLM calls where possible.
3. Display flags in the cell UI.
4. Include flags in Excel export.
5. Add tests around flag derivation helpers.

**Expected:** reviewers can triage risky cells before relying on the review matrix.

### Task 8: Add audit events for legal-critical actions

**Objective:** Record who did what in the diligence workspace.

**Files:**

- Create migration/schema addition for `audit_events`
- Add backend helper: `backend/src/lib/audit.ts`
- Modify routes for upload, download, share, delete, tabular generation, export, generated document

**Steps:**

1. Add an `audit_events` table with: id, user_id, project_id, document_id, review_id, action, metadata, created_at.
2. Ensure metadata never includes raw document text or secrets.
3. Add helper `recordAuditEvent`.
4. Call it from legal-critical routes.
5. Add tests proving events are written and sensitive fields are omitted.

**Expected:** each pilot action has an auditable event trail.

## Phase 3: Pilot flow verification

### Task 9: Add a synthetic diligence smoke script

**Objective:** Make the pilot journey repeatable without real client data.

**Files:**

- Create: `backend/scripts/seed-synthetic-diligence.ts` or equivalent
- Create: `docs/synthetic-diligence-smoke.md`
- Optional: frontend Playwright smoke if browser automation is added

**Steps:**

1. Create or document a synthetic document set.
2. Create a project with a test matter number.
3. Upload test documents.
4. Create a tabular review from a built-in workflow.
5. Generate cells.
6. Export Excel.
7. Generate a summary/CP checklist if model keys are available.
8. Share with test user.
9. Delete project.
10. Verify storage cleanup.

**Expected:** a reviewer can run the same safe pilot repeatedly.

### Task 10: Add CI gates

**Objective:** Make reliability visible on every PR.

**Files:**

- Create: `.github/workflows/ci.yml`
- Modify: package scripts as needed

**Steps:**

1. Pin Node 20 or 22.
2. Install backend dependencies.
3. Run backend tests and build.
4. Install frontend dependencies.
5. Run frontend build with safe dummy public env.
6. Run frontend lint after the lint backlog is fixed or temporarily mark it as a known failing non-blocking job with explicit TODO.
7. Add npm audit reporting as non-blocking initially, then ratchet to blocking after dependency updates.

**Expected:** PRs show clear backend/frontend verification status.

## Phase 4: Pilot acceptance checklist

A contract diligence pilot is acceptable when all of these are true:

- Backend tests pass.
- Frontend build passes with documented build env.
- Frontend lint is either clean or has a written burn-down plan with owners.
- Download tokens expire and access is re-checked at download time.
- Project delete removes storage objects for all child documents and versions.
- Workflow templates have one canonical source.
- Tabular review outputs include citation/risk quality flags.
- Audit events exist for upload, download, share, delete, generation, and export.
- Synthetic smoke flow completes without real client data.
- Security review has no unresolved P0 findings.

## Verification commands

Run these before claiming readiness:

```bash
git diff --check
npm test --prefix backend
npm run build --prefix backend
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=dummy-anon-key \
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001 \
  npm run build --prefix frontend
npm run lint --prefix frontend
npm audit --prefix backend --audit-level=high
npm audit --prefix frontend --audit-level=high
```

Expected initial state:

- Backend build passes.
- Frontend build passes when dummy public env is supplied.
- Frontend lint currently fails and must be fixed or explicitly tracked.
- Audit currently reports vulnerabilities and must be remediated before client-data use.
