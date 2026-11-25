import 'package:flutter/material.dart';
import 'screens/login_screen.dart';
import 'theme.dart';

void main() => runApp(const OmniraApp());

class OmniraApp extends StatelessWidget {
  const OmniraApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Omnira', debugShowCheckedModeBanner: false,
    theme: omniraTheme,
    home: const LoginScreen(),
  );
}
