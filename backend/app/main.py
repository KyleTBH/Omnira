from datetime import datetime, timezone
from math import ceil
import os
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json
from typing import Literal
from urllib.parse import urlparse

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .db import connection, init_db

app = FastAPI(title='Omnira Demo API', version='0.1.0')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

@app.on_event('startup')
def startup(): init_db()

def now(): return datetime.now(timezone.utc).isoformat()
def row(value): return dict(value) if value else None
def require_user(user_id: int | None, roles=None):
    if user_id is None: raise HTTPException(401, 'Sign in first')
    with connection() as db:
        user = row(db.execute('SELECT id,name,email,role FROM users WHERE id=?', (user_id,)).fetchone())
    if not user: raise HTTPException(401, 'Unknown account')
    if roles and user['role'] not in roles: raise HTTPException(403, 'This account cannot perform that action')
    return user

class Login(BaseModel):
    email: str
    password: str
    recaptcha_token: str | None = None
class ReservationIn(BaseModel):
    computer_id: int
    starts_at: datetime
    ends_at: datetime
class SessionIn(BaseModel):
    computer_id: int
class PrintIn(BaseModel):
    filename: str = Field(min_length=1)
    pages: int = Field(ge=1, le=500)
    copies: int = Field(ge=1, le=100)
class PaymentIn(BaseModel):
    item_type: Literal['session', 'print']
    item_id: int
    method: Literal['demo_qr', 'cash'] = 'demo_qr'
class MaintenanceIn(BaseModel):
    computer_id: int
    note: str = Field(min_length=3)
class ReviewerIn(BaseModel):
    subject: str
    notes: str = Field(min_length=10)
class ClassGradeIn(BaseModel):
    class_id: int
    student_id: int
    score: float = Field(ge=0, le=100)
class MeetingLinkIn(BaseModel):
    url: str = Field(max_length=500)

@app.get('/health')
def health(): return {'ok': True}

@app.post('/auth/login')
def login(payload: Login):
    secret = os.getenv('OMNIRA_RECAPTCHA_SECRET_KEY')
    if secret:
        if not payload.recaptcha_token: raise HTTPException(400, 'Complete verification first')
        request = Request('https://www.google.com/recaptcha/api/siteverify', data=urlencode({'secret': secret, 'response': payload.recaptcha_token}).encode(), method='POST')
        try:
            with urlopen(request, timeout=5) as response: verification = json.load(response)
        except Exception: raise HTTPException(503, 'Verification is unavailable. Try again')
        if not verification.get('success'): raise HTTPException(400, 'Verification failed. Try again')
    with connection() as db:
        user = row(db.execute('SELECT id,name,email,role FROM users WHERE email=? AND password=?', (payload.email, payload.password)).fetchone())
    if not user: raise HTTPException(401, 'Incorrect email or password')
    return user

@app.get('/dashboard')
def dashboard(x_user_id: int | None = Header(default=None)):
    user = require_user(x_user_id)
    with connection() as db:
        available = db.execute("SELECT COUNT(*) FROM computers WHERE status='available'").fetchone()[0]
        active = db.execute('SELECT COUNT(*) FROM sessions WHERE ended_at IS NULL').fetchone()[0]
        bookings = db.execute("SELECT COUNT(*) FROM reservations WHERE status='confirmed'").fetchone()[0]
        jobs = db.execute("SELECT COUNT(*) FROM print_jobs WHERE status!='completed'").fetchone()[0]
    return {'user': user, 'available_computers': available, 'active_sessions': active, 'reservations': bookings, 'open_print_jobs': jobs}

@app.get('/computers')
def computers(x_user_id: int | None = Header(default=None)):
    require_user(x_user_id)
    with connection() as db: return [row(r) for r in db.execute('SELECT * FROM computers ORDER BY lab,label')]

@app.get('/users')
def list_users(x_user_id: int | None = Header(default=None)):
    require_user(x_user_id, ['admin'])
    with connection() as db:
        return [row(r) for r in db.execute("SELECT id,name,email,role,course,department FROM users WHERE role IN ('student','professor') ORDER BY role,name")]

@app.get('/users/students')
def search_students(query: str = '', x_user_id: int | None = Header(default=None)):
    require_user(x_user_id, ['admin'])
    pattern = f"%{query.strip().lower()}%"
    with connection() as db:
        return [row(r) for r in db.execute(
            "SELECT id,name,email FROM users WHERE role='student' AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ?) ORDER BY name LIMIT 8",
            (pattern, pattern)
        )]

