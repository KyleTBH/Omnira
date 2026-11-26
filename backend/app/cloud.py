"""Authenticated streaming file API. No bucket credentials reach a client."""
import hashlib
import os
from datetime import datetime, timezone
from pathlib import PurePath
from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool
from .db import connection
from .object_storage import get_store
from .platform_db import lock_owner
from .security import current_user

router = APIRouter(prefix='/cloud', tags=['private files'])


def limits():
    return int(os.getenv('OMNIRA_MAX_FILE_BYTES', '10485760')), int(os.getenv('OMNIRA_USER_QUOTA_BYTES', '104857600'))


def metadata(record):
    return {key: value for key, value in dict(record).items() if key not in ('object_key', 'storage_backend', 'user_id')}


@router.get('/status')
def status(user=Depends(current_user)):
    maximum, quota = limits()
    try:
        store = get_store()
        ready = store.ready()
    except Exception:
        raise HTTPException(503, 'File storage is not configured or is unavailable')
    with connection() as db:
        used = db.execute('SELECT COALESCE(SUM(size_bytes),0) AS used FROM cloud_files WHERE user_id=? AND deleted=0', (user['id'],)).fetchone()['used']
    return {'backend': store.name, 'ready': ready, 'used_bytes': int(used), 'quota_bytes': quota, 'max_file_bytes': maximum}


@router.get('/files')
def list_files(offset: int = Query(default=0, ge=0), limit: int = Query(default=100, ge=1, le=500),
               include_deleted: bool = False, user=Depends(current_user)):
    with connection() as db:
        records = db.execute('SELECT * FROM cloud_files WHERE user_id=?' + ('' if include_deleted else ' AND deleted=0') +
                             ' ORDER BY created_at,file_id LIMIT ? OFFSET ?', (user['id'], limit + 1, offset)).fetchall()
    return {'files': [metadata(record) for record in records[:limit]],
            'next_offset': offset + limit if len(records) > limit else None}


def save_upload(user_id, file_id, folder_id, filename, content_type, data):
    digest = hashlib.sha256(data).hexdigest()
    maximum, quota = limits()
    if len(data) > maximum:
        raise HTTPException(413, 'File exceeds the upload size limit')
    key = f'users/{user_id}/{file_id}/{digest}'
    with connection(write=True) as db:
        lock_owner(db, user_id)
        existing = db.execute('SELECT * FROM cloud_files WHERE file_id=?', (file_id,)).fetchone()
        if existing:
            if existing['user_id'] != user_id:
                raise HTTPException(409, 'File ID is unavailable')
            if existing['deleted']:
                raise HTTPException(409, 'This file was deleted. Choose it again to create a new upload')
            if (existing['sha256'], existing['filename'], existing['folder_id']) != (digest, filename, folder_id):
                raise HTTPException(409, 'File ID was already used with different content')
            return metadata(existing)
        used = int(db.execute('SELECT COALESCE(SUM(size_bytes),0) AS used FROM cloud_files WHERE user_id=? AND deleted=0', (user_id,)).fetchone()['used'])
        if used + len(data) > quota:
            raise HTTPException(413, 'Your file storage quota has been reached')
        if folder_id:
            folder = db.execute("SELECT deleted FROM sync_records WHERE user_id=? AND entity='folder' AND record_id=?", (user_id, folder_id)).fetchone()
            if not folder or folder['deleted']:
                raise HTTPException(409, 'Sync this folder before uploading files into it')
        try:
            store = get_store()
            store.put(key, data, content_type)
        except Exception:
            raise HTTPException(503, 'File storage is unavailable. Your device can retry later')
        timestamp = datetime.now(timezone.utc).isoformat()
        # An interrupted DB commit may leave an unreferenced private object.
        # Retrying writes the same deterministic key instead of duplicating it.
        db.execute('''INSERT INTO cloud_files(file_id,user_id,folder_id,filename,media_type,size_bytes,sha256,object_key,storage_backend,deleted,created_at)
                      VALUES(?,?,?,?,?,?,?,?,?,0,?)''',
                   (file_id, user_id, folder_id, filename, content_type, len(data), digest, key, store.name, timestamp))
        return metadata(db.execute('SELECT * FROM cloud_files WHERE file_id=?', (file_id,)).fetchone())


@router.post('/files')
async def upload(file_id: UUID = Form(...), file: UploadFile = File(...), folder_id: UUID | None = Form(default=None), user=Depends(current_user)):
    maximum, _ = limits()
    name = (file.filename or 'untitled').replace('\\', '/')
    name = PurePath(name).name
    if not name or len(name) > 200 or any(ord(char) < 32 or ord(char) == 127 for char in name):
        raise HTTPException(422, 'Invalid filename')
    chunks, size = [], 0
    try:
        while chunk := await file.read(65536):
            size += len(chunk)
            if size > maximum:
                raise HTTPException(413, 'File exceeds the upload size limit')
            chunks.append(chunk)
    finally:
        await file.close()
    if size == 0:
        raise HTTPException(422, 'Empty files are not supported')
    media_type = (file.content_type or 'application/octet-stream')[:150]
    return await run_in_threadpool(save_upload, user['id'], str(file_id), str(folder_id) if folder_id else None,
                                  name, media_type, b''.join(chunks))


def owned_file(user_id, file_id, include_deleted=False):
    with connection() as db:
        record = db.execute('SELECT * FROM cloud_files WHERE file_id=? AND user_id=?', (str(file_id), user_id)).fetchone()
    if not record or (record['deleted'] and not include_deleted):
        raise HTTPException(404, 'File not found')
    return record


@router.get('/files/{file_id}/content')
def download(file_id: UUID, user=Depends(current_user)):
    record = owned_file(user['id'], file_id)
    try:
        stream = get_store(record['storage_backend']).read(record['object_key'])
    except Exception:
        raise HTTPException(503, 'File storage is unavailable. Please retry')

    def chunks():
        try:
            while data := stream.read(65536):
                yield data
        finally:
            stream.close()
    return StreamingResponse(chunks(), media_type='application/octet-stream', headers={
        'Content-Disposition': "attachment; filename*=UTF-8''" + quote(record['filename'], safe=''),
        'Content-Length': str(record['size_bytes']), 'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store', 'X-Checksum-SHA256': record['sha256']})


@router.delete('/files/{file_id}')
def delete(file_id: UUID, user=Depends(current_user)):
    record = owned_file(user['id'], file_id, include_deleted=True)
    with connection(write=True) as db:
        lock_owner(db, user['id'])
        db.execute('UPDATE cloud_files SET deleted=1 WHERE file_id=? AND user_id=?', (str(file_id), user['id']))
    try:
        get_store(record['storage_backend']).delete(record['object_key'])
    except Exception:
        # The tombstone already blocks reads. Repeated DELETE retries cleanup.
        raise HTTPException(503, 'File is hidden; storage cleanup will be retried')
    return {'file_id': str(file_id), 'deleted': True}
