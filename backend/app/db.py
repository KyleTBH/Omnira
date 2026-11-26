import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(os.getenv('OMNIRA_SQLITE_PATH', Path(__file__).resolve().parent.parent / 'omnira.db'))
MYSQL_URL = os.getenv('OMNIRA_MYSQL_URL', '')

SCHEMA = '''
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL, course TEXT, department TEXT);
CREATE TABLE IF NOT EXISTS computers (id INTEGER PRIMARY KEY, label TEXT NOT NULL, lab TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'available');
CREATE TABLE IF NOT EXISTS reservations (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, computer_id INTEGER NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'confirmed');
CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, computer_id INTEGER NOT NULL, started_at TEXT NOT NULL, ended_at TEXT, rate_per_hour REAL NOT NULL DEFAULT 30, amount REAL NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS print_jobs (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, filename TEXT NOT NULL, pages INTEGER NOT NULL, copies INTEGER NOT NULL, amount REAL NOT NULL, status TEXT NOT NULL DEFAULT 'pending');
CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, item_type TEXT NOT NULL, item_id INTEGER NOT NULL, amount REAL NOT NULL, method TEXT NOT NULL, paid_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tuition_balances (student_id INTEGER PRIMARY KEY, amount_centavos INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tuition_payment_requests (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, amount_centavos INTEGER NOT NULL, method TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS maintenance (id INTEGER PRIMARY KEY, computer_id INTEGER NOT NULL, note TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS professor_classes (id INTEGER PRIMARY KEY, professor_id INTEGER NOT NULL, section_name TEXT NOT NULL, course TEXT NOT NULL, subject TEXT NOT NULL, day_of_week INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, meeting_url TEXT);
CREATE TABLE IF NOT EXISTS class_enrollments (class_id INTEGER NOT NULL, student_id INTEGER NOT NULL, PRIMARY KEY(class_id, student_id));
CREATE TABLE IF NOT EXISTS class_grades (class_id INTEGER NOT NULL, student_id INTEGER NOT NULL, score REAL NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(class_id, student_id));
'''

