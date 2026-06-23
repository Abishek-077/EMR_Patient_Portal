# EMR Patient Portal Backend

Node and Express API for the OpenMRS O3 patient portal prototype. The backend is intentionally split into route, service, middleware, validation, and store layers so the frontend can grow without turning the API into one large file.

## Run

```bash
npm run dev:api
```

The API starts on `http://127.0.0.1:4000`.

Use a custom JSON database file when testing or demoing:

```bash
EMR_DB_PATH=/tmp/emr-db.json npm run dev:api
```

## Auth Endpoints

### `POST /api/auth/signup`

Creates a patient account, stores the password as a salted scrypt hash, and returns a bearer token.

Request:

```json
{
  "fullName": "Sarah Mitchell",
  "email": "sarah@example.com",
  "dateOfBirth": "1985-05-12",
  "patientId": "100-234-567",
  "password": "Patient@Test1"
}
```

### `POST /api/auth/login`

Signs in by email or patient ID.

```json
{
  "usernameOrEmail": "sarah@example.com",
  "password": "Patient@Test1"
}
```

### `GET /api/auth/me`

Requires `Authorization: Bearer <token>` and returns the current public user.

### `POST /api/auth/logout`

Requires `Authorization: Bearer <token>` and revokes that session.

## Patient Dashboard

### `GET /api/patient/dashboard`

Requires a bearer token. Returns the dashboard-specific payload:

- patient identity and health ID
- overview counters
- quick actions
- latest lab results
- upcoming appointments
- recent activity
- vitals
- security/status metadata

## Access Control

All access-control routes require a bearer token with admin permissions. The first registered account is promoted to administrator when no admin exists; subsequent signups receive the patient/normal user role.

Default roles:

- Administrator
- Doctor
- Nurse / Care Coordinator
- Front Desk / Scheduler
- Billing Specialist
- Patient / Normal User
- Family Proxy / Caregiver

### `GET /api/admin/access-control`

Returns the permission catalog, configured role permissions, safe user access records, and recent audit events.

### `PATCH /api/admin/access-control/roles/:roleId`

Updates a role permission matrix. The administrator role always keeps the critical admin permissions needed to avoid access-control lockout.

```json
{
  "permissions": ["dashboard.view", "records.view", "messages.view"]
}
```

### `PATCH /api/admin/users/:userId/access`

Assigns one or more roles and updates account status. The API rejects changes that would remove the last active user with access-management permission.

```json
{
  "roles": ["doctor"],
  "status": "Active"
}
```

## Sprint 3 Messages API

All routes require `Authorization: Bearer <token>`.

- `GET /api/messages/conversations`
- `GET /api/messages/conversations/:conversationId`
- `POST /api/messages/conversations/:conversationId/messages`
- `PATCH /api/messages/conversations/:conversationId/resolve`
- `POST /api/messages`

Reply request:

```json
{
  "body": "Thanks, I will follow the updated care plan."
}
```

Resolve request:

```json
{
  "resolved": true
}
```

## Sprint 3 Appointments API

All routes require `Authorization: Bearer <token>`.

- `GET /api/appointments?status=upcoming`
- `GET /api/appointments?status=past`
- `GET /api/appointments?status=cancelled`
- `POST /api/appointments`
- `POST /api/appointments/requests`
- `PATCH /api/appointments/:appointmentId/reschedule`
- `PATCH /api/appointments/:appointmentId/cancel`

Schedule request:

```json
{
  "service": "Follow-up lab review",
  "clinician": "Dr. Sarah Jenkins",
  "date": "Dec 05, 2023",
  "time": "10:00 AM (Tuesday)",
  "department": "Cardiology",
  "location": "Main Clinic, Suite 402"
}
```

Reschedule request:

```json
{
  "date": "Dec 08, 2023",
  "time": "11:30 AM (Friday)",
  "notes": "Patient requested from portal"
}
```

## Sprint 4 Prescriptions API

All routes require `Authorization: Bearer <token>`.

- `GET /api/prescriptions`
- `POST /api/prescriptions/:prescriptionId/refills`
- `POST /api/prescriptions/medication-requests`
- `PATCH /api/prescriptions/preferred-pharmacy`

Preferred pharmacy update:

```json
{
  "name": "Main Pharmacy #100",
  "addressLine1": "45 Clinic Way",
  "addressLine2": "Boston, MA 02115",
  "phone": "(617) 555-0100",
  "hours": "Mon-Fri 8 AM - 8 PM"
}
```

## Sprint 4 Billing API

All routes require `Authorization: Bearer <token>`.

- `GET /api/billing`
- `POST /api/billing/payments`
- `POST /api/billing/payment-methods`
- `GET /api/billing/statements`
- `GET /api/billing/statements/:statementId`

Payment request:

```json
{
  "amount": 450,
  "invoiceId": "INV-2023-089",
  "paymentMethodId": "method-visa"
}
```

Include `invoiceId` to pay a specific invoice. Omit both `amount` and `invoiceId` to pay the full outstanding balance with the selected/default payment method.

## Sprint 4 Profile API

All routes require `Authorization: Bearer <token>`.

- `GET /api/profile`
- `PATCH /api/profile`
- `PATCH /api/profile/insurance`
- `POST /api/profile/emergency-contacts`
- `PATCH /api/profile/emergency-contacts/:contactId`
- `DELETE /api/profile/emergency-contacts/:contactId`

## Frontend Compatibility

`GET /api/portal` remains protected and returns the existing portal payload used by the React app. It strips private fields like `users`, `sessions`, `passwordHash`, and `passwordSalt`.

## Verification

```bash
npm run test:api
```

The smoke test uses a temporary JSON database and verifies auth, protected dashboard access, portal data privacy, invoice payment, full balance payment, profile updates, and logout.
