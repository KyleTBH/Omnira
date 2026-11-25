import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(os.getenv('OMNIRA_SQLITE_PATH', Path(__file__).resolve().parent.parent / 'omnira.db'))
MYSQL_URL = os.getenv('OMNIRA_MYSQL_URL', '')

SCHEMA = '''
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS computers (id INTEGER PRIMARY KEY, label TEXT NOT NULL, lab TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'available');
CREATE TABLE IF NOT EXISTS reservations (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, computer_id INTEGER NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'confirmed');
CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, computer_id INTEGER NOT NULL, started_at TEXT NOT NULL, ended_at TEXT, rate_per_hour REAL NOT NULL DEFAULT 30, amount REAL NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS print_jobs (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, filename TEXT NOT NULL, pages INTEGER NOT NULL, copies INTEGER NOT NULL, amount REAL NOT NULL, status TEXT NOT NULL DEFAULT 'pending');
CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, item_type TEXT NOT NULL, item_id INTEGER NOT NULL, amount REAL NOT NULL, method TEXT NOT NULL, paid_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS maintenance (id INTEGER PRIMARY KEY, computer_id INTEGER NOT NULL, note TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL);
'''

MYSQL_SCHEMA = [
 'CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(150) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, role VARCHAR(30) NOT NULL)',
 'CREATE TABLE IF NOT EXISTS computers (id INT AUTO_INCREMENT PRIMARY KEY, label VARCHAR(30) NOT NULL, lab VARCHAR(80) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT \'available\')',
 'CREATE TABLE IF NOT EXISTS reservations (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, computer_id INT NOT NULL, starts_at VARCHAR(40) NOT NULL, ends_at VARCHAR(40) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT \'confirmed\')',
 'CREATE TABLE IF NOT EXISTS sessions (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, computer_id INT NOT NULL, started_at VARCHAR(40) NOT NULL, ended_at VARCHAR(40), rate_per_hour DOUBLE NOT NULL DEFAULT 30, amount DOUBLE NOT NULL DEFAULT 0)',
 'CREATE TABLE IF NOT EXISTS print_jobs (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, filename VARCHAR(255) NOT NULL, pages INT NOT NULL, copies INT NOT NULL, amount DOUBLE NOT NULL, status VARCHAR(30) NOT NULL DEFAULT \'pending\')',
 'CREATE TABLE IF NOT EXISTS payments (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, item_type VARCHAR(30) NOT NULL, item_id INT NOT NULL, amount DOUBLE NOT NULL, method VARCHAR(30) NOT NULL, paid_at VARCHAR(40) NOT NULL)',
 'CREATE TABLE IF NOT EXISTS maintenance (id INT AUTO_INCREMENT PRIMARY KEY, computer_id INT NOT NULL, note TEXT NOT NULL, status VARCHAR(30) NOT NULL DEFAULT \'open\', created_at VARCHAR(40) NOT NULL)',
]

class CompatRow(dict):
    def __getitem__(self, key):
        if isinstance(key, int): return list(self.values())[key]
        return super().__getitem__(key)

class MysqlCursor:
    def __init__(self, cursor): self.cursor = cursor
    @property
    def lastrowid(self): return self.cursor.lastrowid
    def fetchone(self):
        value = self.cursor.fetchone()
        return CompatRow(value) if value else None
    def fetchall(self): return [CompatRow(value) for value in self.cursor.fetchall()]
    def __iter__(self): return iter(self.fetchall())

class MysqlConnection:
    def __init__(self, raw): self.raw = raw
    def execute(self, sql, params=()):
        cursor = self.raw.cursor()
        cursor.execute(sql.replace('?', '%s'), params)
        return MysqlCursor(cursor)
    def commit(self): self.raw.commit()
    def close(self): self.raw.close()

@contextmanager
def connection():
    if MYSQL_URL:
        import pymysql
        from urllib.parse import urlparse
        parsed = urlparse(MYSQL_URL)
        db = MysqlConnection(pymysql.connect(host=parsed.hostname, port=parsed.port or 3306, user=parsed.username, password=parsed.password, database=parsed.path.lstrip('/'), cursorclass=pymysql.cursors.DictCursor))
        try:
            yield db
            db.commit()
        finally:
            db.close()
        return
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    try:
        yield db
        db.commit()
    finally:
        db.close()

def init_db():
    with connection() as db:
        if MYSQL_URL:
            for statement in MYSQL_SCHEMA: db.execute(statement)
        else: db.executescript(SCHEMA)
        if db.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 0:
            db.executemany('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)', [
                ('Alex Student','student@omnira.test','demo123','student'),
                ('Prof. Reyes','professor@omnira.test','demo123','professor'),
                ('Campus Admin','admin@omnira.test','demo123','admin')])
        if db.execute('SELECT COUNT(*) FROM computers').fetchone()[0] == 0:
            db.executemany('INSERT INTO computers(label,lab,status) VALUES(?,?,?)', [
                (f'PC-{n:02d}', 'Lab A' if n <= 6 else 'Lab B', 'maintenance' if n == 4 else 'available') for n in range(1, 13)])
