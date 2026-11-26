"""Private local development storage and S3-compatible production storage."""
import os
from pathlib import Path


class LocalStore:
    name = 'local'

    def __init__(self, root=None):
        self.root = Path(root or os.getenv('OMNIRA_STORAGE_PATH', './data/objects')).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def path(self, key):
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root):
            raise ValueError('Invalid object key')
        return path

    def put(self, key, data, content_type):
        path = self.path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        # The API serializes uploads per owner. os.replace is atomic for readers.
        temporary = path.with_suffix('.uploading')
        try:
            temporary.write_bytes(data)
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)

    def read(self, key):
        return self.path(key).open('rb')

    def delete(self, key):
        self.path(key).unlink(missing_ok=True)

    def ready(self):
        return self.root.is_dir() and os.access(self.root, os.W_OK)


class S3Store:
    name = 's3'

    def __init__(self, client=None, bucket=None):
        self.bucket = bucket or os.getenv('OMNIRA_S3_BUCKET', '')
        if not self.bucket:
            raise RuntimeError('OMNIRA_S3_BUCKET is required for S3 storage')
        if client is None:
            import boto3
            from botocore.config import Config
            kwargs = {'region_name': os.getenv('OMNIRA_S3_REGION', 'us-east-1'),
                      'config': Config(signature_version='s3v4', connect_timeout=5, read_timeout=30,
                                       retries={'max_attempts': 2}, s3={'addressing_style': os.getenv('OMNIRA_S3_ADDRESSING_STYLE', 'auto')})}
            endpoint = os.getenv('OMNIRA_S3_ENDPOINT')
            if endpoint:
                kwargs['endpoint_url'] = endpoint
            # AWS's normal credential chain supports instance roles as well as
            # AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY environment variables.
            client = boto3.client('s3', **kwargs)
        self.client = client

    def put(self, key, data, content_type):
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)

    def read(self, key):
        return self.client.get_object(Bucket=self.bucket, Key=key)['Body']

    def delete(self, key):
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def ready(self):
        self.client.head_bucket(Bucket=self.bucket)
        return True


def get_store(name=None):
    name = name or os.getenv('OMNIRA_STORAGE_BACKEND', 'local')
    if name == 'local':
        return LocalStore()
    if name == 's3':
        return S3Store()
    raise RuntimeError('OMNIRA_STORAGE_BACKEND must be local or s3')
