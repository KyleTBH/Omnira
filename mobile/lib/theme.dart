import 'package:flutter/material.dart';

const navy = Color(0xFF19345C);
const sky = Color(0xFF72B7E8);
const orange = Color(0xFFF59A4A);
const canvas = Color(0xFFF4F8FC);

final omniraTheme = ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(seedColor: navy, primary: navy, secondary: orange, surface: Colors.white),
  scaffoldBackgroundColor: canvas,
  appBarTheme: const AppBarTheme(backgroundColor: canvas, foregroundColor: navy, elevation: 0),
  cardTheme: CardThemeData(color: Colors.white, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20))),
  inputDecorationTheme: InputDecorationTheme(filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none)),
  filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(backgroundColor: orange, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 15, horizontal: 20), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(13)))),
);
