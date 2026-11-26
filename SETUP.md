# Setup

## 1. Your current High Sierra Mac: run the real web frontend and API

This mode is for developing the actual project without Node, Electron, Docker or Flutter tooling. It uses SQLite and private local file storage on the server. It does not claim to be a hosted MySQL/S3 deployment.

On macOS 10.13.6, the Python 3.12.10 universal2 installer supports your OS: https://www.python.org/downloads/release/python-31210/ . After installation, run `Install Certificates.command` from Applications / Python 3.12.

Open the extracted **project root** (the folder containing this file and `start.py`) in VS Code. Run:

```bash
python3.12 -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install -r backend/requirements.txt
python start.py
```

If you already created `backend/.venv`, activate it and install the updated requirements. Use one launcher; do not leave another API on port 8000. Stop an older server with Ctrl+C in its own terminal first, or use `python start.py --port 8002`.

Open `http://127.0.0.1:8000/` for the existing campus UI, `http://127.0.0.1:8000/cloud.html` for cloud files/notes/tasks, or `/docs` for the API. One terminal serves both the backend and browser files. Keep it running; use another terminal for commands. `Start-Omnira.command` uses an existing virtual environment if available.

Demo accounts (created on a fresh development database): `student@omnira.test`, `professor@omnira.test`, `admin@omnira.test`, password `demo123`. New sessions use tokens, so sign in again after upgrading. No browser-only offline authentication fallback is accepted by the server.

## 2. Full central stack: MySQL, two APIs, Go, private object storage

Use a modern Linux server, supported Windows/Linux workstation, or supported newer Mac with Docker and Docker Compose. Current Docker/Flutter tooling is not a High Sierra build target.

From the project root:

```bash
python3 tools/create_env.py
docker compose up -d --build --wait --wait-timeout 300
python3 tools/smoke_stack.py http://127.0.0.1:8080 --require-balancing
```

Open `http://127.0.0.1:8080/cloud.html`. The Go gateway forwards requests across `api-1` and `api-2`. Both share MySQL and the same private object bucket. A single migration job runs before either API starts. Readiness probes remove unavailable instances and restore recovered ones. Writes are never automatically replayed by the gateway.

MySQL and object bytes use named persistent volumes. `docker compose down` preserves them. `docker compose down -v` destroys them and is only for deliberately resetting a disposable development stack. The MinIO console is bound to `127.0.0.1:9001`; log in using the randomly generated values in `.env` on that machine. Do not commit `.env`.

Compose binds its browser/gateway port to loopback. For a phone or public deployment, put an HTTPS reverse proxy in front of the gateway and configure its firewall/address deliberately. Do not expose MySQL, API containers, or the object console publicly. Image tags in this development compose file should be locked to reviewed digests for a production release.

## 3. Hosted MySQL and actual cloud storage

Create an empty MySQL database and a private bucket with your provider. The server needs these environment variables (the `.env` at the project root is read by `start.py`):

```dotenv
OMNIRA_MYSQL_URL=mysql://USER:PERCENT_ENCODED_PASSWORD@MYSQL_HOST:3306/omnira
OMNIRA_MYSQL_SSL_CA=/absolute/path/to/provider-ca.pem
OMNIRA_STORAGE_BACKEND=s3
OMNIRA_S3_BUCKET=your-private-bucket
OMNIRA_S3_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your-server-side-access-key
AWS_SECRET_ACCESS_KEY=your-server-side-secret-key
OMNIRA_CORS_ORIGINS=https://your-app.example
OMNIRA_SEED_DEMO=false
```

For S3-compatible providers, also set `OMNIRA_S3_ENDPOINT=https://YOUR_ENDPOINT` and, if required, `OMNIRA_S3_ADDRESSING_STYLE=path`. AWS S3 can omit the endpoint and use an instance/task role instead of static keys. Credentials belong only on the API server. The S3 adapter never applies a public object ACL. Keep the bucket's public-access block enabled. Scope the storage identity to the chosen bucket and `users/` prefix; `deploy/s3-policy.example.json` is a starting policy, not a configured account.

