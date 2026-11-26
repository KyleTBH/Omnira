import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api.dart';
import '../theme.dart';
import 'login_screen.dart';
import 'pages.dart';
import 'workspace_screen.dart';

class ShellScreen extends StatefulWidget {
  final Map<String,dynamic> user;
  final Api api;
  const ShellScreen({super.key,required this.user,required this.api});
  @override State<ShellScreen> createState()=>_ShellScreenState();
}
class _ShellScreenState extends State<ShellScreen> {
  String page='Home';
  bool signingOut=false;
  Api get api=>widget.api;
  List<String> get pages=>switch(widget.user['role']){
    'student'=>['Home','Workspace','Computers','Reservations','Sessions','Printing','Payments','AI Reviewer'],
    'professor'=>['Home','Workspace','Reservations','Printing','Analytics','AI Reviewer'],
    _=>['Home','Workspace','Computers','Reservations','Sessions','Printing','Payments','Maintenance','Analytics']
  };
  IconData glyph(String name)=>switch(name){
    'Home'=>Icons.home_outlined,'Workspace'=>Icons.cloud_outlined,'Computers'=>Icons.computer,
    'Reservations'=>Icons.event_available,'Sessions'=>Icons.timer_outlined,'Printing'=>Icons.print_outlined,
    'Payments'=>Icons.receipt_long,'Maintenance'=>Icons.build_outlined,'Analytics'=>Icons.bar_chart,
    _=>Icons.auto_awesome_outlined,
  };
  @override void dispose(){unawaited(api.dispose());super.dispose();}
  Future<void> signOut()async{
    if(signingOut)return;
    setState(()=>signingOut=true);
    try{await api.logout();if(!mounted)return;Navigator.pushAndRemoveUntil(context,MaterialPageRoute(builder:(_)=>const LoginScreen()),(_)=>false);}
    catch(e){if(mounted){setState(()=>signingOut=false);ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('$e')));}}
  }
  Widget syncBar()=>AnimatedBuilder(animation:api.sync,builder:(context,_)=>Container(
    color:api.sync.authRequired?const Color(0xFFFFEAE6):api.sync.offline?const Color(0xFFFFF2E5):const Color(0xFFEAF5FC),
    padding:const EdgeInsets.symmetric(horizontal:18,vertical:9),
    child:Row(children:[Icon(api.sync.authRequired?Icons.lock_outline:api.sync.offline?Icons.cloud_off_outlined:Icons.cloud_done_outlined,size:18,color:navy),const SizedBox(width:10),Expanded(child:Text(api.sync.authRequired?'Session expired. Sign out and sign in again.':api.sync.busy?'Syncing saved changes…':api.sync.error??(api.sync.conflictCount>0?'${api.sync.conflictCount} conflict(s) · open Workspace to resolve':api.sync.pendingChanges>0?'${api.sync.pendingChanges} change(s) waiting to sync':api.sync.lastSuccess==null?'Connecting…':'Connected · changes sync automatically'),style:const TextStyle(fontSize:12))),TextButton(onPressed:api.sync.busy?null:()=>unawaited(api.sync.run()),child:const Text('Sync now'))]),
  ));
  @override Widget build(BuildContext context){
    final wide=MediaQuery.sizeOf(context).width>=1000;
    final selected=pages.indexOf(page);
    final content=page=='Workspace'?WorkspaceScreen(api:api):OmniraPage(key:ValueKey(page),name:page,api:api,user:widget.user,onNavigate:(name)=>setState(()=>page=name));
    return Scaffold(
      appBar:AppBar(title:Text(page,style:const TextStyle(fontWeight:FontWeight.bold)),actions:[Padding(padding:const EdgeInsets.only(right:12),child:Center(child:Text(widget.user['name'] as String))),IconButton(tooltip:'Sign out',onPressed:signingOut?null:signOut,icon:const Icon(Icons.logout))]),
      drawer:wide?null:Drawer(child:SafeArea(child:Column(children:[Padding(padding:const EdgeInsets.all(20),child:Image.asset('assets/logo.png',package:'omnira_app',height:70)),Expanded(child:ListView(children:pages.map((name)=>ListTile(leading:Icon(glyph(name)),title:Text(name),selected:page==name,onTap:(){setState(()=>page=name);Navigator.pop(context);})).toList()))]))),
      body:Row(children:[
        if(wide)NavigationRail(extended:true,minExtendedWidth:220,selectedIndex:selected,onDestinationSelected:(i)=>setState(()=>page=pages[i]),destinations:pages.map((name)=>NavigationRailDestination(icon:Icon(glyph(name)),label:Text(name))).toList()),
        if(wide)const VerticalDivider(width:1),
        Expanded(child:Column(children:[syncBar(),Expanded(child:Center(child:ConstrainedBox(constraints:const BoxConstraints(maxWidth:1250),child:content)))])),
      ]),
      bottomNavigationBar:wide?null:NavigationBar(selectedIndex:page=='Workspace'?1:page=='Reservations'?2:0,onDestinationSelected:(i)=>setState(()=>page=['Home','Workspace','Reservations'][i]),destinations:const[NavigationDestination(icon:Icon(Icons.home_outlined),label:'Home'),NavigationDestination(icon:Icon(Icons.cloud_outlined),label:'Workspace'),NavigationDestination(icon:Icon(Icons.event_available),label:'Bookings')]),
    );
  }
}
