# EMR Patient Portal

Full-stack patient portal built with React, TypeScript, Vite, Carbon, Express, and SQLite. The API is authoritative for every visible workflow: successful changes persist across reloads, patient data is scoped to an internal patient UUID, and clinical/billing approvals remain staff-controlled.

This repository uses local sandbox adapters for payments, notifications, clinical slot validation, drug-interaction screening, and file storage. It does not claim HIPAA compliance and must not be used with real patient data without an organizational security, privacy, and compliance review.

## Requirements and setup

- Node.js 22.13 or newer
- npm

```bash
cp .env.example .env
npm install
npm run seed:demo
npm run dev
```

The frontend runs at `http://127.0.0.1:5173`; Vite proxies `/api` to the Express API at `http://127.0.0.1:4000`. The canonical health check is `GET /api/health`.

Useful commands:

```bash
npm run dev
npm run build
npm test
npm run seed:demo
npm run reset:demo
npm run migrate:legacy
npm run seed:admin
```

`seed:demo` is development-only and creates representative patient, clinician, proxy, and administrator users. Public signup creates an empty patient account and never clones clinical or billing records.

## Persistence and legacy migration

Runtime data is stored in `data/emr.sqlite`; uploaded binaries are stored beneath `data/uploads`. Both are ignored by Git.

The one-time importer reads `data/db.json` (or `LEGACY_DB_PATH`), creates a timestamped JSON backup, assigns patient records only when ownership is unambiguous, imports durable data into SQLite, and revokes every legacy session:

```bash
npm run migrate:legacy
```

Ambiguous patient ownership, duplicate emails, duplicate MRNs, and malformed user identities stop migration instead of guessing.

## Security and data flow

- Passwords use salted scrypt hashes. Only SHA-256 session-token hashes are stored.
- Browser authentication uses an HttpOnly cookie bootstrapped through `/api/auth/me`; bearer tokens remain available for development/API clients.
- Cookie mutations require the session-bound `X-CSRF-Token` returned by `/api/auth/me`.
- `X-Patient-Context` selects a verified self, accepted proxy, or staff-authorized patient context.
- Patient ownership uses a canonical internal UUID independent of optional MRN.
- Permissions separate reads, patient requests, record/file management, clinician verification, billing management, and administration.
- `/api/portal` contains bootstrap metadata only. Feature pages load dedicated endpoints through a patient-scoped query cache.
- API errors use `{ code, message, status, fieldErrors?, requestId }`.
- Audit events are append-only in SQLite; soft-deleted domain records remain queryable for audit purposes.

## Implemented workflows

- Cookie login/bootstrap/logout, Remember Me, password change/reset, temporary-password enforcement, session revocation, support, privacy/legal, and Not Found routes.
- Registration/profile synchronization, versioned consent signatures, staff-controlled insurance verification, contacts, and real insurance-card uploads.
- Transactional appointment requests, future provider slots, staff approval/rejection, exact-once appointment creation, reschedule/cancel transitions, filters, pagination, and CSV export.
- Conversation list/detail, replies, read/resolve/archive behavior, care-team threads, and authenticated binary attachments.
- Patient note CRUD, record search, lab/document detail, provenance labels, multipart file upload/rename/download/delete, and PDF/CSV record exports.
- Refill and medication requests with cancellation plus staff decisions; medication leaflets and explicitly informational local interaction checks.
- Patient-scoped invoices, tokenized sandbox methods, partial payments, idempotent charges, balance recalculation, statement generation, and PDF/CSV downloads.
- Referral request/cancel and explicit staff state transitions with history.
- Trend range filtering, reading/goal CRUD, recalculated summaries, and zero-percent goals.
- Patient-reported versus verified immunizations, verification decisions, alerts, compliance recalculation, and official PDF exports.
- Resource search/filter/pagination, persisted save/unsave/read activity, content rendering, and actual downloads.
- Expiring proxy invitations delivered to a local outbox, acceptance/revocation, dependent CRUD, patient-context switching, and access-report review.
- Role/user administration, one-time temporary passwords, permission refresh, staff feature queues, notifications, and audit history.

## Verification

```bash
npm test
npm audit --omit=dev --audit-level=critical
```

The required test command runs formatting and syntax checks, frontend type checking, backend unit tests, production build, API workflow coverage, authorization/data-isolation regression coverage, and legacy migration tests.
The production dependency audit reports all advisories and fails CI for critical findings; high-severity React Router server-component advisories are reviewed separately because this deployment uses only the client-side `BrowserRouter`.

The security suite specifically covers two-patient isolation across portal bootstrap, records, printable exports, billing, files, guessed IDs, empty MRNs, proxy contexts, cookie/CSRF behavior, password reset, suspension, logout, and session hashing.

## Configuration

See `.env.example` for host/port, API root, allowed origins, cookie policy, session durations, SQLite/upload paths, provider modes, and split-host frontend settings. `SESSION_SECRET` is mandatory in production. Local provider adapters are deliberately labeled and do not connect to a real FHIR/OpenMRS server, payment processor, SMTP service, or cloud file store.
