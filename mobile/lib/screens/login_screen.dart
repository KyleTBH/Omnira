import 'package:flutter/material.dart';
import '../services/api.dart';
import '../theme.dart';
import 'shell_screen.dart';

class LoginScreen extends StatefulWidget { const LoginScreen({super.key}); @override State<LoginScreen> createState()=>_LoginScreenState(); }
class _LoginScreenState extends State<LoginScreen> {
  String email='student@omnira.test';
  final password=TextEditingController(text:'demo123');
  bool busy=false;
  @override void dispose(){password.dispose();super.dispose();}
  Future<void> signIn() async {
    setState(()=>busy=true);
    try { final user=await Api.login(email,password.text); if(!mounted)return; Navigator.pushReplacement(context,MaterialPageRoute(builder:(_)=>ShellScreen(user:user))); }
    catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('$e')));}
    finally{if(mounted)setState(()=>busy=false);}
  }
  @override Widget build(BuildContext context)=>Scaffold(body:SafeArea(child:Center(child:SingleChildScrollView(padding:const EdgeInsets.all(28),child:ConstrainedBox(constraints:const BoxConstraints(maxWidth:420),child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
    Container(padding:const EdgeInsets.all(22),decoration:BoxDecoration(color:Colors.white,borderRadius:BorderRadius.circular(25)),child:Image.asset('assets/logo.png',height:135,fit:BoxFit.contain)),
    const SizedBox(height:28),const Text('Welcome to Omnira',style:TextStyle(fontSize:28,fontWeight:FontWeight.bold,color:navy)),const SizedBox(height:7),const Text('Your unified smart campus app.'),const SizedBox(height:26),
    DropdownButtonFormField<String>(value:email,decoration:const InputDecoration(labelText:'Demo account'),items:const [DropdownMenuItem(value:'student@omnira.test',child:Text('Student')),DropdownMenuItem(value:'professor@omnira.test',child:Text('Professor')),DropdownMenuItem(value:'admin@omnira.test',child:Text('Admin'))],onChanged:(v)=>setState(()=>email=v!)),
    const SizedBox(height:14),TextField(controller:password,obscureText:true,decoration:const InputDecoration(labelText:'Password')),
    const SizedBox(height:22),FilledButton(onPressed:busy?null:signIn,child:Text(busy?'Signing in…':'Sign in')),
    const SizedBox(height:12),const Text('Demo password: demo123',textAlign:TextAlign.center,style:TextStyle(color:Colors.grey))
  ]))))));
}
