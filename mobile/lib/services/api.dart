import 'dart:convert';
import 'package:http/http.dart' as http;

const apiBase = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://10.0.2.2:8000');

class Api {
  final int userId;
  Api(this.userId);

  static Future<Map<String,dynamic>> login(String email, String password) async {
    final response = await http.post(Uri.parse('$apiBase/auth/login'), headers: {'Content-Type':'application/json'}, body: jsonEncode({'email':email,'password':password}));
    final data = jsonDecode(response.body);
    if(response.statusCode >= 400) throw Exception(data['detail'] ?? 'Sign in failed');
    return Map<String,dynamic>.from(data);
  }

  Future<dynamic> get(String path) => _request('GET', path);
  Future<dynamic> post(String path, [Map<String,dynamic>? body]) => _request('POST', path, body);

  Future<dynamic> _request(String method, String path, [Map<String,dynamic>? body]) async {
    final uri = Uri.parse('$apiBase$path');
    final headers = {'Content-Type':'application/json','X-User-Id':'$userId'};
    final response = method == 'GET' ? await http.get(uri, headers: headers) : await http.post(uri, headers: headers, body: jsonEncode(body ?? {}));
    final data = jsonDecode(response.body);
    if(response.statusCode >= 400) throw Exception(data is Map ? data['detail'] ?? 'Request failed' : 'Request failed');
    return data;
  }
}
