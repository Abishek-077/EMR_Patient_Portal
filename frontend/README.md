# Frontend Architecture

The React application follows a feature-based architecture. Product areas own their UI and feature rules, while cross-feature contracts and infrastructure live in `shared/`.

## Structure

- `app/` - application composition root and React bootstrap.
- `features/auth/` - login, signup, logout, and session gate behavior.
- `features/portal/` - authenticated patient portal shell and portal screens.
- `features/access-control/` - frontend route and permission rules for RBAC.
- `shared/api/` - backend HTTP client functions used by features.
- `shared/types.ts` - shared TypeScript contracts for API/domain data.
- `shared/styles/` - Carbon setup plus global and auth styles.

## Feature Rules

- New product capabilities should start under `features/<feature-name>/`.
- Feature modules may import from `shared/` and other feature public entry files such as `features/auth/index.ts`, but should not reach into backend code.
- Shared modules must stay generic; feature-specific state, permission decisions, and UI belong inside the owning feature.
- UI should call backend endpoints through `shared/api/`, not raw `fetch`.
- Portal permission and route decisions belong in `features/access-control/`.
