import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart' as ffi;
import 'package:uuid/uuid.dart';

const uuid = Uuid();

/// Each server/account has its own database and private file cache.
class LocalStore {
  final Database db;
  final Directory directory;
  LocalStore._(this.db, this.directory);

  static Future<LocalStore> open(String server, int userId) async {
    final support = await getApplicationSupportDirectory();
    final serverId = sha256.convert(utf8.encode(server)).toString().substring(0, 16);
    final directory = Directory(p.join(support.path, 'omnira', serverId, '$userId'));
    await directory.create(recursive: true);
    return openAt(p.join(directory.path, 'device.sqlite'), directory);
  }

  /// Also used by SQLite unit tests; no platform paths or network required.
  static Future<LocalStore> openAt(String databasePath, Directory directory,
      {DatabaseFactory? factory}) async {
    if (factory == null) {
      if (Platform.isWindows || Platform.isLinux) {
        ffi.sqfliteFfiInit();
        factory = ffi.databaseFactoryFfi;
      } else {
        factory = databaseFactory;
      }
    }
    final db = await factory.openDatabase(databasePath, options: OpenDatabaseOptions(
      version: 1,
      onCreate: (db, version) async {
        await db.execute('CREATE TABLE records(entity TEXT NOT NULL, record_id TEXT NOT NULL, body TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(entity,record_id))');
        await db.execute('CREATE TABLE outbox(entity TEXT NOT NULL, record_id TEXT NOT NULL, operation_id TEXT NOT NULL, base_version INTEGER NOT NULL, body TEXT NOT NULL, deleted INTEGER NOT NULL, conflict TEXT, PRIMARY KEY(entity,record_id))');
        await db.execute('CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL)');
        await db.execute('CREATE TABLE api_cache(path TEXT PRIMARY KEY, body TEXT NOT NULL, saved_at TEXT NOT NULL)');
        await db.execute('CREATE TABLE files(file_id TEXT PRIMARY KEY, folder_id TEXT, filename TEXT NOT NULL, local_path TEXT, media_type TEXT NOT NULL, size_bytes INTEGER NOT NULL, sha256 TEXT, state TEXT NOT NULL, error TEXT, deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)');
      },
    ));
    return LocalStore._(db, directory);
  }

  Future<List<Map<String, Object?>>> records(String entity) => db.rawQuery('''
    SELECT r.*, o.operation_id, o.conflict FROM records r
    LEFT JOIN outbox o ON o.entity=r.entity AND o.record_id=r.record_id
    WHERE r.entity=? AND r.deleted=0 ORDER BY r.record_id''', [entity]);

  Future<void> saveRecord(String entity, String id, Map<String, dynamic> body,
      {bool deleted = false}) async {
    await db.transaction((tx) async {
      final previous = await tx.query('records', where: 'entity=? AND record_id=?', whereArgs: [entity, id]);
      final version = previous.isEmpty ? 0 : previous.first['version'] as int;
      final payload = jsonEncode(body);
      await tx.insert('records', {'entity': entity, 'record_id': id, 'body': payload, 'version': version, 'deleted': deleted ? 1 : 0}, conflictAlgorithm: ConflictAlgorithm.replace);
      // A new operation ID protects against an old, delayed network response.
      await tx.insert('outbox', {'entity': entity, 'record_id': id, 'operation_id': uuid.v4(), 'base_version': version, 'body': payload, 'deleted': deleted ? 1 : 0}, conflictAlgorithm: ConflictAlgorithm.replace);
    });
  }

  Future<List<Map<String, Object?>>> conflicts() => db.query('outbox', where: 'conflict IS NOT NULL');

  Future<List<Map<String, Object?>>> pending() => db.query('outbox', where: 'conflict IS NULL', limit: 100);

  Map<String, dynamic> mutation(Map<String, Object?> row) => {
    'entity': row['entity'], 'record_id': row['record_id'],
    'operation_id': row['operation_id'], 'base_version': row['base_version'],
    'body': jsonDecode(row['body'] as String), 'deleted': row['deleted'] == 1,
  };

  Future<void> acknowledge(Map<String, Object?> sent, Map<String, dynamic> server) async {
    await db.transaction((tx) async {
      final args = [sent['entity'], sent['record_id']];
      final queued = await tx.query('outbox', where: 'entity=? AND record_id=?', whereArgs: args);
      if (queued.isNotEmpty && queued.first['operation_id'] != sent['operation_id']) {
        // The user edited while this request was in flight. Preserve that edit,
        // but rebase its fresh operation on the version just acknowledged.
        await tx.update('records', {'version': server['version']}, where: 'entity=? AND record_id=?', whereArgs: args);
        await tx.update('outbox', {'base_version': server['version']}, where: 'entity=? AND record_id=?', whereArgs: args);
        return;
      }
      await _writeServer(tx, server);
      await tx.delete('outbox', where: 'entity=? AND record_id=? AND operation_id=?', whereArgs: [...args, sent['operation_id']]);
    });
  }