@app.get('/professor/classes')
def professor_classes(x_user_id: int | None = Header(default=None)):
    professor = require_user(x_user_id, ['professor'])
    with connection() as db:
        classes = [row(item) for item in db.execute(
            'SELECT id,section_name,course,subject,day_of_week,start_time,end_time,meeting_url FROM professor_classes WHERE professor_id=? ORDER BY section_name,day_of_week,start_time',
            (professor['id'],))]
        for item in classes:
            item['students'] = [row(student) for student in db.execute(
                'SELECT u.id,u.name,u.email,g.score,g.updated_at FROM class_enrollments e JOIN users u ON u.id=e.student_id LEFT JOIN class_grades g ON g.class_id=e.class_id AND g.student_id=e.student_id WHERE e.class_id=? ORDER BY u.name',
                (item['id'],))]
    return classes

@app.post('/professor/classes/{class_id}/meeting')
def save_meeting_link(class_id: int, payload: MeetingLinkIn, x_user_id: int | None = Header(default=None)):
    professor = require_user(x_user_id, ['professor'])
    url = payload.url.strip()
    parsed = urlparse(url)
    if url and (parsed.scheme not in ('https','http') or not parsed.netloc):
        raise HTTPException(400, 'Enter a valid http or https meeting link')
    with connection() as db:
        assigned = db.execute('SELECT id FROM professor_classes WHERE id=? AND professor_id=?', (class_id,professor['id'])).fetchone()
        if not assigned: raise HTTPException(403, 'This class is not assigned to you')
        db.execute('UPDATE professor_classes SET meeting_url=? WHERE id=?', (url or None,class_id))
    return {'class_id':class_id,'meeting_url':url or None}

@app.post('/professor/grades')
def save_professor_grade(payload: ClassGradeIn, x_user_id: int | None = Header(default=None)):
    professor = require_user(x_user_id, ['professor'])
    with connection() as db:
        assigned = db.execute('SELECT id FROM professor_classes WHERE id=? AND professor_id=?', (payload.class_id,professor['id'])).fetchone()
        if not assigned: raise HTTPException(403, 'This class is not assigned to you')
        enrolled = db.execute('SELECT student_id FROM class_enrollments WHERE class_id=? AND student_id=?', (payload.class_id,payload.student_id)).fetchone()
        if not enrolled: raise HTTPException(403, 'This student is not in your class')
        timestamp = now()
        existing = db.execute('SELECT student_id FROM class_grades WHERE class_id=? AND student_id=?', (payload.class_id,payload.student_id)).fetchone()
        if existing:
            db.execute('UPDATE class_grades SET score=?,updated_at=? WHERE class_id=? AND student_id=?', (payload.score,timestamp,payload.class_id,payload.student_id))
        else:
            db.execute('INSERT INTO class_grades(class_id,student_id,score,updated_at) VALUES(?,?,?,?)', (payload.class_id,payload.student_id,payload.score,timestamp))
    return {'class_id':payload.class_id,'student_id':payload.student_id,'score':payload.score,'updated_at':timestamp}

@app.get('/reservations')
def reservations(x_user_id: int | None = Header(default=None)):
    user = require_user(x_user_id)
    with connection() as db:
        sql = 'SELECT r.*,c.label,c.lab,u.name AS student FROM reservations r JOIN computers c ON c.id=r.computer_id JOIN users u ON u.id=r.user_id'
        args = ()
        if user['role'] == 'student': sql += ' WHERE r.user_id=?'; args = (user['id'],)
        return [row(r) for r in db.execute(sql + ' ORDER BY r.starts_at DESC', args)]

@app.post('/reservations')
def create_reservation(payload: ReservationIn, x_user_id: int | None = Header(default=None)):
    user = require_user(x_user_id, ['student'])
    if payload.ends_at <= payload.starts_at: raise HTTPException(400, 'End time must follow start time')
    if payload.starts_at < datetime.now(payload.starts_at.tzinfo): raise HTTPException(400, 'Choose a future start time')
    with connection() as db:
        pc = db.execute('SELECT status FROM computers WHERE id=?', (payload.computer_id,)).fetchone()
        if not pc or pc['status'] != 'available': raise HTTPException(400, 'Computer is unavailable')
        overlap = db.execute("SELECT id FROM reservations WHERE computer_id=? AND status='confirmed' AND starts_at<? AND ends_at>?", (payload.computer_id,payload.ends_at.isoformat(),payload.starts_at.isoformat())).fetchone()
        if overlap: raise HTTPException(409, 'Computer is already booked for this time')
        cur = db.execute('INSERT INTO reservations(user_id,computer_id,starts_at,ends_at) VALUES(?,?,?,?)', (user['id'],payload.computer_id,payload.starts_at.isoformat(),payload.ends_at.isoformat()))
        return {'id': cur.lastrowid, 'status': 'confirmed'}

