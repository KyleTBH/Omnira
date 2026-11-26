import 'package:flutter/material.dart';
import '../services/api.dart';
import '../theme.dart';
import 'shell_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override State<LoginScreen> createState()=>_LoginScreenState();
}
class _LoginScreenState extends State<LoginScreen> {
  final form=GlobalKey<FormState>();
  final email=TextEditingController();
  final password=TextEditingController();
  bool busy=false,showPassword=false;
  String? error;
  @override void dispose(){email.dispose();password.dispose();super.dispose();}
  Future<void> signIn()async{
    if(busy || !form.currentState!.validate())return;
    setState((){busy=true;error=null;});
    try{
      final user=await Api.login(email.text,password.text);
      final api=await Api.open(user);
      if(!mounted){await api.dispose();return;}
      Navigator.pushReplacement(context,MaterialPageRoute(builder:(_)=>ShellScreen(user:user,api:api)));
    }catch(e){if(mounted)setState(()=>error='$e');}
    finally{if(mounted)setState(()=>busy=false);}
  }
  Widget fields()=>SingleChildScrollView(padding:const EdgeInsets.all(32),child:Center(child:ConstrainedBox(constraints:const BoxConstraints(maxWidth:410),child:Form(key:form,child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
    Align(alignment:Alignment.centerLeft,child:Image.asset('assets/logo.png',package:'omnira_app',height:70,width:190,fit:BoxFit.contain)),
    const SizedBox(height:34),const Text('Welcome back.',style:TextStyle(fontSize:34,fontWeight:FontWeight.bold,color:navy)),
    const SizedBox(height:8),const Text('Your campus, connected. Sign in to continue.'),const SizedBox(height:28),
    TextFormField(controller:email,keyboardType:TextInputType.emailAddress,autofillHints:const[AutofillHints.username],decoration:const InputDecoration(labelText:'Email address',prefixIcon:Icon(Icons.mail_outline)),validator:(value)=>value==null||!value.contains('@')?'Enter your email address.':null),
    const SizedBox(height:16),TextFormField(controller:password,obscureText:!showPassword,autofillHints:const[AutofillHints.password],onFieldSubmitted:(_)=>signIn(),decoration:InputDecoration(labelText:'Password',prefixIcon:const Icon(Icons.lock_outline),suffixIcon:IconButton(tooltip:showPassword?'Hide password':'Show password',onPressed:()=>setState(()=>showPassword=!showPassword),icon:Icon(showPassword?Icons.visibility_off_outlined:Icons.visibility_outlined))),validator:(value)=>value==null||value.isEmpty?'Enter your password.':null),
    if(error!=null)Padding(padding:const EdgeInsets.only(top:16),child:Text(error!,style:const TextStyle(color:Colors.red))),
    const SizedBox(height:22),FilledButton(onPressed:busy?null:signIn,child:Text(busy?'Signing in…':'Log in to Omnira')),
    const SizedBox(height:20),Text('API: $apiBase',style:const TextStyle(fontSize:11,color:Colors.grey)),
    const SizedBox(height:8),const Text('After your first sign-in, a saved session lets you reopen cached workspace data offline.',style:TextStyle(fontSize:11,color:Colors.grey)),
  ])))));
  @override Widget build(BuildContext context)=>Scaffold(body:SafeArea(child:LayoutBuilder(builder:(context,constraints){
    if(constraints.maxWidth<900)return fields();
    return Row(children:[Expanded(child:Container(color:navy,padding:const EdgeInsets.all(64),child:const Column(mainAxisAlignment:MainAxisAlignment.center,crossAxisAlignment:CrossAxisAlignment.start,children:[Icon(Icons.hub_outlined,size:64,color:sky),SizedBox(height:30),Text('One campus.\nAll connected.',style:TextStyle(fontSize:48,height:1.1,fontWeight:FontWeight.bold,color:Colors.white)),SizedBox(height:22),Text('Your study tools, private files, and everyday campus essentials—ready wherever you work.',style:TextStyle(fontSize:16,height:1.7,color:Colors.white70)),SizedBox(height:38),Text('MOBILE + DESKTOP · OFFLINE READY',style:TextStyle(fontSize:10,letterSpacing:2,color:sky))]))),Expanded(child:fields())]);
  })));
}
