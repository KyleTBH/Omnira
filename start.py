"""Run the real browser frontend and API together, without Node or Electron."""
import argparse
from pathlib import Path
import os
import sys
import threading
import time
from urllib.request import urlopen
import webbrowser

ROOT = Path(__file__).resolve().parent


def load_env():
    path = ROOT / '.env'
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        if not raw.strip() or raw.lstrip().startswith('#'):
            continue
        key, separator, value = raw.partition('=')
        if separator:
            os.environ.setdefault(key.strip(), value.strip().strip('"\''))


def main():
    if sys.version_info < (3, 10):
        raise SystemExit('Python 3.10 or newer is required. On High Sierra, use the Python 3.12.10 installer.')
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    load_env()
    os.chdir(ROOT / 'backend')
    sys.path.insert(0, str(ROOT / 'backend'))
    try:
        import uvicorn
        from app.main import app
    except ImportError as error:
        raise SystemExit(f'Missing dependency: {error.name}\nActivate backend/.venv, then run: python -m pip install -r backend/requirements.txt (from the project root)')
    browser_host = '127.0.0.1' if args.host == '0.0.0.0' else args.host
    url = f'http://{browser_host}:{args.port}'
    def open_when_ready():
        for _ in range(150):
            try:
                with urlopen(url + '/health', timeout=1) as response:
                    if response.status == 200:
                        print(f'\nOmnira: {url}\nCloud workspace: {url}/cloud.html\nKeep this terminal open. Ctrl+C stops the app.\n', flush=True)
                        if not args.no_browser:
                            webbrowser.open(url)
                        return
            except Exception:
                time.sleep(.2)
    threading.Thread(target=open_when_ready, daemon=True).start()
    uvicorn.run(app, host=args.host, port=args.port)

if __name__ == '__main__':
    main()