@app.post('/reservations/{reservation_id}/cancel')
def cancel_reservation(reservation_id: int, x_user_id: int | None = Header(default=None)):
    user = require_user(x_user_id)
    with connection() as db:
        item = db.execute('SELECT * FROM reservations WHERE id=?', (reservation_id,)).fetchone()
        if not item: raise HTTPException(404, 'Reservation not found')
        if user['role'] == 'student' and item['user_id'] != user['id']: raise HTTPException(403, 'Not your reservation')
        db.execute("UPDATE reservations SET status='cancelled' WHERE id=?", (reservation_id,))
    return {'status': 'cancelled'}

@app.get('/sessions')
def sessions(x_user_id: int | None = Header(default=None)):
    user = require_user(x_user_id)
    with connection() as db:
        sql = 'SELECT s.*,c.label,u.name AS student FROM sessions s JOIN computers c ON c.id=s.computer_id JOIN users u ON u.id=s.user_id'
        args = ()
        if user['role'] == 'student': sql += ' WHERE s.user_id=?'; args = (user['id'],)
        return [row(r) for r in db.execute(sql + ' ORDER BY s.id DESC', args)]

@app.post('/sessions/start')
def start_session(payload: SessionIn, x_user_id: int | None = Header(default=None)):
    user = require_user(x_user_id, ['student','admin'])
    with connection() as db:
        pc = db.execute('SELECT status FROM computers WHERE id=?', (payload.computer_id,)).fetchone()
        if not pc or pc['status'] != 'available': raise HTTPException(400, 'Computer unavailable')
        existing = db.execute('SELECT id FROM sessions WHERE computer_id=? AND ended_at IS NULL', (payload.computer_id,)).fetchone()
        if existing: raise HTTPException(409, 'Computer already in use')
        cur = db.execute('INSERT INTO sessions(user_id,computer_id,started_at) VALUES(?,?,?)', (user['id'],payload.computer_id,now()))
        return {'id':cur.lastrowid,'status':'active'}

@app.post('/sessions/{session_id}/end')
def end_session(session_id: int, x_user_id: int | None = Header(default=None)):
    user = require_user(x_user_id)
    with connection() as db:
        item = db.execute('SELECT * FROM sessions WHERE id=?', (session_id,)).fetchone()
        if not item: raise HTTPException(404, 'Session not found')
        if user['role'] == 'student' and item['user_id'] != user['id']: raise HTTPException(403, 'Not your session')
        if item['ended_at']: raise HTTPException(400, 'Session already ended')
        end = now()
        minutes = max(1,ceil((datetime.fromisoformat(end)-datetime.fromisoformat(item['started_at'])).total_seconds()/60))
        amount = round(minutes * item['rate_per_hour'] / 60, 2)
        db.execute('UPDATE sessions SET ended_at=?,amount=? WHERE id=?',(end,amount,session_id))
        return {'id':session_id,'minutes':minutes,'amount':amount,'currency':'PHP'}

@app.get('/printing')
def printing(x_user_id: int | None = Header(default=None)):
    user = require_user(x_user_id)
    with connection() as db:
        sql = 'SELECT p.*,u.name AS student FROM print_jobs p JOIN users u ON u.id=p.user_id'
        args = ()
        if user['role'] == 'student': sql += ' WHERE p.user_id=?'; args = (user['id'],)
        return [row(r) for r in db.execute(sql+' ORDER BY p.id DESC',args)]

@app.post('/printing')
def create_print(payload: PrintIn, x_user_id: int | None = Header(default=None)):
    user = require_user(x_user_id, ['student','professor'])
    amount = round(payload.pages * payload.copies * 2.0, 2)
    with connection() as db:
        cur = db.execute('INSERT INTO print_jobs(user_id,filename,pages,copies,amount) VALUES(?,?,?,?,?)',(user['id'],payload.filename,payload.pages,payload.copies,amount))
        return {'id':cur.lastrowid,'amount':amount,'status':'pending'}

@app.post('/printing/{job_id}/complete')
def complete_print(job_id: int, x_user_id: int | None = Header(default=None)):
    require_user(x_user_id,['admin'])
    with connection() as db:
        if not db.execute('SELECT id FROM print_jobs WHERE id=?',(job_id,)).fetchone(): raise HTTPException(404,'Print job not found')
        db.execute("UPDATE print_jobs SET status='completed' WHERE id=?",(job_id,))
    return {'status':'completed'}

