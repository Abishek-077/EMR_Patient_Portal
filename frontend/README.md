# Frontend Architecture

The React application lives in this folder so frontend concerns stay separate from the Express backend.

## Structure

- `app/` - application bootstrap and top-level auth/session shell.
- `portal/` - authenticated portal experience, route access rules, and portal-specific UI.
- `services/` - API client functions for backend HTTP endpoints.
- `domain/` - shared TypeScript models used across app, portal, and services.
- `styles/` - Carbon setup plus global and auth styles.

## Boundaries

- UI components should call backend APIs through `services/`, not raw `fetch`.
- Permission and routing decisions for the portal should live in `portal/access.ts`.
- Shared data contracts belong in `domain/types.ts`.
- Backend-specific logic stays under `backend/`; frontend modules should not import backend code.
