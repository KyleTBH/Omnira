"""Opaque, revocable bearer sessions shared by all FastAPI instances."""
import hashlib
import hmac
import os
import secrets
import time
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from . import db as database

router = APIRouter(prefix='/auth', tags=['authentication'])


def hash_password(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 310000).hex()
    return f'pbkdf2_sha256$310000${salt}${digest}'


def check_password(password, stored):
    if not stored.startswith('pbkdf2_sha256$'):
        return hmac.compare_digest(password, stored)
    try:
        _, rounds, salt, expected = stored.split('$')
        actual = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), int(rounds)).hex()
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def migrate_passwords():
    with database.connection(write=True) as db:
        for user in db.execute('SELECT id,password FROM users').fetchall():
            if not user['password'].startswith('pbkdf2_sha256$'):
                db.execute('UPDATE users SET password=? WHERE id=?', (hash_password(user['password']), user['id']))


def issue_session(user):
    token = secrets.token_urlsafe(32)
    created = time.time()
    expires = created + int(os.getenv('OMNIRA_SESSION_HOURS', '168')) * 3600
    with database.connection(write=True) as db:
        db.execute('DELETE FROM auth_sessions WHERE expires_at<?', (created,))
        db.execute('INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)',
                   (hashlib.sha256(token.encode()).hexdigest(), user['id'], expires, created))
    return {**user, 'token': token, 'expires_at': datetime.fromtimestamp(expires, timezone.utc).isoformat()}


def resolve_token(token):
    with database.connection() as db:
        user = db.execute('''SELECT u.id,u.name,u.email,u.role FROM auth_sessions s
                             JOIN users u ON u.id=s.user_id
                             WHERE s.token_hash=? AND s.expires_at>?''',
                          (hashlib.sha256(token.encode()).hexdigest(), time.time())).fetchone()
    return dict(user) if user else None


def current_user(request: Request):
    user = getattr(request.state, 'user', None)
    if not user:
        raise HTTPException(401, 'Sign in again to continue')
    return user


@router.get('/me')
def me(request: Request):
    return current_user(request)


@router.post('/logout')
def logout(request: Request):
    current_user(request)
    token = request.headers.get('authorization', '')[7:]
    with database.connection(write=True) as db:
        db.execute('DELETE FROM auth_sessions WHERE token_hash=?', (hashlib.sha256(token.encode()).hexdigest(),))
    return {'ok': True}