An existing SQLite database is not automatically copied into a remote MySQL database; remote deployment initializes the schema in the selected database. Back up data and perform an explicit data migration before switching a live deployment. Likewise, changing a bucket/path/provider does not move existing objects; keep metadata and bytes together.

After setting the real environment, initialize and provision an account:

```bash
python tools/create_user.py --email you@university.edu --name "Your Name" --role admin
python start.py --host 0.0.0.0 --no-browser
```

The account command prompts for a password and creates its synchronization identity in the same transaction. `OMNIRA_SEED_DEMO=false` prevents demonstration users in an empty database; it does not delete existing accounts. Use a fresh production database. Store backup copies of MySQL and objects, and use HTTPS. Storage supports arbitrary private files as attachments; malware scanning is not included.

If launching Uvicorn directly instead of `start.py`, export variables through your process manager; Uvicorn does not automatically read this root `.env`. In the full container stack, run migrations once (`python -m app.migrate`) before API replicas, then set `OMNIRA_SKIP_INIT=true` for those replicas. Do not skip initialization in a single local instance unless the schema is already ready.

## 4. Flutter mobile and Flutter desktop

Use a supported Flutter build machine. This project targets Dart >=3.6, and CI is configured for Flutter 3.29.3. Modern Flutter desktop cannot be built or run on your macOS 10.13.6 system; use a supported newer Mac, Windows, or Linux machine. Current platform requirements are at https://docs.flutter.dev/platform-integration/desktop and https://docs.flutter.dev/platform-integration/macos/setup .

The attached starter did not contain generated Android/iOS/desktop runners. Generate them from the installed Flutter SDK while preserving the app code:

```bash
python3 tools/bootstrap_flutter.py
```

The script creates `mobile/android`, `mobile/ios`, `desktop/macos`, `desktop/windows` and `desktop/linux`, configures local-debug Android Internet access and macOS network/file/keychain entitlements, and fetches dependencies. App logic lives in `packages/omnira_app`; edit it there once for both clients.

Run a desktop target on its matching OS:

```bash
cd desktop
flutter run -d macos --dart-define=API_BASE_URL=http://127.0.0.1:8080
```

Use `-d windows` or `-d linux` on the matching host. For the Python-only local server, set port `8000` instead. On Linux, install `libsecret-1-dev`, `libjsoncpp-dev`, `libsqlite3-dev` and the Flutter Linux toolchain. A working desktop keyring is needed for secure session storage. For Windows release packaging, verify that `sqlite3.dll` is shipped alongside the executable; the chosen FFI package's release packaging requirements are linked below.

Run Android with the emulator's host alias:

```bash
cd mobile
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8080
```

Physical devices need an HTTPS server/LAN URL they can reach; `localhost` on a phone refers to that phone. iOS and macOS builds need Xcode and signing setup on a supported Mac. For iOS, use an HTTPS API; arbitrary HTTP access is not enabled in release configuration. Android cleartext access is enabled only in the generated debug manifest for local testing. Production builds must use an HTTPS `API_BASE_URL`.

First sign-in requires a network connection. After that, the app stores the session in native secure storage and can restore cached data offline. Workspace edits and copied file bytes persist across app restarts. Background sync runs while the app is open; OS background services after terminating the app are not implemented. An expired/revoked token pauses sync and asks the user to sign in again; unsynced SQLite data remains on that device. Login to the same server/account resumes it.

SQLite package references: https://pub.dev/packages/sqflite and https://pub.dev/packages/sqflite_common_ffi/versions/2.3.4+4 .

## Login

Enter an account email and password manually in the web or Flutter login form. The demo account shortcuts and reCAPTCHA control have been removed. Configure real accounts and appropriate login abuse protection before public deployment.
