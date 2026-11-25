# Omnira starter

Multi-file starter for the Omnira mobile, desktop, and shared backend demo.

## Folders

- `mobile/`: Flutter app (Dart). Flutter widgets provide mobile styling; CSS is used in the Electron desktop app.
- `desktop/`: Electron app with HTML, CSS, and JavaScript.
- `web/`: Student mobile design with the new pill navigation, plus the earlier multi-role prototype and desktop dashboard.
- `backend/`: FastAPI API. SQLite works out of the box for the demo; MySQL can be selected for shared deployment.
- `gateway/`: Go reverse proxy that can balance requests across multiple FastAPI instances.

## Run the backend

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API documentation is at `http://127.0.0.1:8000/docs`. Demo data is created on first launch. All accounts use password `demo123`:

- `student@omnira.test`
- `professor@omnira.test`
- `admin@omnira.test`

To use MySQL instead of the default local SQLite database, create an empty database and set `OMNIRA_MYSQL_URL` before starting the API, for example `mysql://user:password@127.0.0.1:3306/omnira`. SQLite is the local demo store; an offline sync queue between device SQLite and MySQL is not implemented yet.

## Run the desktop app

```powershell
cd desktop
npm install
npm start
```

## Run the mobile app

Install Flutter, then from `mobile/` run `flutter pub get` and `flutter run`. Android emulator uses `http://10.0.2.2:8000`; a physical phone needs the computer's LAN address. Set it with `--dart-define=API_BASE_URL=http://YOUR_IP:8000`.

## Run the browser preview

Keep the backend running. From `web/`, run `python -m http.server 5500 --bind 127.0.0.1`, then open `http://127.0.0.1:5500`. The new student home design is the default preview. The earlier multi-role prototype is at `/previous-mobile.html`, and the desktop-style dashboard is at `/functional.html`.

The Gabay AI tab uses a chat interface with on-device rule-based demo replies. Its menu shows previous conversations saved in this browser's local storage. A local language model has not been connected yet.

The Upload tab has an Omnira-styled file queue with drag and drop, a 4 MB per-file limit, and subject folders. Continue saves supported files locally in the browser using IndexedDB. These files do not sync to MySQL or feed Gabay AI yet.

## Run the gateway

Install Go, then from `gateway/` run `go run .`. It listens on port 8080 and forwards to `http://127.0.0.1:8000` by default. Multiple upstreams can be supplied using comma-separated `OMNIRA_UPSTREAMS`.

## Demo scope

Working API flows: login, role dashboards, computers, reservations, session billing, print requests, payments and receipts, maintenance records, academic overview, and a deterministic offline reviewer preview. This is a prototype: QR payment is a recorded demo payment, receipts are demo receipts, and the reviewer is a local text transformation rather than a language model. Authentication and storage need production hardening before use with real student or payment data.

## reCAPTCHA v2
The web preview shows a clearly labeled demo verification checkbox until keys are configured. For live verification, set the public site key in web/recaptcha-config.js and set OMNIRA_RECAPTCHA_SECRET_KEY in the FastAPI server environment. Register the deployment domain with Google. Never put the secret key in the web files. The backend verifies the response before login when the secret is configured.

