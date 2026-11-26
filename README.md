# Omnira: connected campus, mobile and desktop

The uploaded campus application now has a shared Flutter client, durable SQLite offline workspace, FastAPI authentication/sync/file APIs, a MySQL deployment, a health-aware Go load balancer, and private S3-compatible file storage.

Start with **[SETUP.md](SETUP.md)**. On a configured Python environment, run `python start.py` from this folder to serve the real browser frontend and backend together at `http://127.0.0.1:8000`. Open `/cloud.html` for the cloud workspace. Node is not needed for this mode.

| Requested layer | Implementation | Location |
| --- | --- | --- |
| Mobile frontend | Flutter / Dart entrypoint | `mobile/` |
| Desktop frontend | Flutter / Dart entrypoint | `desktop/` |
| Shared app | Role dashboards, responsive navigation, cloud workspace | `packages/omnira_app/` |
| Device database | Real SQLite; isolated by server/account | Shared app `services/local_store.dart` |
| Offline synchronization | Persistent outbox, optimistic versions, tombstones, explicit conflict resolution | Shared app `services/api.dart`; backend `app/sync.py` |
| Load balancer | Go reverse proxy with readiness probes, round robin, recovery, graceful shutdown | `gateway/` |
| Backend API | FastAPI, bearer sessions, hashed passwords, ownership checks | `backend/app/` |
| Central database | MySQL 8.4 in the full deployment; SQLite only for local Python development | `compose.yaml`, `backend/app/db.py` |
| Cloud file storage | Private S3-compatible objects; server-side credentials; MinIO in the local full stack | `backend/app/cloud.py`, `app/object_storage.py` |
| Browser compatibility client | Existing campus UI plus an online cloud management workspace | `web/` |
| Earlier Electron client | Preserved for reference, no longer the desktop entrypoint | `legacy/desktop-electron/` |

## What works offline

After the first online sign-in, native Flutter apps can restore the saved account session and read previously cached campus data. Notes, tasks, folders, queued uploads and deletions are written to SQLite. Upload bytes are copied into the app's persistent private directory, so a source file can disappear without losing the queue. Changes sync on launch, app resume, manual sync and every 15 seconds while the app is running. The UI reports pending, blocked and conflicting work; a failed network request does not become a successful sync.

Records use stable UUIDs, per-account server revisions, idempotent operation IDs and deletion tombstones. A newer local edit is preserved when an older in-flight request is acknowledged. If another device changed the same record, both versions remain available until the user chooses one. Tombstones and successful operation receipts are retained; do not prune them without a device-cursor retention policy.

Campus bookings, grades, payments and session billing still require server validation; these are not optimistically confirmed offline. The browser's existing professor grade queue remains its own feature. The new browser cloud console requires connectivity; native SQLite synchronization is not simulated with browser local storage. Earlier browser-only folders/uploads/planner data remain on their original device; upload/copy them into the new cloud workspace when needed.

## Cloud files and database are different

MySQL stores users, server sessions, campus data, synchronization records and file metadata. File bytes live in a private S3-compatible object store. Clients use authenticated API uploads/downloads and never receive storage credentials. The development filesystem adapter writes real files to disk, but is not an Internet cloud account. Select S3 mode and configure a private bucket to use cloud storage. No paid account or cloud resource has been provisioned by this code delivery.

File uploads are bounded (10 MiB by default), per-account quota is 100 MiB by default, upload retries reuse a stable file ID, downloads are attachment-only with SHA-256 checks, and delete retries perform storage cleanup after access is revoked. Set `OMNIRA_MAX_FILE_BYTES` and `OMNIRA_USER_QUOTA_BYTES` on the backend to tune limits; the native picker and Go request limit must be raised together if increasing the file limit.

## Existing campus features

The original API and Flutter role pages are retained: computer availability, reservations, lab sessions/billing, printing, demo QR payments/receipts, maintenance, analytics and rule-based reviewer generation. The newer browser professor classes/grades/meeting links and student/admin screens are retained. These remain prototype campus flows: payment is a demo record, and Gabay AI is not connected to a language model or to uploaded files.

## Run checks

```bash
python -m pip install -r backend/requirements.txt httpx
python -m unittest discover -s backend/tests -v
```

```bash
cd gateway
go test -race ./...
```

```bash
cd packages/omnira_app
flutter pub get
flutter test
flutter analyze --no-fatal-infos
```

After starting the local Python server:

```bash
python tools/smoke_stack.py http://127.0.0.1:8000
```

After starting the full Compose stack:

```bash
python tools/smoke_stack.py http://127.0.0.1:8080 --require-balancing
```

See [VERIFICATION.md](VERIFICATION.md) for what was actually executed in this delivery, and [ARCHITECTURE.md](ARCHITECTURE.md) for synchronization and deployment details. CI includes backend, Go, native SQLite, Linux Flutter build and full MySQL/MinIO/gateway jobs; merely including a workflow does not mean those jobs have already passed.