MYSQL_SCHEMA = [
 'CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(150) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, role VARCHAR(30) NOT NULL, course VARCHAR(150), department VARCHAR(150))',
 'CREATE TABLE IF NOT EXISTS computers (id INT AUTO_INCREMENT PRIMARY KEY, label VARCHAR(30) NOT NULL, lab VARCHAR(80) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT \'available\')',
 'CREATE TABLE IF NOT EXISTS reservations (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, computer_id INT NOT NULL, starts_at VARCHAR(40) NOT NULL, ends_at VARCHAR(40) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT \'confirmed\')',
 'CREATE TABLE IF NOT EXISTS sessions (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, computer_id INT NOT NULL, started_at VARCHAR(40) NOT NULL, ended_at VARCHAR(40), rate_per_hour DOUBLE NOT NULL DEFAULT 30, amount DOUBLE NOT NULL DEFAULT 0)',
 'CREATE TABLE IF NOT EXISTS print_jobs (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, filename VARCHAR(255) NOT NULL, pages INT NOT NULL, copies INT NOT NULL, amount DOUBLE NOT NULL, status VARCHAR(30) NOT NULL DEFAULT \'pending\')',
 'CREATE TABLE IF NOT EXISTS payments (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, item_type VARCHAR(30) NOT NULL, item_id INT NOT NULL, amount DOUBLE NOT NULL, method VARCHAR(30) NOT NULL, paid_at VARCHAR(40) NOT NULL)',
 'CREATE TABLE IF NOT EXISTS tuition_balances (student_id INT PRIMARY KEY, amount_centavos BIGINT NOT NULL DEFAULT 0, updated_at VARCHAR(40) NOT NULL)',
 'CREATE TABLE IF NOT EXISTS tuition_payment_requests (id INT AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL, amount_centavos BIGINT NOT NULL, method VARCHAR(30) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT \'pending\', created_at VARCHAR(40) NOT NULL)',
 'CREATE TABLE IF NOT EXISTS maintenance (id INT AUTO_INCREMENT PRIMARY KEY, computer_id INT NOT NULL, note TEXT NOT NULL, status VARCHAR(30) NOT NULL DEFAULT \'open\', created_at VARCHAR(40) NOT NULL)',
 'CREATE TABLE IF NOT EXISTS professor_classes (id INT AUTO_INCREMENT PRIMARY KEY, professor_id INT NOT NULL, section_name VARCHAR(150) NOT NULL, course VARCHAR(150) NOT NULL, subject VARCHAR(150) NOT NULL, day_of_week INT NOT NULL, start_time VARCHAR(5) NOT NULL, end_time VARCHAR(5) NOT NULL, meeting_url TEXT)',
 'CREATE TABLE IF NOT EXISTS class_enrollments (class_id INT NOT NULL, student_id INT NOT NULL, PRIMARY KEY(class_id, student_id))',
 'CREATE TABLE IF NOT EXISTS class_grades (class_id INT NOT NULL, student_id INT NOT NULL, score DOUBLE NOT NULL, updated_at VARCHAR(40) NOT NULL, PRIMARY KEY(class_id, student_id))',
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
    def executemany(self, sql, params):
        cursor = self.raw.cursor()
        cursor.executemany(sql.replace('?', '%s'), params)
        return MysqlCursor(cursor)
    def rollback(self): self.raw.rollback()
    def commit(self): self.raw.commit()
    def close(self): self.raw.close()

@contextmanager
def connection(write=False):
    if MYSQL_URL:
        import pymysql
        from urllib.parse import urlparse, unquote
        parsed = urlparse(MYSQL_URL)
        ssl = {'ca': os.environ['OMNIRA_MYSQL_SSL_CA'], 'check_hostname': True} if os.getenv('OMNIRA_MYSQL_SSL_CA') else None
        db = MysqlConnection(pymysql.connect(host=parsed.hostname, port=parsed.port or 3306, user=unquote(parsed.username or ''), password=unquote(parsed.password or ''), database=parsed.path.lstrip('/'), charset='utf8mb4', ssl=ssl, connect_timeout=10, cursorclass=pymysql.cursors.DictCursor))
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()
        return
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=30)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    if write: db.execute('BEGIN IMMEDIATE')
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def init_db():
    with connection() as db:
        if MYSQL_URL:
            for statement in MYSQL_SCHEMA: db.execute(statement)
            columns = {column['Field'] for column in db.execute('SHOW COLUMNS FROM users')}
            if 'course' not in columns: db.execute('ALTER TABLE users ADD COLUMN course VARCHAR(150)')
            if 'department' not in columns: db.execute('ALTER TABLE users ADD COLUMN department VARCHAR(150)')
            class_columns = {column['Field'] for column in db.execute('SHOW COLUMNS FROM professor_classes')}
            if 'meeting_url' not in class_columns: db.execute('ALTER TABLE professor_classes ADD COLUMN meeting_url TEXT')
        else: db.executescript(SCHEMA)
        if not MYSQL_URL:
            columns = {column['name'] for column in db.execute('PRAGMA table_info(users)')}
            if 'course' not in columns: db.execute('ALTER TABLE users ADD COLUMN course TEXT')
            if 'department' not in columns: db.execute('ALTER TABLE users ADD COLUMN department TEXT')
            class_columns = {column['name'] for column in db.execute('PRAGMA table_info(professor_classes)')}
            if 'meeting_url' not in class_columns: db.execute('ALTER TABLE professor_classes ADD COLUMN meeting_url TEXT')
        if db.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 0 and os.getenv('OMNIRA_SEED_DEMO', 'true').lower() == 'true':
            db.executemany('INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)', [
                ('Alex Student','student@omnira.test','demo123','student'),
                ('Prof. Reyes','professor@omnira.test','demo123','professor'),
                ('Campus Admin','admin@omnira.test','demo123','admin')])
        db.execute("UPDATE users SET course='BSIT' WHERE email='student@omnira.test' AND (course IS NULL OR course='')")
        db.execute("UPDATE users SET department='Computer Studies' WHERE email='professor@omnira.test' AND (department IS NULL OR department='')")
        if db.execute('SELECT COUNT(*) FROM computers').fetchone()[0] == 0:
            db.executemany('INSERT INTO computers(label,lab,status) VALUES(?,?,?)', [
                (f'PC-{n:02d}', 'Lab A' if n <= 6 else 'Lab B', 'maintenance' if n == 4 else 'available') for n in range(1, 13)])
        professor = db.execute("SELECT id FROM users WHERE email='professor@omnira.test'").fetchone()
        demo_student = db.execute("SELECT id FROM users WHERE email='student@omnira.test'").fetchone()
        if demo_student and os.getenv('OMNIRA_SEED_DEMO', 'true').lower() == 'true' and not db.execute('SELECT student_id FROM tuition_balances WHERE student_id=?', (demo_student['id'],)).fetchone():
            from datetime import datetime, timezone
            db.execute('INSERT INTO tuition_balances(student_id,amount_centavos,updated_at) VALUES(?,?,?)', (demo_student['id'],1250000,datetime.now(timezone.utc).isoformat()))
        if professor and demo_student and db.execute('SELECT COUNT(*) FROM professor_classes').fetchone()[0] == 0:
            db.executemany('INSERT INTO professor_classes(professor_id,section_name,course,subject,day_of_week,start_time,end_time) VALUES(?,?,?,?,?,?,?)', [
                (professor['id'],'BSIT 1A','BSIT','Computer Programming',1,'09:00','10:30'),
                (professor['id'],'BSIT 1A','BSIT','Data Structures',3,'10:30','12:00'),
                (professor['id'],'BSIT 2A','BSIT','Database Management',4,'13:00','14:30')])
            classes = db.execute('SELECT id,section_name FROM professor_classes WHERE professor_id=?',(professor['id'],))
            db.executemany('INSERT INTO class_enrollments(class_id,student_id) VALUES(?,?)', [
                (item['id'],demo_student['id']) for item in classes if item['section_name']=='BSIT 1A'])
