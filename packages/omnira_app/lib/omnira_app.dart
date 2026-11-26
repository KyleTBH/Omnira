library omnira_app;

import 'package:flutter/material.dart';
import 'screens/login_screen.dart';
import 'screens/shell_screen.dart';
import 'services/api.dart';
import 'services/session_store.dart';
import 'theme.dart';

Future<void> runOmnira() async {
  WidgetsFlutterBinding.ensureInitialized();
  Map<String, dynamic>? user;
  try { user = await SessionStore.restore(apiBase); } catch (_) { user = null; }
  Api? api;
  if (user != null && user['token'] is String && user['id'] is int) {
    try { api = await Api.open(user); } catch (_) { api = null; }
  }
  runApp(OmniraApp(user: user, api: api));
}

class OmniraApp extends StatelessWidget {
  final Map<String, dynamic>? user;
  final Api? api;
  const OmniraApp({super.key, this.user, this.api});
  @override Widget build(BuildContext context) => MaterialApp(
    title: 'Omnira', debugShowCheckedModeBanner: false, theme: omniraTheme,
    home: api != null && user != null ? ShellScreen(user: user!, api: api!) : const LoginScreen(),
  );
}
