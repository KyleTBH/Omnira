"""Provision a real account without placing its password in shell history."""
import argparse
import getpass
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from start import load_env
load_env()
os.chdir(ROOT / 'backend')
sys.path.insert(0, str(ROOT / 'backend'))
from app.db import connection, init_db
from app.platform_db import init_platform_db
from app.security import hash_password, migrate_passwords

parser = argparse.ArgumentParser()
parser.add_argument('--email', required=True)
parser.add_argument('--name', required=True)
parser.add_argument('--role', choices=['student', 'professor', 'admin'], default='student')
args = parser.parse_args()
email = args.email.strip().lower()
if '@' not in email or len(email) > 150 or not args.name.strip() or len(args.name) > 150:
    raise SystemExit('Enter a valid email and a name of 1 to 150 characters')
password = getpass.getpass('New account password (at least 10 characters): ')
if len(password) < 10 or password != getpass.getpass('Confirm password: '):
    raise SystemExit('Passwords must match and contain at least 10 characters')
init_db()
init_platform_db()
migrate_passwords()
with connection(write=True) as db:
    if db.execute('SELECT id FROM users WHERE email=?', (email,)).fetchone():
        raise SystemExit('That email already exists; no account was changed')
    created = db.execute('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)', (args.name.strip(), email, hash_password(password), args.role))
    db.execute('INSERT INTO sync_heads(user_id,revision) VALUES(?,0)', (created.lastrowid,))
print(f'Created {args.role} account for {email}')
