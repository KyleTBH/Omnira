import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;
import 'local_store.dart';
import 'session_store.dart';

const _configuredBase = String.fromEnvironment('API_BASE_URL');
String get apiBase => _configuredBase.isNotEmpty
    ? _configuredBase.replaceFirst(RegExp(r'/+$'), '')
    : Platform.isAndroid ? 'http://10.0.2.2:8080' : 'http://127.0.0.1:8080';

class ApiException implements Exception {
  final int status;
  final String message;
  ApiException(this.status, this.message);
  @override String toString() => message;
}

class Api {
  final Map<String, dynamic> user;
  final LocalStore store;
  final http.Client _client;
  late final SyncController sync;
  bool showingCachedData = false;
  int get userId => user['id'] as int;
  String get token => user['token'] as String;
  Map<String, String> get headers => {'Authorization': 'Bearer $token'};

  Api._(this.user, this.store, this._client) {
    sync = SyncController(this);
  }

  static Future<Api> open(Map<String, dynamic> user) async {
    final local = await LocalStore.open(apiBase, user['id'] as int);
    final api = Api._(user, local, http.Client());
    api.sync.start();
    return api;
  }

  static Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await http.post(Uri.parse('$apiBase/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email.trim(), 'password': password}))
      .timeout(const Duration(seconds: 15));
    final user = Map<String, dynamic>.from(_decode(response) as Map);
    await SessionStore.save(apiBase, user);
    return user;
  }

  static dynamic _decode(http.Response response) {
    dynamic data;
    try { data = jsonDecode(response.body); }
    catch (_) { throw ApiException(response.statusCode, 'The server returned an unreadable response.'); }
    if (response.statusCode >= 400) {
      final detail = data is Map ? data['detail'] : null;
      throw ApiException(response.statusCode, detail is String ? detail : 'Please check your request and try again.');
    }
    return data;
  }

  Future<dynamic> request(String method, String path, [Map<String, dynamic>? body]) async {
    final request = http.Request(method, Uri.parse('$apiBase$path'));
    request.headers.addAll({...headers, 'Content-Type': 'application/json'});
    if (body != null) request.body = jsonEncode(body);
    final streamed = await _client.send(request).timeout(const Duration(seconds: 15));
    final response = await http.Response.fromStream(streamed).timeout(const Duration(seconds: 30));
    return _decode(response);
  }

  Future<dynamic> get(String path) async {
    try {
      final result = await request('GET', path);
      await store.cache(path, result);
      showingCachedData = false;
      return result;
    } on ApiException {
      rethrow; // Authentication and permission errors never fall back to cache.
    } catch (_) {
      final cached = await store.cached(path);
      if (cached == null) rethrow;
      showingCachedData = true;
      return cached;
    }
  }

  // Reservations, billing, grades and lab sessions must be validated online.
  Future<dynamic> post(String path, [Map<String, dynamic>? body]) => request('POST', path, body ?? {});

  Future<void> uploadFile(Map<String, Object?> file) async {
    final path = file['local_path'] as String?;
    if (path == null || !await File(path).exists()) throw ApiException(422, 'The local upload file is missing. Choose the file again.');
    final request = http.MultipartRequest('POST', Uri.parse('$apiBase/cloud/files'));
    request.headers.addAll(headers);
    request.fields['file_id'] = file['file_id'] as String;
    if (file['folder_id'] != null) request.fields['folder_id'] = file['folder_id'] as String;
    request.files.add(await http.MultipartFile.fromPath('file', path, filename: file['filename'] as String));
    final response = await http.Response.fromStream(await _client.send(request).timeout(const Duration(seconds: 60))).timeout(const Duration(seconds: 60));
    final remote = Map<String, dynamic>.from(_decode(response) as Map);
    // Preserve a delete requested while this upload was in flight.
    await store.db.update('files', {'state': 'uploaded', 'error': null}, where: 'file_id=? AND state!=?', whereArgs: [remote['file_id'], 'deleting']);
  }

  Future<String> localFile(Map<String, Object?> file) async {
    final cached = file['local_path'] as String?;
    if (cached != null && await File(cached).exists()) return cached;
    final response = await _client.get(Uri.parse('$apiBase/cloud/files/${file['file_id']}/content'), headers: headers).timeout(const Duration(seconds: 60));
    if (response.statusCode >= 400) _decode(response);
    final digest = sha256.convert(response.bodyBytes).toString();
    if (file['sha256'] != null && digest != file['sha256']) throw ApiException(502, 'Download checksum did not match. Please retry.');
    final path = p.join(store.directory.path, '${file['file_id']}-download');
    await File(path).writeAsBytes(response.bodyBytes, flush: true);
    await store.db.update('files', {'local_path': path}, where: 'file_id=?', whereArgs: [file['file_id']]);
    return path;
  }

  Future<void> logout() async {
    sync.stop();
    try { await request('POST', '/auth/logout').timeout(const Duration(seconds: 3)); } catch (_) { /* Revocation needs connectivity; local sign-out still proceeds. */ }
    await SessionStore.clear();
  }

  Future<void> dispose() async {
    sync.stop();
    _client.close();
    // Let in-flight sync finish before closing its SQLite connection.
    await sync.finished;
    await store.close();
    sync.dispose();
  }
}

class SyncController extends ChangeNotifier with WidgetsBindingObserver {
  final Api api;
  Timer? _timer;
  bool busy = false, offline = false, authRequired = false, _stopped = false;
  String? error;
  int pendingChanges = 0, conflictCount = 0;
  DateTime? lastSuccess;
  Future<void> _finished = Future<void>.value();
  Future<void> get finished => _finished;
  SyncController(this.api);