  static Future<void> _writeServer(DatabaseExecutor tx, Map<String, dynamic> server) async {
    await tx.insert('records', {'entity': server['entity'], 'record_id': server['record_id'], 'body': jsonEncode(server['body']), 'version': server['version'], 'deleted': server['deleted'] == true ? 1 : 0}, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<void> markConflict(Map<String, Object?> sent, dynamic server) async {
    await db.update('outbox', {'conflict': jsonEncode(server)},
      where: 'entity=? AND record_id=?', whereArgs: [sent['entity'], sent['record_id']]);
  }

  Future<void> applyPull(List<dynamic> records, int cursor) async {
    await db.transaction((tx) async {
      for (final value in records) {
        final server = Map<String, dynamic>.from(value as Map);
        final args = [server['entity'], server['record_id']];
        final dirty = await tx.query('outbox', where: 'entity=? AND record_id=?', whereArgs: args);
        if (dirty.isNotEmpty) {
          if ((server['version'] as int) > (dirty.first['base_version'] as int)) {
            await tx.update('outbox', {'conflict': jsonEncode(server)}, where: 'entity=? AND record_id=?', whereArgs: args);
          }
        } else {
          await _writeServer(tx, server);
        }
      }
      // Persist changes and the cursor in one SQLite transaction.
      await tx.insert('settings', {'key': 'cursor', 'value': '$cursor'}, conflictAlgorithm: ConflictAlgorithm.replace);
    });
  }

  Future<void> resolve(String entity, String id, {required bool keepLocal}) async {
    await db.transaction((tx) async {
      final args = [entity, id];
      final rows = await tx.query('outbox', where: 'entity=? AND record_id=?', whereArgs: args);
      if (rows.isEmpty || rows.first['conflict'] == null) return;
      final local = rows.first;
      final remote = jsonDecode(local['conflict'] as String) as Map<String, dynamic>?;
      if (keepLocal) {
        await tx.update('outbox', {'operation_id': uuid.v4(), 'base_version': remote?['version'] ?? 0, 'conflict': null}, where: 'entity=? AND record_id=?', whereArgs: args);
        await tx.update('records', {'version': remote?['version'] ?? 0}, where: 'entity=? AND record_id=?', whereArgs: args);
      } else {
        if (remote != null) {
          await _writeServer(tx, remote);
        } else {
          await tx.delete('records', where: 'entity=? AND record_id=?', whereArgs: args);
        }
        await tx.delete('outbox', where: 'entity=? AND record_id=?', whereArgs: args);
      }
    });
  }

  Future<int> cursor() async {
    final rows = await db.query('settings', where: 'key=?', whereArgs: ['cursor']);
    return rows.isEmpty ? 0 : int.parse(rows.first['value'] as String);
  }

  Future<void> cache(String path, dynamic body) async {
    await db.insert('api_cache', {'path': path, 'body': jsonEncode(body), 'saved_at': DateTime.now().toUtc().toIso8601String()}, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<dynamic> cached(String path) async {
    final rows = await db.query('api_cache', where: 'path=?', whereArgs: [path]);
    return rows.isEmpty ? null : jsonDecode(rows.first['body'] as String);
  }

  Future<String> enqueueFile(String source, {String? folderId}) async {
    final file = File(source);
    final size = await file.length();
    if (size == 0 || size > 10 * 1024 * 1024) throw Exception('Choose a file between 1 byte and 10 MB.');
    final id = uuid.v4();
    final filename = p.basename(source);
    final target = File(p.join(directory.path, '$id-upload'));
    await file.copy(target.path);
    try {
      final digest = sha256.convert(await target.readAsBytes()).toString();
      await db.insert('files', {'file_id': id, 'folder_id': folderId, 'filename': filename, 'local_path': target.path, 'media_type': 'application/octet-stream', 'size_bytes': size, 'sha256': digest, 'state': 'pending', 'created_at': DateTime.now().toUtc().toIso8601String()});
    } catch (_) {
      await target.delete();
      rethrow;
    }
    return id;
  }

  Future<List<Map<String, Object?>>> files() => db.query('files', where: 'deleted=0', orderBy: 'created_at DESC');
  Future<List<Map<String, Object?>>> pendingFiles() => db.query('files', where: "state IN ('pending','failed','deleting')");

  Future<void> deleteFile(String id) async {
    await db.update('files', {'state': 'deleting', 'deleted': 1, 'error': null}, where: 'file_id=?', whereArgs: [id]);
  }

  Future<void> mergeFiles(List<dynamic> values) async {
    await db.transaction((tx) async {
      for (final value in values) {
        final row = Map<String, dynamic>.from(value as Map);
        final local = await tx.query('files', where: 'file_id=?', whereArgs: [row['file_id']]);
        if (local.isNotEmpty && ['pending', 'failed', 'deleting'].contains(local.first['state'])) continue;
        final data = <String, Object?>{...row, 'state': row['deleted'] == 1 ? 'deleted' : 'uploaded'};
        if (local.isNotEmpty) data['local_path'] = local.first['local_path'];
        await tx.insert('files', data, conflictAlgorithm: ConflictAlgorithm.replace);
      }
    });
  }

  Future<void> close() => db.close();
}
