# EMR Patient Portal

Full-stack OpenMRS O3-inspired patient portal built with React, Vite, Carbon, IBM Plex Sans, Express, and a persistent JSON data store. The API lives in `backend/`.

## Run

```bash
npm install
npm run dev
```

On this Windows machine, PowerShell may block `npm.ps1`; use:

```bash
cmd /c npm run dev
```

The local app runs at `http://127.0.0.1:5173` and proxies API calls to `http://127.0.0.1:4000`.

Run only the backend API:

```bash
cmd /c npm run dev:api
```

## API

- `GET /api/health`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/patient/dashboard`
- `GET /api/portal`
- `GET /api/messages/conversations`
- `GET /api/messages/conversations/:conversationId`
- `POST /api/messages/conversations/:conversationId/messages`
- `PATCH /api/messages/conversations/:conversationId/resolve`
- `GET /api/appointments?status=upcoming`
- `POST /api/appointments`
- `PATCH /api/appointments/:appointmentId/reschedule`
- `PATCH /api/appointments/:appointmentId/cancel`
- `GET /api/prescriptions`
- `PATCH /api/tasks/:taskId`
- `PATCH /api/preferences/share-records`
- `POST /api/appointments/requests`
- `POST /api/messages`
- `POST /api/prescriptions/:prescriptionId/refills`
- `POST /api/prescriptions/medication-requests`
- `PATCH /api/prescriptions/preferred-pharmacy`
- `GET /api/billing`
- `POST /api/billing/payment-methods`
- `GET /api/billing/statements`
- `GET /api/profile`
- `PATCH /api/profile/insurance`
- `POST /api/profile/emergency-contacts`
- `PATCH /api/profile/emergency-contacts/:contactId`
- `DELETE /api/profile/emergency-contacts/:contactId`
- `POST /api/medications/requests`
- `POST /api/billing/payments`
- `PATCH /api/profile`

Data is stored in `data/db.json`. Passwords are stored as salted scrypt hashes and portal routes require a valid session token.

Backend details and request/response examples live in `backend/README.md`.

Run the backend smoke test:

```bash
cmd /c npm run test:api
```

## Build

```bash
npm run build
```

Run the production server after building:

```bash
npm start
```
