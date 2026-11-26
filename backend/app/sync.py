"""Per-account optimistic sync with durable idempotency and deletion tombstones."""
import hashlib
import json
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from .db import connection
from .platform_db import lock_owner
from .security import current_user

router = APIRouter(prefix='/sync', tags=['offline synchronization'])


class Mutation(BaseModel):
    operation_id: UUID
    entity: Literal['folder', 'note', 'task']
    record_id: UUID
    base_version: int = Field(ge=0)
    body: dict = Field(default_factory=dict)
    deleted: bool = False


class Push(BaseModel):
    changes: list[Mutation] = Field(max_length=100)


def external(record):
    return {'entity': record['entity'], 'record_id': record['record_id'],
            'body': json.loads(record['body']), 'version': record['revision'],
            'deleted': bool(record['deleted']), 'updated_at': record['updated_at']}


def validate_body(change):
    try:
        encoded = json.dumps(change.body, sort_keys=True, ensure_ascii=False, allow_nan=False)
    except (ValueError, TypeError):
        raise HTTPException(422, 'Record data must contain valid JSON values')
    if len(encoded.encode()) > 65536:
        raise HTTPException(413, 'A synced record cannot exceed 64 KiB')
    if not change.deleted:
        key = 'name' if change.entity == 'folder' else 'title'
        value = change.body.get(key)
        if not isinstance(value, str) or not value.strip() or len(value) > 200:
            raise HTTPException(422, f'{key} must contain 1 to 200 characters')
        if change.entity == 'note' and not isinstance(change.body.get('text', ''), str):
            raise HTTPException(422, 'Note text must be a string')
        if change.entity == 'task' and not isinstance(change.body.get('done', False), bool):
            raise HTTPException(422, 'Task completion must be true or false')
        folder_id = change.body.get('folder_id')
        if folder_id is not None:
            try:
                UUID(str(folder_id))
            except ValueError:
                raise HTTPException(422, 'Invalid folder ID')
    return encoded


def apply_change(user_id, change):
    body = validate_body(change)
    wire = change.model_dump(mode='json')
    fingerprint = hashlib.sha256(json.dumps(wire, sort_keys=True).encode()).hexdigest()
    record_id, operation_id = str(change.record_id), str(change.operation_id)
    with connection(write=True) as db:
        revision = lock_owner(db, user_id)
        cached = db.execute('SELECT fingerprint,result FROM sync_operations WHERE user_id=? AND operation_id=?',
                            (user_id, operation_id)).fetchone()
        if cached:
            if cached['fingerprint'] != fingerprint:
                raise HTTPException(409, 'Operation ID was already used with different content')
            return json.loads(cached['result'])
        record = db.execute('SELECT * FROM sync_records WHERE user_id=? AND entity=? AND record_id=?',
                            (user_id, change.entity, record_id)).fetchone()
        if change.base_version != (record['revision'] if record else 0):
            return {'operation_id': operation_id, 'status': 'conflict',
                    'server': external(record) if record else None}
        # Tombstones are not silently revived; explicit conflict resolution is
        # allowed only against the latest version and a fresh operation ID.
        revision += 1
        timestamp = datetime.now(timezone.utc).isoformat()
        if record:
            db.execute('''UPDATE sync_records SET body=?,revision=?,deleted=?,updated_at=?
                          WHERE user_id=? AND entity=? AND record_id=?''',
                       (body, revision, int(change.deleted), timestamp, user_id, change.entity, record_id))
        else:
            db.execute('''INSERT INTO sync_records(user_id,entity,record_id,body,revision,deleted,updated_at)
                          VALUES(?,?,?,?,?,?,?)''',
                       (user_id, change.entity, record_id, body, revision, int(change.deleted), timestamp))
        db.execute('UPDATE sync_heads SET revision=? WHERE user_id=?', (revision, user_id))
        result = {'operation_id': operation_id, 'status': 'applied', 'record': {
            'entity': change.entity, 'record_id': record_id, 'body': change.body,
            'version': revision, 'deleted': change.deleted, 'updated_at': timestamp}}
        db.execute('INSERT INTO sync_operations(user_id,operation_id,fingerprint,result) VALUES(?,?,?,?)',
                   (user_id, operation_id, fingerprint, json.dumps(result)))
        return result


@router.post('/push')
def push(payload: Push, user=Depends(current_user)):
    # Each item is independently atomic. Retrying the entire batch after a
    # dropped response is safe because acknowledged operations are durable.
    return {'results': [apply_change(user['id'], change) for change in payload.changes]}


@router.get('/pull')
def pull(after: int = Query(default=0, ge=0), limit: int = Query(default=100, ge=1, le=500), user=Depends(current_user)):
    with connection() as db:
        records = db.execute('''SELECT * FROM sync_records WHERE user_id=? AND revision>?
                                ORDER BY revision LIMIT ?''', (user['id'], after, limit + 1)).fetchall()
    more = len(records) > limit
    records = records[:limit]
    cursor = records[-1]['revision'] if records else after
    return {'records': [external(record) for record in records], 'cursor': cursor, 'has_more': more}
