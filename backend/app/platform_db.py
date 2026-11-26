"""Additive schema for sessions, device sync, and private object metadata."""
from . import db as database


def init_platform_db():
    mysql = bool(database.MYSQL_URL)
    text = 'LONGTEXT' if mysql else 'TEXT'
    real = 'DOUBLE' if mysql else 'REAL'
    statements = [
        f'''CREATE TABLE IF NOT EXISTS auth_sessions (
            token_hash VARCHAR(64) PRIMARY KEY, user_id INTEGER NOT NULL,
            expires_at {real} NOT NULL, created_at {real} NOT NULL)''',
        '''CREATE TABLE IF NOT EXISTS sync_heads (
            user_id INTEGER PRIMARY KEY, revision BIGINT NOT NULL DEFAULT 0)''',
        f'''CREATE TABLE IF NOT EXISTS sync_records (
            user_id INTEGER NOT NULL, entity VARCHAR(16) NOT NULL,
            record_id VARCHAR(36) NOT NULL, body {text} NOT NULL,
            revision BIGINT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
            updated_at VARCHAR(40) NOT NULL,
            PRIMARY KEY(user_id,entity,record_id))''',
        f'''CREATE TABLE IF NOT EXISTS sync_operations (
            user_id INTEGER NOT NULL, operation_id VARCHAR(36) NOT NULL,
            fingerprint VARCHAR(64) NOT NULL, result {text} NOT NULL,
            PRIMARY KEY(user_id,operation_id))''',
        '''CREATE TABLE IF NOT EXISTS cloud_files (
            file_id VARCHAR(36) PRIMARY KEY, user_id INTEGER NOT NULL,
            folder_id VARCHAR(36), filename VARCHAR(255) NOT NULL,
            media_type VARCHAR(150) NOT NULL, size_bytes BIGINT NOT NULL,
            sha256 VARCHAR(64) NOT NULL, object_key VARCHAR(255) NOT NULL,
            storage_backend VARCHAR(16) NOT NULL,
            deleted INTEGER NOT NULL DEFAULT 0, created_at VARCHAR(40) NOT NULL)'''
    ]
    with database.connection() as db:
        for statement in statements:
            db.execute(statement)
        for table, index, columns in [
            ('sync_records', 'sync_owner_revision', 'user_id,revision'),
            ('cloud_files', 'cloud_owner_created', 'user_id,created_at'),
            ('auth_sessions', 'auth_expiry', 'expires_at'),
        ]:
            if mysql:
                found = db.execute(f'SHOW INDEX FROM {table} WHERE Key_name=?', (index,)).fetchone()
                if not found:
                    db.execute(f'CREATE INDEX {index} ON {table}({columns})')
            else:
                db.execute(f'CREATE INDEX IF NOT EXISTS {index} ON {table}({columns})')
        # Create the serialization rows at migration time, never in a racing
        # read-then-insert request. New account provisioning must do this too.
        for user in db.execute('SELECT id FROM users').fetchall():
            if mysql:
                db.execute('INSERT IGNORE INTO sync_heads(user_id,revision) VALUES(?,0)', (user['id'],))
            else:
                db.execute('INSERT OR IGNORE INTO sync_heads(user_id,revision) VALUES(?,0)', (user['id'],))


def lock_owner(db, user_id):
    suffix = ' FOR UPDATE' if database.MYSQL_URL else ''
    head = db.execute('SELECT revision FROM sync_heads WHERE user_id=?' + suffix, (user_id,)).fetchone()
    if head is None:
        raise RuntimeError('Account has not been provisioned with a sync head')
    return int(head['revision'])
