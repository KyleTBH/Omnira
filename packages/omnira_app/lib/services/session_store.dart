import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SessionStore {
  static const _storage = FlutterSecureStorage();
  static Future<void> save(String server, Map<String, dynamic> user) =>
      _storage.write(key: 'omnira-session', value: jsonEncode({'server': server, 'user': user}));
  static Future<Map<String, dynamic>?> restore(String server) async {
    final saved = await _storage.read(key: 'omnira-session');
    if (saved == null) return null;
    final value = jsonDecode(saved) as Map<String, dynamic>;
    if (value['server'] != server) return null;
    return Map<String, dynamic>.from(value['user'] as Map);
  }
  static Future<void> clear() => _storage.delete(key: 'omnira-session');
}
