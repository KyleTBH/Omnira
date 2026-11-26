from .db import init_db
from .platform_db import init_platform_db
from .security import migrate_passwords

if __name__ == '__main__':
    init_db()
    init_platform_db()
    migrate_passwords()
    print('Omnira schema and password migration completed')
