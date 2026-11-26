# Verification for this delivery

## Executed successfully

- 27 Python unittest cases against the FastAPI app and real isolated SQLite databases/files: credential hashing, forged identity rejection, token revocation/expiry, CORS errors, account isolation, idempotency, conflict handling, tombstones, pagination, concurrent revision allocation, upload/download/delete, quotas, folder ownership, file cleanup retries, migrations and rollback.
- Actual HTTP smoke test using a Uvicorn subprocess, a temporary database and private filesystem objects: login, sync push/pull, repeated operations, actual multipart uploads, byte-for-byte downloads, deletion and logout.
- Migration against a copy of the uploaded SQLite database preserves existing user, class and grade row counts.
- The one-command `start.py` launcher passes the same live HTTP smoke flow with an isolated database/filesystem.
- JavaScript syntax checks for the modified browser transport, campus scripts and cloud workspace.
- Python compilation checks and YAML/JSON parsing for the shipped configuration.
- S3 adapter behavior is unit-tested with an injected fake provider client. This checks API calls and private-object behavior; it is not evidence of a live cloud deployment.

## Included but not executed here

- Flutter SQLite tests (7 cases) cover restart persistence, preserving newer edits, tombstones/cursors, conflict resolution, and persisted file queues. Flutter/Dart SDKs are not installed in the build workspace, so native compilation, analyzer and device interaction remain unverified.
- Go tests cover round robin, failed-health filtering, recovery, no write replay, and URL validation. A Go compiler is not installed in the build workspace (the unrelated `/usr/bin/go` program is not the Go toolchain), so those tests were not run here.
- Docker Compose provisions MySQL, MinIO, two API replicas, migration/init jobs and the Go gateway. Docker and a MySQL server are not available in the build workspace, so the full MySQL/S3/load-balancer integration still needs the included Compose smoke test on a suitable machine.
- No external bucket, provider account or paid cloud resource was created, and no real cloud credentials were supplied.

`.github/workflows/verify.yml` automates these checks in environments with the required tools. Run that workflow and review its results before treating the Flutter build or full deployment as validated.

## Manual device acceptance test

1. Launch the full stack and run the smoke test with `--require-balancing`.
2. Generate Flutter runners; run native tests/analyzer, then launch two clients using the same API URL and account.
3. Create a folder/note/task on client A. Confirm they arrive on client B.
4. Disconnect A. Edit the note, add a file, close and reopen the app. Confirm drafts and upload bytes remain available.
5. Reconnect A and verify its pending work reaches the server and B.
6. Edit the same note on both disconnected clients. Reconnect each and verify a visible conflict with both versions; try both resolution choices.
7. Delete a record/file on one client; confirm deletion on the other and verify replayed older operations cannot revive it silently.
8. Sign into a second account and confirm the first account's files/drafts are absent. A forged `X-User-Id` header must fail without a valid token and cannot switch a valid token's account.
9. Stop one API instance and confirm the gateway keeps serving from the other; restart it and confirm recovery.
10. Restart the Compose services without removing volumes and confirm central records and file bytes persist. Test provider/quota failures and an expired token before using real data.
