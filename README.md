# EMR Patient Portal

Full-stack OpenMRS O3-inspired patient portal built with React, Vite, Carbon, IBM Plex Sans, Express, and a persistent JSON data store.

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

## API

- `GET /api/health`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/portal`
- `PATCH /api/tasks/:taskId`
- `PATCH /api/preferences/share-records`
- `POST /api/appointments/requests`
- `POST /api/messages`

Data is stored in `data/db.json`. Passwords are stored as salted scrypt hashes and portal routes require a valid session token.

## Build

```bash
npm run build
```

Run the production server after building:

```bash
npm start
```
