# Backend

The Express API is organized by feature under `src/features`, composed in `src/api/routes.js`, and backed by transactional SQLite repositories in `src/store.js`.

## Run

```bash
npm run dev:api
```

Defaults:

- API: `http://127.0.0.1:4000/api`
- Health: `GET /api/health`
- SQLite: `data/emr.sqlite`
- Uploads: `data/uploads`

All values are configurable through `.env.example`. Node 22.13+ is required.

## Authentication

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/password/change`
- `POST /api/auth/password-reset/request`
- `POST /api/auth/password-reset/confirm`

Login and signup set an HttpOnly cookie and also return a bearer token for development/API clients. `/auth/me` returns the public actor, effective permissions, session expiry, CSRF token, accessible patient contexts, and selected context. Cookie-authenticated mutations require `X-CSRF-Token`; all patient feature calls may use `X-Patient-Context`.

## Feature APIs

- Bootstrap/home: `/api/portal`, `/api/patient/home`, `/api/patient/dashboard`, `/api/notifications`, `/api/support`
- Registration/profile: `/api/registration`, `/api/profile`
- Appointments: `/api/appointments`, `/api/appointments/requests`, `/api/appointments/requests/:id/decision`
- Messages: `/api/messages`, `/api/messages/conversations`
- Records/files: `/api/records`, `/api/files`
- Prescriptions: `/api/prescriptions`, refill and medication decision endpoints
- Billing: `/api/billing`, invoices, payment methods, payments, statements
- Trends: `/api/trends`
- Immunizations: `/api/immunizations`, `/api/immunizations/:id/verification`
- Resources: `/api/resources`
- Administration: `/api/admin/access-control`, `/api/admin/users`

Export endpoints accept `format=json|pdf|csv` where applicable. File endpoints require multipart binary content and downloads stream from authenticated routes; tokens are never placed in file URLs.

## Persistence model

SQLite migrations create indexed users, hashed sessions, patient profiles, generic queryable domain rows, access control, and append-only audit events. Domain rows expose ownership, status, dates, relationships, version, provenance, verification, and deletion columns while retaining JSON detail for flexible clinical data.

`app_state` stores global configuration only. Users, sessions, profiles, feature collections, access grants, reset-token hashes, notification outbox records, and audit events are hydrated from relational tables.

The local provider interfaces are selected in `src/providers`:

- clinical slot gateway
- idempotent sandbox payment gateway
- notification outbox gateway
- informational drug-interaction gateway
- local file store

## Tests

```bash
npm run test:unit
npm run test:api
npm run test:security
npm run test:migration
```

`npm test` runs all checks plus the frontend production build. Test databases and uploads use temporary directories.
