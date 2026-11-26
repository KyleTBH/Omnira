"""Create local Compose secrets without embedding credentials in the ZIP."""
from pathlib import Path
import os
import secrets

path = Path(__file__).resolve().parents[1] / '.env'
values = {'MYSQL_PASSWORD': secrets.token_hex(24), 'MYSQL_ROOT_PASSWORD': secrets.token_hex(24),
          'MINIO_ROOT_USER': 'omnira_dev', 'MINIO_ROOT_PASSWORD': secrets.token_hex(24)}
try:
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
except FileExistsError:
    raise SystemExit('.env already exists. It was left unchanged.')
with os.fdopen(fd, 'w') as handle:
    handle.write('\n'.join(f'{key}={value}' for key, value in values.items()) + '\n')
print('Created .env with random local-development passwords. Keep it private.')