@app.get('/payments')
def payments(x_user_id: int | None = Header(default=None)):
    user = require_user(x_user_id)
    with connection() as db:
        sql = 'SELECT * FROM payments'; args = ()
        if user['role'] == 'student': sql += ' WHERE user_id=?'; args = (user['id'],)
        return [row(r) for r in db.execute(sql+' ORDER BY id DESC',args)]

@app.post('/payments')
def pay(payload: PaymentIn, x_user_id: int | None = Header(default=None)):
    user = require_user(x_user_id, ['student','professor'])
    table = 'sessions' if payload.item_type == 'session' else 'print_jobs'
    with connection() as db:
        item = db.execute(f'SELECT user_id,amount FROM {table} WHERE id=?',(payload.item_id,)).fetchone()
        if not item: raise HTTPException(404,'Bill not found')
        if item['user_id'] != user['id']: raise HTTPException(403,'Not your bill')
        if payload.item_type == 'session' and not db.execute('SELECT ended_at FROM sessions WHERE id=?',(payload.item_id,)).fetchone()['ended_at']: raise HTTPException(400,'End session before paying')
        if db.execute('SELECT id FROM payments WHERE item_type=? AND item_id=?',(payload.item_type,payload.item_id)).fetchone(): raise HTTPException(409,'Bill already paid')
        cur = db.execute('INSERT INTO payments(user_id,item_type,item_id,amount,method,paid_at) VALUES(?,?,?,?,?,?)',(user['id'],payload.item_type,payload.item_id,item['amount'],payload.method,now()))
        return {'receipt_id':cur.lastrowid,'amount':item['amount'],'status':'paid','note':'Demo payment only'}

@app.get('/receipts/{receipt_id}')
def receipt(receipt_id: int, x_user_id: int | None = Header(default=None)):
    user = require_user(x_user_id)
    with connection() as db:
        item = row(db.execute('SELECT * FROM payments WHERE id=?',(receipt_id,)).fetchone())
    if not item: raise HTTPException(404,'Receipt not found')
    if user['role'] == 'student' and item['user_id'] != user['id']: raise HTTPException(403,'Not your receipt')
    return {'receipt_no':f'OM-DEMO-{receipt_id:06d}',**item,'currency':'PHP','note':'Demo receipt; not an official school receipt'}

@app.get('/maintenance')
def maintenance(x_user_id: int | None = Header(default=None)):
    require_user(x_user_id)
    with connection() as db: return [row(r) for r in db.execute('SELECT m.*,c.label FROM maintenance m JOIN computers c ON c.id=m.computer_id ORDER BY m.id DESC')]

@app.post('/maintenance')
def add_maintenance(payload: MaintenanceIn, x_user_id: int | None = Header(default=None)):
    require_user(x_user_id,['admin'])
    with connection() as db:
        if not db.execute('SELECT id FROM computers WHERE id=?',(payload.computer_id,)).fetchone(): raise HTTPException(404,'Computer not found')
        cur=db.execute('INSERT INTO maintenance(computer_id,note,created_at) VALUES(?,?,?)',(payload.computer_id,payload.note,now()))
        db.execute("UPDATE computers SET status='maintenance' WHERE id=?",(payload.computer_id,))
        return {'id':cur.lastrowid,'status':'open'}

@app.get('/analytics')
def analytics(x_user_id: int | None = Header(default=None)):
    require_user(x_user_id,['professor','admin'])
    with connection() as db:
        completed = db.execute('SELECT started_at,ended_at FROM sessions WHERE ended_at IS NOT NULL').fetchall()
        minutes = sum((datetime.fromisoformat(s['ended_at']) - datetime.fromisoformat(s['started_at'])).total_seconds()/60 for s in completed)
        return {'total_students':db.execute("SELECT COUNT(*) FROM users WHERE role='student'").fetchone()[0],
                'total_lab_minutes':round(minutes),
                'note':'Academic grades are not included in this demo dataset.'}

@app.post('/reviewer')
def reviewer(payload: ReviewerIn, x_user_id: int | None = Header(default=None)):
    require_user(x_user_id,['student','professor'])
    lines=[s.strip() for s in payload.notes.replace('\n','.').split('.') if s.strip()]
    return {'subject':payload.subject,'reviewer':[f'{i+1}. {line}' for i,line in enumerate(lines[:10])], 'note':'Offline rule-based preview; no AI model connected'}
