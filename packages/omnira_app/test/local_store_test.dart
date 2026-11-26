import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnira_app/services/local_store.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  sqfliteFfiInit();
  late Directory directory;
  late LocalStore store;
  setUp(() async {
    directory = await Directory.systemTemp.createTemp('omnira-store-test');
    store = await LocalStore.openAt('${directory.path}/local.sqlite', directory, factory: databaseFactoryFfi);
  });
  tearDown(() async { await store.close(); await directory.delete(recursive:true); });
  Map<String,dynamic> remote(String id, String title, int version, {bool deleted=false}) => {
    'entity':'note','record_id':id,'body':{'title':title,'text':'content'},'version':version,'deleted':deleted,
  };
  test('offline edits and outbox survive closing and reopening SQLite', () async {
    final id=uuid.v4();
    await store.saveRecord('note',id,{'title':'Offline note','text':'Draft'});
    final op=(await store.pending()).single['operation_id'];
    await store.close();
    store=await LocalStore.openAt('${directory.path}/local.sqlite',directory,factory:databaseFactoryFfi);
    expect((await store.pending()).single['operation_id'],op);
    expect(jsonDecode((await store.records('note')).single['body'] as String)['title'],'Offline note');
  });
  test('an acknowledgment cannot overwrite a newer in-flight local edit', () async {
    final id=uuid.v4();
    await store.saveRecord('note',id,{'title':'First'});
    final sent=(await store.pending()).single;
    await store.saveRecord('note',id,{'title':'Second'});
    await store.acknowledge(sent,remote(id,'First',3));
    final next=(await store.pending()).single;
    expect(next['base_version'],3);
    expect(jsonDecode(next['body'] as String)['title'],'Second');
    expect(next['operation_id'],isNot(sent['operation_id']));
  });
  test('remote deletion is retained as a tombstone and advances cursor', () async {
    final id=uuid.v4();
    await store.applyPull([remote(id,'Deleted',8,deleted:true)],8);
    expect(await store.records('note'),isEmpty);
    expect(await store.cursor(),8);
    expect((await store.db.query('records')).single['deleted'],1);
  });
  test('conflicts preserve local edits until the user chooses a version', () async {
    final id=uuid.v4();
    await store.applyPull([remote(id,'Original',1)],1);
    await store.saveRecord('note',id,{'title':'My edit'});
    await store.applyPull([remote(id,'Another device',2)],2);
    expect((await store.conflicts()).length,1);
    expect(jsonDecode((await store.records('note')).single['body'] as String)['title'],'My edit');
    await store.resolve('note',id,keepLocal:true);
    expect((await store.pending()).single['base_version'],2);
    expect(await store.conflicts(),isEmpty);
  });
  test('accepting the server resolves without creating another upload', () async {
    final id=uuid.v4();
    await store.saveRecord('note',id,{'title':'Mine'});
    await store.markConflict((await store.pending()).single,remote(id,'Theirs',4));
    await store.resolve('note',id,keepLocal:false);
    expect(await store.pending(),isEmpty);
    expect(jsonDecode((await store.records('note')).single['body'] as String)['title'],'Theirs');
  });
  test('queued files are copied into persistent application storage', () async {
    final source=File('${directory.path}/original.txt');await source.writeAsString('File bytes');
    await store.enqueueFile(source.path);
    await source.delete();
    final file=(await store.pendingFiles()).single;
    expect(await File(file['local_path'] as String).readAsString(),'File bytes');
    expect(file['sha256'],isNotNull);
  });
  test('server refresh does not erase a pending local upload or deletion', () async {
    final source=File('${directory.path}/test.txt');await source.writeAsString('Bytes');
    final id=await store.enqueueFile(source.path);
    await store.deleteFile(id);
    await store.mergeFiles([{'file_id':id,'filename':'test.txt','media_type':'text/plain','size_bytes':5,'sha256':'abc','created_at':'now','deleted':0}]);
    expect((await store.pendingFiles()).single['state'],'deleting');
  });
}
