import 'package:flutter/material.dart';
import '../services/api.dart';
import '../theme.dart';
import 'login_screen.dart';
import 'pages.dart';

class ShellScreen extends StatefulWidget {
  final Map<String,dynamic> user;
  const ShellScreen({super.key,required this.user});
  @override State<ShellScreen> createState()=>_ShellScreenState();
}
class _ShellScreenState extends State<ShellScreen> {
  String page='Home';
  late final Api api=Api(widget.user['id'] as int);
  List<String> get pages=>switch(widget.user['role']){
    'student'=>['Home','Computers','Reservations','Sessions','Printing','Payments','AI Reviewer'],
    'professor'=>['Home','Reservations','Printing','Analytics','AI Reviewer'],
    _=>['Home','Computers','Reservations','Sessions','Printing','Payments','Maintenance','Analytics']
  };
  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:Text(page,style:const TextStyle(fontWeight:FontWeight.bold)),actions:[Padding(padding:const EdgeInsets.only(right:14),child:CircleAvatar(backgroundColor:sky,child:Text((widget.user['name'] as String)[0],style:const TextStyle(color:navy))))]),
    drawer:Drawer(child:SafeArea(child:Column(children:[Padding(padding:const EdgeInsets.all(20),child:Image.asset('assets/logo.png',height:90)),Text(widget.user['name'],style:const TextStyle(fontWeight:FontWeight.bold)),Text(widget.user['role']),const Divider(),Expanded(child:ListView(children:pages.map((name)=>ListTile(title:Text(name),selected:page==name,onTap:(){setState(()=>page=name);Navigator.pop(context);})).toList())),ListTile(title:const Text('Sign out'),leading:const Icon(Icons.logout),onTap:()=>Navigator.pushAndRemoveUntil(context,MaterialPageRoute(builder:(_)=>const LoginScreen()),(_)=>false))]))),
    body:OmniraPage(key:ValueKey(page),name:page,api:api,user:widget.user,onNavigate:(name)=>setState(()=>page=name)),
    bottomNavigationBar:NavigationBar(selectedIndex:['Home','Computers','Reservations','Printing','Payments'].indexOf(page).clamp(0,4),onDestinationSelected:(i)=>setState(()=>page=['Home','Computers','Reservations','Printing','Payments'][i]),destinations:const [NavigationDestination(icon:Icon(Icons.home_outlined),label:'Home'),NavigationDestination(icon:Icon(Icons.computer),label:'Labs'),NavigationDestination(icon:Icon(Icons.event_available),label:'Book'),NavigationDestination(icon:Icon(Icons.print_outlined),label:'Print'),NavigationDestination(icon:Icon(Icons.receipt_long),label:'Bills')]),
  );
}
