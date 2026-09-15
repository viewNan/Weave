# Architecture

## Frontend module roles

- `app/`: Next.js routes, layouts, and dependency composition. It chooses an infrastructure implementation but contains no feature UI or data rules.
- `features/`: feature-scoped UI, services, repository contracts, and concrete infrastructure. The first migrated feature is `features/files`.
- `domain/`: framework-independent data models shared by features.
- `shared/`: future cross-feature components, hooks, utilities, and types. Do not move feature-specific code here merely to fill the directory.

`FilesWorkspace` receives documents as props. It does not know whether they come from mock data, local storage, or an HTTP API.

```text
app/files/page.tsx (composition)
        |
        v
files service -> DocumentRepository contract <- mock implementation
        |
        v
FilesWorkspace UI
```

When the cloud backend is ready, add an API-backed `DocumentRepository` under `features/files/infrastructure/` and change only the composition in `app/files/page.tsx`. The UI and `listDocuments` service remain unchanged.

## Backend module roles

The existing Python backend already follows the useful portion of this split:

- `app/api/`: HTTP routers
- `app/services/`: application operations
- `app/repositories/`: database access
- `app/models/`: API and data models
- `app/db/` and `app/ingestion/`: PostgreSQL and processing infrastructure

The current backend remains untouched in this preparation pass. Its PostgreSQL repository is a concrete local backend, not a Cloudflare implementation.

## Dependency direction

```text
app -> features -> domain
             -> repository contract <- infrastructure
```

Infrastructure must not import feature UI. A future Worker/D1 adapter belongs behind a repository contract; credentials and runtime configuration must stay inside that adapter or server-side composition, never in UI components.

## Deployment boundary

The deployable unit is `frontend/`. OpenNext turns the existing Next.js output
into a Cloudflare Worker using `frontend/wrangler.jsonc`; `backend/` remains a
separate local Python/PostgreSQL application and is not part of this Worker.

The Files feature continues to compose its mock repository. The separate Push
feature now owns its D1 binding and does not affect the Python/PostgreSQL backend.

## Push notification boundary

The Web Push feature uses Cloudflare D1 only for `push_subscriptions`; it does
not touch the existing Python/PostgreSQL backend. Its request direction is:

```text
Route Handler -> NotificationService -> PushSubscriptionRepository -> D1PushSubscriptionRepository
                           |
                           v
                      PushService -> Push provider
```

`NotificationService.send({ title, body, url?, type?, metadata? })` fans out to
every active subscription. Its target parameter reserves `userId` and `deviceId`
for future directed delivery; this phase rejects a directed request until those
fields exist in D1. Provider 404/410 responses delete stale subscriptions.

Only the D1 repository calls `prepare`; React components use the HTTP API and
browser Push APIs only. `VAPID_PRIVATE_KEY` and `INTERNAL_API_TOKEN` stay in
Cloudflare Secrets and never cross into client code. `POST /api/internal/notifications`
requires `Authorization: Bearer <INTERNAL_API_TOKEN>` and is intended for PC or
other trusted server-side callers.
