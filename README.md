# EMR Patient Portal

Full-stack OpenMRS O3-inspired patient portal built with React, Vite, TypeScript, Carbon React, IBM Plex Sans, Express, and a persistent JSON data store.

The frontend lives in `frontend/` and the API lives in `backend/`. Backend routes and services are organized by feature under `backend/src/features/<feature>/`, with shared middleware, validation, store, and domain helpers kept at `backend/src/`. The app intentionally keeps this stack; it does not use Next.js, Prisma, or SQLite.

## Setup

```bash
npm install
npm run dev
```

The dev app runs at `http://127.0.0.1:5173` and proxies API calls to `http://127.0.0.1:4000`.

Useful commands:

```bash
npm run dev:api
npm run dev:web
npm run build
npm run test:api
npm start
```

## Seed And Demo Data

Data is stored in `data/db.json`. Fresh installs are seeded from `backend/src/seed-data.js`.

The store normalization layer backfills newer fields at runtime, including providers, appointment slots, uploaded files, activity logs, proxy reports, resource interactions, and privacy flags. This keeps existing dirty local data usable without requiring manual edits to `data/db.json`.

The first registered account is bootstrapped as an administrator. Later signups become patient users until an admin changes their role from Settings > Configuration.

## Implemented Features

- Auth with bearer-token sessions and functional remember-me storage.
- Role-based protected routes and backend permission redaction.
- Dashboard, records, appointments, secure messages, prescriptions, billing, referrals, trends, immunizations, resources, family/proxy access, profile settings, and Settings-based admin configuration.
- Appointment scheduler with required service, department, provider, date, time, and reason.
- Records search/filter, patient note creation, lab narrative detail, printable record export, and upload metadata.
- Message replies, attachment metadata, and resolved/reopened state.
- Pharmacy changes, refill requests, medication requests, interaction check notice, and printable medication list.
- Billing payments, payment methods, statement print view, invoice print/download actions, and support workflow.
- Referral request, resend/contact/detail actions, export, and status updates.
- Family/proxy invite, resend, revoke, dependent add, privacy settings, access policy, and unauthorized access reporting.
- Resource search/filter/detail, save/read/download interactions, and local interaction logging.
- Profile save, insurance edit/upload metadata, and emergency contact create/update/delete.

## Local-Only Limitations

Exports use printable browser windows or JSON downloads; there is no server-side PDF generator.

Uploads store metadata only. No binary file is persisted.

Payments, drug interaction checks, sharing actions, and unauthorized-access reports are safe local mock workflows backed by the JSON store.

## API Overview

All protected routes use `Authorization: Bearer <token>`.

- Auth: `/api/auth/signup`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`
- Portal/dashboard: `/api/portal`, `/api/patient/dashboard`
- Admin access control: `/api/admin/access-control`, `/api/admin/access-control/roles/:roleId`, `/api/admin/users/:userId/access`
- Records: `/api/records`, `/api/records/notes`, `/api/records/labs/:labId`, `/api/records/documents/:documentId`, `/api/records/printable`
- Trends: `/api/trends`, `/api/trends/export`
- Appointments: `/api/appointments`, `/api/appointments/export`, `/api/appointments/:appointmentId`, `/api/appointments/requests`, `/api/appointments/:appointmentId/reschedule`, `/api/appointments/:appointmentId/cancel`
- Messages: `/api/messages`, `/api/messages/conversations`, `/api/messages/conversations/:conversationId`, `/api/messages/conversations/:conversationId/messages`, `/api/messages/conversations/:conversationId/resolve`
- Prescriptions: `/api/prescriptions`, `/api/prescriptions/printable`, `/api/prescriptions/interactions`, `/api/prescriptions/:prescriptionId/leaflet`, `/api/prescriptions/:prescriptionId/refills`, `/api/prescriptions/medication-requests`, `/api/prescriptions/preferred-pharmacy`
- Billing: `/api/billing`, `/api/billing/payments`, `/api/billing/payment-methods`, `/api/billing/payment-sessions`, `/api/billing/statements`, `/api/billing/statements/:statementId`, `/api/billing/invoices/:invoiceId`, `/api/billing/resources/:resourceId`
- Referrals: `/api/referrals`, `/api/referrals/:referralId`, `/api/referrals/:referralId/action`, `/api/referrals/export`
- Family: `/api/family`, `/api/family/proxies`, `/api/family/proxies/:proxyId`, `/api/family/proxies/:proxyId/resend`, `/api/family/dependents`, `/api/family/privacy`, `/api/family/reports`, `/api/family/policy`
- Immunizations: `/api/immunizations`, `/api/immunizations/printable`, `/api/immunizations/:recordId`
- Resources: `/api/resources`, `/api/resources/:resourceId`, `/api/resources/:resourceId/interactions`
- Files: `/api/files`
- Profile: `/api/profile`, `/api/profile/insurance`, `/api/profile/emergency-contacts`, `/api/profile/emergency-contacts/:contactId`

## Manual QA Checklist

- Register, login with and without remember me, logout, and verify protected redirects.
- Book, reschedule, and cancel an appointment.
- Send a message, attach metadata, and mark a thread resolved/reopened.
- Request a refill, request a medication, change preferred pharmacy, print the prescription list, and start a medication message.
- Pay an invoice/full balance, add a payment method, and print a statement.
- Edit profile, edit insurance, upload insurance metadata, and add/edit/delete emergency contacts.
- Invite, resend, revoke proxy access; add a dependent; update family privacy; report unauthorized access.
- Add a note, search/filter records, open a lab narrative, and print/export records.
- Request/update/export referrals.
- Search/filter resources and record save/read/download interactions.
- Download trends and immunization print views.
- Check mobile layout and main browser console flows.

## Verification

Current required checks:

```bash
npm run build
npm run test:api
```
