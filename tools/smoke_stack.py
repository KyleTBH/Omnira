"""Exercise the real API through localhost or the Go gateway (stdlib only)."""
import argparse
import json
import time
from urllib.request import Request, urlopen
from uuid import uuid4

parser = argparse.ArgumentParser()
parser.add_argument('base', nargs='?', default='http://127.0.0.1:8080')
parser.add_argument('--require-balancing', action='store_true')
args = parser.parse_args()
base = args.base.rstrip('/')
token = None


def request(path, method='GET', body=None, content_type='application/json'):
    headers = {'Content-Type': content_type}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if isinstance(body, dict):
        body = json.dumps(body).encode()
    with urlopen(Request(base + path, data=body, headers=headers, method=method), timeout=30) as response:
        data = response.read()
        return json.loads(data) if response.headers.get_content_type() == 'application/json' else data


for attempt in range(90):
    try:
        request('/ready')
        break
    except Exception:
        if attempt == 89:
            raise
        time.sleep(1)
instances = {request('/health').get('instance', 'local') for _ in range(8)}
if args.require_balancing:
    assert len(instances) >= 2, f'Expected two API instances, received {instances}'
account = request('/auth/login', 'POST', {'email': 'student@omnira.test', 'password': 'demo123'})
token = account['token']
folder_id, note_id, file_id = (str(uuid4()) for _ in range(3))
changes = [
    {'operation_id': str(uuid4()), 'entity': 'folder', 'record_id': folder_id, 'base_version': 0, 'body': {'name': 'Smoke test'}},
    {'operation_id': str(uuid4()), 'entity': 'note', 'record_id': note_id, 'base_version': 0, 'body': {'title': 'Two-device sync', 'text': 'Persisted through the API', 'folder_id': folder_id}},
]
first = request('/sync/push', 'POST', {'changes': changes})
assert first == request('/sync/push', 'POST', {'changes': changes}), 'Retry was not idempotent'
records, cursor, more = [], 0, True
while more:
    result = request('/sync/pull?after=' + str(cursor))
    records.extend(result['records'])
    cursor, more = result['cursor'], result['has_more']
assert any(r['record_id'] == note_id and r['body']['text'] == 'Persisted through the API' for r in records)
boundary = 'omnira-' + uuid4().hex
payload = b''
for key, value in [('file_id', file_id), ('folder_id', folder_id)]:
    payload += f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode()
payload += f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="sync-proof.txt"\r\nContent-Type: text/plain\r\n\r\n'.encode()
payload += b'Actual private file bytes\r\n' + f'--{boundary}--\r\n'.encode()
try:
    meta = request('/cloud/files', 'POST', payload, 'multipart/form-data; boundary=' + boundary)
    assert request('/cloud/files', 'POST', payload, 'multipart/form-data; boundary=' + boundary) == meta
    assert request('/cloud/files/' + file_id + '/content') == b'Actual private file bytes'
    assert request('/cloud/status')['ready'] is True
finally:
    try:
        request('/cloud/files/' + file_id, 'DELETE')
    except Exception:
        pass
    for change, result in zip(changes, first['results']):
        request('/sync/push', 'POST', {'changes': [{**change, 'operation_id': str(uuid4()), 'base_version': result['record']['version'], 'deleted': True}]})
    request('/auth/logout', 'POST')
print('PASS: login, shared sessions, sync push/pull, retries, private upload/download/delete, logout; API instances:', ', '.join(sorted(instances)))
