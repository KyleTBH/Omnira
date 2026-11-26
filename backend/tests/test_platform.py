import io
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from app import db as database, cloud
from app.main import app
from app.object_storage import LocalStore, S3Store
from app.platform_db import init_platform_db
from app.security import check_password


class PlatformTests(unittest.TestCase):
    def setUp(self):
        self.temp = self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(patch.object(database, 'DB_PATH', Path(self.temp) / 'test.sqlite'))
        self.enterContext(patch.object(database, 'MYSQL_URL', ''))
        self.enterContext(patch.dict(os.environ, {
            'OMNIRA_STORAGE_BACKEND': 'local', 'OMNIRA_STORAGE_PATH': self.temp + '/objects',
            'OMNIRA_MAX_FILE_BYTES': '10485760', 'OMNIRA_USER_QUOTA_BYTES': '104857600',
            'OMNIRA_RECAPTCHA_SECRET_KEY': '', 'OMNIRA_REQUIRE_RECAPTCHA': '', 'OMNIRA_SKIP_INIT': '',
        }))
        self.client = self.enterContext(TestClient(app))
        self.student = self.login('student')
        self.professor = self.login('professor')

    def login(self, role):
        result = self.client.post('/auth/login', json={'email': role + '@omnira.test', 'password': 'demo123'})
        self.assertEqual(result.status_code, 200, result.text)
        return result.json()

    def headers(self, user=None):
        return {'Authorization': 'Bearer ' + (user or self.student)['token']}

    def mutation(self, *, entity='note', record_id=None, version=0, body=None, deleted=False, operation_id=None):
        return {'operation_id': operation_id or str(uuid4()), 'entity': entity, 'record_id': record_id or str(uuid4()),
                'base_version': version, 'body': body if body is not None else {'title': 'My note', 'text': 'Offline content'}, 'deleted': deleted}

    def push(self, change, user=None):
        return self.client.post('/sync/push', headers=self.headers(user), json={'changes': [change]})

    def upload(self, *, user=None, file_id=None, content=b'private file bytes', name='notes.txt', folder_id=None):
        fields = {'file_id': file_id or str(uuid4())}
        if folder_id:
            fields['folder_id'] = folder_id
        return self.client.post('/cloud/files', headers=self.headers(user), data=fields, files={'file': (name, content, 'text/plain')})

    def test_passwords_are_hashed_and_not_exposed(self):
        with database.connection() as db:
            stored = db.execute('SELECT password FROM users WHERE id=?', (self.student['id'],)).fetchone()['password']
        self.assertTrue(stored.startswith('pbkdf2_sha256$'))
        self.assertTrue(check_password('demo123', stored))
        self.assertFalse(check_password('wrong', stored))
        self.assertNotIn('password', self.student)
        self.assertEqual(self.client.post('/auth/login', json={'email': 'student@omnira.test', 'password': 'wrong'}).status_code, 401)

    def test_forged_user_header_is_rejected(self):
        self.assertEqual(self.client.get('/cloud/files', headers={'X-User-Id': '1'}).status_code, 401)
        self.assertEqual(self.client.get('/dashboard', headers={'X-User-Id': '1'}).status_code, 401)
        result = self.client.get('/auth/me', headers={**self.headers(), 'X-User-Id': str(self.professor['id'])})
        self.assertEqual(result.json()['id'], self.student['id'])

    def test_logout_revokes_the_shared_database_session(self):
        self.assertEqual(self.client.post('/auth/logout', headers=self.headers()).status_code, 200)
        self.assertEqual(self.client.get('/auth/me', headers=self.headers()).status_code, 401)
        self.assertEqual(self.client.get('/auth/me', headers=self.headers(self.professor)).status_code, 200)

    def test_existing_role_endpoints_receive_only_verified_identity(self):
        headers = {**self.headers(), 'X-User-Id': str(self.professor['id'])}
        self.assertEqual(self.client.get('/dashboard', headers=headers).json()['user']['id'], self.student['id'])
        self.assertEqual(self.client.get('/professor/classes', headers=headers).status_code, 403)

    def test_concurrent_uploads_cannot_overspend_quota(self):
        with patch.dict(os.environ, {'OMNIRA_USER_QUOTA_BYTES': '5'}):
            with ThreadPoolExecutor(max_workers=2) as workers:
                results = list(workers.map(lambda _: self.upload(content=b'1234'), range(2)))
            self.assertEqual(sorted(result.status_code for result in results), [200, 413])
            self.assertEqual(self.client.get('/cloud/status', headers=self.headers()).json()['used_bytes'], 4)

    def test_expired_session_is_rejected(self):
        with database.connection(write=True) as db:
            db.execute('UPDATE auth_sessions SET expires_at=? WHERE user_id=?', (time.time()-1, self.student['id']))
        self.assertEqual(self.client.get('/dashboard', headers=self.headers()).status_code, 401)

    def test_cors_headers_on_unauthorized_responses(self):
        result = self.client.get('/cloud/files', headers={'Origin': 'http://127.0.0.1:5500'})
        self.assertEqual(result.status_code, 401)
        self.assertEqual(result.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5500')

    def test_create_pull_and_account_isolation(self):
        change = self.mutation()
        self.assertEqual(self.push(change).json()['results'][0]['status'], 'applied')
        records = self.client.get('/sync/pull', headers=self.headers()).json()['records']
        self.assertEqual(records[0]['body']['text'], 'Offline content')
        self.assertEqual(self.client.get('/sync/pull', headers=self.headers(self.professor)).json()['records'], [])

    def test_retries_are_idempotent_and_operation_ids_are_immutable(self):
        change = self.mutation()
        first = self.push(change).json()
        self.assertEqual(self.push(change).json(), first)
        changed = {**change, 'body': {'title': 'Different'}}
        self.assertEqual(self.push(changed).status_code, 409)
        self.assertEqual(len(self.client.get('/sync/pull', headers=self.headers()).json()['records']), 1)

    def test_conflicts_require_explicit_rebase(self):
        change = self.mutation()
        first = self.push(change).json()['results'][0]['record']
        stale = self.mutation(record_id=change['record_id'], body={'title': 'Device B'})
        result = self.push(stale).json()['results'][0]
        self.assertEqual(result['status'], 'conflict')
        self.assertEqual(result['server']['body']['title'], 'My note')
        resolved = self.mutation(record_id=change['record_id'], version=first['version'], body={'title': 'Device B'})
        self.assertEqual(self.push(resolved).json()['results'][0]['status'], 'applied')

    def test_tombstones_prevent_stale_resurrection(self):
        change = self.mutation()
        record = self.push(change).json()['results'][0]['record']
        deletion = self.mutation(record_id=change['record_id'], version=record['version'], deleted=True)
        deleted = self.push(deletion).json()['results'][0]['record']
        self.assertTrue(deleted['deleted'])
        self.assertEqual(self.push(self.mutation(record_id=change['record_id'])).json()['results'][0]['status'], 'conflict')
        self.assertTrue(self.client.get('/sync/pull', headers=self.headers()).json()['records'][0]['deleted'])

    def test_pull_pagination_and_cursor(self):
        for _ in range(4):
            self.push(self.mutation())
        first = self.client.get('/sync/pull?limit=2', headers=self.headers()).json()
        self.assertTrue(first['has_more'])
        second = self.client.get('/sync/pull?limit=2&after=' + str(first['cursor']), headers=self.headers()).json()
        self.assertFalse(second['has_more'])
        self.assertEqual(len({r['record_id'] for r in first['records'] + second['records']}), 4)

    def test_invalid_record_and_oversize_content(self):
        self.assertEqual(self.push(self.mutation(body={'title': ''})).status_code, 422)
        self.assertEqual(self.push(self.mutation(body={'title': 'Large', 'text': 'x'*70000})).status_code, 413)
        self.assertEqual(self.push({**self.mutation(), 'record_id': '../escape'}).status_code, 422)

    def test_concurrent_operations_have_unique_ordered_revisions(self):
        changes = [self.mutation() for _ in range(8)]
        with ThreadPoolExecutor(max_workers=4) as workers:
            results = list(workers.map(self.push, changes))
        self.assertTrue(all(result.status_code == 200 for result in results))
        records = self.client.get('/sync/pull', headers=self.headers()).json()['records']
        self.assertEqual([r['version'] for r in records], list(range(1, 9)))

    def test_upload_download_delete_roundtrip(self):
        uploaded = self.upload()
        self.assertEqual(uploaded.status_code, 200, uploaded.text)
        meta = uploaded.json()
        self.assertNotIn('object_key', meta)
        content = self.client.get('/cloud/files/' + meta['file_id'] + '/content', headers=self.headers())
        self.assertEqual(content.content, b'private file bytes')
        self.assertEqual(content.headers['x-checksum-sha256'], meta['sha256'])
        self.assertIn('attachment;', content.headers['content-disposition'])
        self.assertEqual(self.client.delete('/cloud/files/' + meta['file_id'], headers=self.headers()).status_code, 200)
        self.assertEqual(self.client.get('/cloud/files/' + meta['file_id'] + '/content', headers=self.headers()).status_code, 404)
        self.assertEqual(self.client.get('/cloud/files', headers=self.headers()).json()['files'], [])
        self.assertEqual(self.client.get('/cloud/files?include_deleted=true', headers=self.headers()).json()['files'][0]['deleted'], 1)

    def test_upload_retry_does_not_duplicate_usage(self):
        file_id = str(uuid4())
        first = self.upload(file_id=file_id).json()
        second = self.upload(file_id=file_id)
        self.assertEqual(second.json(), first)
        status = self.client.get('/cloud/status', headers=self.headers()).json()
        self.assertEqual(status['used_bytes'], len(b'private file bytes'))
        self.assertEqual(self.upload(file_id=file_id, content=b'different').status_code, 409)

    def test_file_ownership_cannot_be_spoofed(self):
        file_id = self.upload().json()['file_id']
        for method, path in [('get', '/cloud/files/' + file_id + '/content'), ('delete', '/cloud/files/' + file_id)]:
            response = getattr(self.client, method)(path, headers={**self.headers(self.professor), 'X-User-Id': str(self.student['id'])})
            self.assertEqual(response.status_code, 404)
        self.assertEqual(self.client.get('/cloud/files', headers=self.headers(self.professor)).json()['files'], [])
        self.assertEqual(self.upload(user=self.professor, file_id=file_id).status_code, 409)

    def test_deleted_upload_id_cannot_resurrect_file(self):
        file_id = self.upload().json()['file_id']
        self.client.delete('/cloud/files/' + file_id, headers=self.headers())
        self.assertEqual(self.upload(file_id=file_id).status_code, 409)

    def test_file_size_quota_and_empty_upload(self):
        with patch.dict(os.environ, {'OMNIRA_MAX_FILE_BYTES': '5'}):
            self.assertEqual(self.upload(content=b'123456').status_code, 413)
        with patch.dict(os.environ, {'OMNIRA_USER_QUOTA_BYTES': '5'}):
            self.assertEqual(self.upload(content=b'1234').status_code, 200)
            self.assertEqual(self.upload(content=b'12').status_code, 413)
        self.assertEqual(self.upload(content=b'').status_code, 422)

    def test_files_require_an_owned_synced_folder(self):
        folder = self.mutation(entity='folder', body={'name': 'Math'})
        self.assertEqual(self.upload(folder_id=folder['record_id']).status_code, 409)
        self.push(folder)
        self.assertEqual(self.upload(folder_id=folder['record_id']).status_code, 200)
        self.assertEqual(self.upload(user=self.professor, folder_id=folder['record_id']).status_code, 409)

    def test_failed_upload_does_not_record_a_synced_file(self):
        with patch.object(cloud, 'get_store', side_effect=RuntimeError('offline')):
            self.assertEqual(self.upload().status_code, 503)
        self.assertEqual(self.client.get('/cloud/files', headers=self.headers()).json()['files'], [])

    def test_delete_failure_hides_file_and_retry_cleans_up(self):
        result = self.upload().json()
        with patch.object(LocalStore, 'delete', side_effect=OSError('offline')):
            self.assertEqual(self.client.delete('/cloud/files/' + result['file_id'], headers=self.headers()).status_code, 503)
        self.assertEqual(self.client.get('/cloud/files/' + result['file_id'] + '/content', headers=self.headers()).status_code, 404)
        self.assertEqual(self.client.delete('/cloud/files/' + result['file_id'], headers=self.headers()).status_code, 200)

    def test_file_metadata_pagination(self):
        for _ in range(3):
            self.upload()
        first = self.client.get('/cloud/files?limit=2', headers=self.headers()).json()
        self.assertEqual(first['next_offset'], 2)
        second = self.client.get('/cloud/files?limit=2&offset=2', headers=self.headers()).json()
        self.assertEqual(len(first['files']) + len(second['files']), 3)

    def test_database_rollback_and_repeatable_migration(self):
        with self.assertRaises(RuntimeError):
            with database.connection(write=True) as db:
                db.execute('UPDATE users SET name=? WHERE id=?', ('should roll back', self.student['id']))
                raise RuntimeError('abort')
        self.assertEqual(self.client.get('/auth/me', headers=self.headers()).json()['name'], 'Alex Student')
        init_platform_db()
        self.assertEqual(self.client.get('/auth/me', headers=self.headers()).status_code, 200)

    def test_same_origin_frontend_and_readiness(self):
        self.assertEqual(self.client.get('/ready').status_code, 200)
        self.assertIn('cloud.js', self.client.get('/cloud.html').text)
        self.assertEqual(self.client.get('/backend/omnira.db').status_code, 404)


class ObjectStoreTests(unittest.TestCase):
    def test_local_path_traversal_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            store = LocalStore(directory)
            with self.assertRaises(ValueError):
                store.put('../../escape', b'bad', 'text/plain')

    def test_s3_adapter_uses_private_object_operations(self):
        class Client:
            def __init__(self): self.objects = {}; self.calls = []
            def put_object(self, **values):
                self.calls.append(values)
                self.objects[values['Key']] = values['Body']
            def get_object(self, **values): return {'Body': io.BytesIO(self.objects[values['Key']])}
            def delete_object(self, **values): self.objects.pop(values['Key'], None)
            def head_bucket(self, **values): return {}
        client = Client()
        store = S3Store(client=client, bucket='private-test')
        store.put('users/1/file', b'bytes', 'text/plain')
        self.assertNotIn('ACL', client.calls[0])
        self.assertEqual(store.read('users/1/file').read(), b'bytes')
        self.assertTrue(store.ready())
        store.delete('users/1/file')
        self.assertEqual(client.objects, {})


if __name__ == '__main__':
    unittest.main()
