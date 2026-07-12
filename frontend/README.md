# Frontend

The React application uses feature-owned pages and API facades under `frontend/features`, shared contracts under `frontend/shared/types.ts`, and authenticated transports under `frontend/shared/api`.

## Data flow

- Authentication bootstraps from the HttpOnly cookie through `/api/auth/me`.
- CSRF and the selected `X-Patient-Context` are attached centrally.
- `/api/portal` provides only session/navigation/context bootstrap metadata.
- The portal hydrates dashboard, registration, appointments, messages, records, files, prescriptions, billing, referrals, trends, immunizations, resources, profile, and family data from dedicated feature endpoints.
- The query cache scopes keys by patient context, shares in-flight requests, cancels stale work, retries transient reads once, and invalidates affected feature/home/bootstrap keys after mutations.
- JSON, multipart upload, authenticated blob download, and PDF/CSV export transports are separate.
- A centralized 401 event clears client state and returns to login.

The authenticated portal bundle is lazy-loaded. Home, registration, billing, administration, layout, model, controller, API, and feature facade modules are split from the application/authentication shell.

## Conventions

- UI calls the API through `frontend/shared/api/api.ts` or a feature `api.ts` facade.
- Visible mutations provide pending, success, validation/error, and destructive-confirmation states.
- Permission checks use `frontend/features/access-control` and are still enforced independently by the server.
- Real files use `FormData`; downloads use authenticated blobs. Tokens are never appended to download URLs.
- Global stylesheet module declarations, including SCSS, live in `frontend/styles.d.ts`.

## Verify

```bash
npm run typecheck
npm run build
npm test
```