  void start() {
    WidgetsBinding.instance.addObserver(this);
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => unawaited(run()));
    unawaited(run());
  }
  @override void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) unawaited(run());
  }
  void stop() {
    _stopped = true;
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
  }
  void _notify() { if (!_stopped) notifyListeners(); }

  Future<void> run() {
    if (busy || _stopped || authRequired) return _finished;
    _finished = _run();
    return _finished;
  }

  Future<void> _run() async {
    busy = true; error = null; _notify();
    try {
      for (var batch = 0; batch < 10 && !_stopped; batch++) {
        final pending = await api.store.pending();
        if (pending.isEmpty) break;
        final response = await api.request('POST', '/sync/push', {'changes': pending.map(api.store.mutation).toList()}) as Map;
        final results = response['results'] as List;
        for (var i = 0; i < pending.length; i++) {
          final result = Map<String, dynamic>.from(results[i] as Map);
          if (result['status'] == 'applied') {
            await api.store.acknowledge(pending[i], Map<String, dynamic>.from(result['record'] as Map));
          } else {
            await api.store.markConflict(pending[i], result['server']);
          }
        }
      }
      var more = true;
      while (more && !_stopped) {
        final cursor = await api.store.cursor();
        final response = await api.request('GET', '/sync/pull?after=$cursor') as Map;
        await api.store.applyPull(response['records'] as List, response['cursor'] as int);
        more = response['has_more'] == true;
      }
      if (_stopped) return;
      for (final file in await api.store.pendingFiles()) {
        if (_stopped) break;
        try {
          if (file['state'] == 'deleting') {
            // If upload never reached the server, 404 is already deleted.
            try { await api.request('DELETE', '/cloud/files/${file['file_id']}'); }
            on ApiException catch (e) { if (e.status != 404) rethrow; }
            await api.store.db.update('files', {'state': 'deleted', 'error': null}, where: 'file_id=?', whereArgs: [file['file_id']]);
            final path = file['local_path'] as String?;
            if (path != null && await File(path).exists()) await File(path).delete();
          } else {
            await api.uploadFile(file);
          }
        } on ApiException catch (e) {
          if (e.status == 401 || e.status == 403) rethrow;
          await api.store.db.update('files', {'state': file['state'] == 'deleting' ? 'deleting' : e.status < 500 ? 'blocked' : 'failed', 'error': e.message}, where: file['state'] == 'deleting' ? 'file_id=?' : "file_id=? AND state!='deleting'", whereArgs: [file['file_id']]);
        } catch (_) {
          // Keep pending bytes on disk for a later reconnect, never mark synced.
          rethrow;
        }
      }
      if (_stopped) return;
      int? offset = 0;
      while (offset != null && !_stopped) {
        final response = await api.request('GET', '/cloud/files?include_deleted=true&limit=100&offset=$offset') as Map;
        await api.store.mergeFiles(response['files'] as List);
        offset = response['next_offset'] as int?;
      }
      lastSuccess = DateTime.now(); offline = false;
    } on ApiException catch (e) {
      authRequired = e.status == 401 || e.status == 403;
      error = e.message; offline = false;
    } catch (_) {
      offline = true;
      error = 'Cannot reach the server. Your changes remain saved on this device.';
    } finally {
      try {
        final records = await api.store.db.rawQuery('SELECT COUNT(*) AS total FROM outbox');
        final files = await api.store.db.rawQuery("SELECT COUNT(*) AS total FROM files WHERE state NOT IN ('uploaded','deleted')");
        final conflicts = await api.store.db.rawQuery('SELECT COUNT(*) AS total FROM outbox WHERE conflict IS NOT NULL');
        pendingChanges = (records.first['total'] as int) + (files.first['total'] as int);
        conflictCount = conflicts.first['total'] as int;
      } catch (_) { /* Disposal can stop status updates. */ }
      busy = false; _notify();
    }
  }
}
