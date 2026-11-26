import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import '../services/api.dart';
import '../services/local_store.dart';
import '../theme.dart';

class WorkspaceScreen extends StatefulWidget {
  final Api api;
  const WorkspaceScreen({super.key, required this.api});
  @override State<WorkspaceScreen> createState() => _WorkspaceScreenState();
}

class _WorkspaceScreenState extends State<WorkspaceScreen> {
  List<Map<String, Object?>> folders = [], notes = [], tasks = [], files = [], conflicts = [];
  String? folderId;
  String? error;
  bool loading = true;
  bool _loading = false;
  bool _reloadAgain = false;
  LocalStore get store => widget.api.store;
  @override void initState() {
    super.initState();
    widget.api.sync.addListener(refresh);
    unawaited(refresh());
  }
  @override void dispose() {
    widget.api.sync.removeListener(refresh);
    super.dispose();
  }
  Future<void> refresh() async {
    if (_loading) { _reloadAgain = true; return; }
    _loading = true;
    try {
      final results = await Future.wait([store.records('folder'), store.records('note'), store.records('task'), store.files(), store.conflicts()]);
      if (mounted) setState(() { folders=results[0]; notes=results[1]; tasks=results[2]; files=results[3]; conflicts=results[4]; loading=false; });
    } catch (e) { if(mounted) setState((){error='$e';loading=false;}); }
    finally {
      _loading=false;
      if(_reloadAgain && mounted){_reloadAgain=false;unawaited(refresh());}
    }
  }
  Map<String, dynamic> body(Map<String, Object?> row) => Map<String, dynamic>.from(jsonDecode(row['body'] as String) as Map);
  Future<void> act(Future<void> Function() action) async {
    try { await action(); await refresh(); unawaited(widget.api.sync.run()); }
    catch(e){if(mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('$e')));}
  }

  Future<void> edit(String entity, [Map<String, Object?>? record]) async {
    final previous=record==null?<String,dynamic>{}:body(record);
    final title=TextEditingController(text:previous[entity=='folder'?'name':'title'] as String? ?? '');
    final text=TextEditingController(text:previous['text'] as String? ?? '');
    final saved=await showDialog<bool>(context:context,builder:(context)=>AlertDialog(
      title:Text('${record==null?'New':'Edit'} $entity'),
      content:SizedBox(width:480,child:SingleChildScrollView(child:Column(mainAxisSize:MainAxisSize.min,children:[
        TextField(controller:title,autofocus:true,maxLength:200,decoration:InputDecoration(labelText:entity=='folder'?'Folder name':'Title')),
        if(entity=='note')TextField(controller:text,minLines:5,maxLines:12,maxLength:20000,decoration:const InputDecoration(labelText:'Your notes')),
      ]))),
      actions:[TextButton(onPressed:()=>Navigator.pop(context,false),child:const Text('Cancel')),FilledButton(onPressed:(){if(title.text.trim().isNotEmpty)Navigator.pop(context,true);},child:const Text('Save on device'))],
    ));
    if(saved==true){
      await act(()=>store.saveRecord(entity,record?['record_id'] as String? ?? uuid.v4(),{
        ...previous,(entity=='folder'?'name':'title'):title.text.trim(),
        if(entity=='note')'text':text.text,
        if(entity!='folder')'folder_id':previous['folder_id'] ?? folderId,
        if(entity=='task' && !previous.containsKey('done'))'done':false,
      }));
    }
    title.dispose();text.dispose();
  }

  Future<void> remove(String entity,Map<String,Object?> record) async {
    final confirmed=await showDialog<bool>(context:context,builder:(context)=>AlertDialog(title:Text('Delete $entity?'),content:const Text('This deletion is saved on your device and will sync when connected.'),actions:[TextButton(onPressed:()=>Navigator.pop(context,false),child:const Text('Cancel')),FilledButton(onPressed:()=>Navigator.pop(context,true),child:const Text('Delete'))]));
    if(confirmed==true)await act(()=>store.saveRecord(entity,record['record_id'] as String,body(record),deleted:true));
    if(entity=='folder' && record['record_id']==folderId && mounted)setState(()=>folderId=null);
  }

  Future<void> chooseFiles() async {
    final picked=await FilePicker.platform.pickFiles(allowMultiple:true);
    if(picked==null)return;
    await act(()async{
      for(final file in picked.files){
        if(file.path==null)throw Exception('Cannot read ${file.name}. Choose a local file.');
        await store.enqueueFile(file.path!,folderId:folderId);
      }
    });
  }

  Future<void> export(Map<String,Object?> file) async {
    try{
      final local=await widget.api.localFile(file);
      final bytes=await File(local).readAsBytes();
      final target=await FilePicker.platform.saveFile(dialogTitle:'Save a copy',fileName:file['filename'] as String,bytes:bytes);
      if(target!=null && !Platform.isAndroid && !Platform.isIOS)await File(target).writeAsBytes(bytes,flush:true);
      if(mounted && target!=null)ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('File saved.')));
      await refresh();
    }catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('$e')));}
  }

  Widget recordTile(String entity,Map<String,Object?> row){
    final value=body(row);
    return Card(child:ListTile(
      leading:entity=='task'?Checkbox(value:value['done']==true,onChanged:(done)=>act(()=>store.saveRecord(entity,row['record_id'] as String,{...value,'done':done}))):Icon(entity=='folder'?Icons.folder_outlined:Icons.description_outlined,color:navy),
      title:Text(value[entity=='folder'?'name':'title'] as String? ?? entity,maxLines:1,overflow:TextOverflow.ellipsis),
      subtitle:Text(row['conflict']!=null?'Conflict · choose which version to keep':row['operation_id']!=null?'Saved locally · pending sync':entity=='note'?(value['text'] as String? ?? ''):'Synced',maxLines:2,overflow:TextOverflow.ellipsis),
      onTap:()=>edit(entity,row),
      trailing:IconButton(icon:const Icon(Icons.delete_outline),tooltip:'Delete $entity',onPressed:()=>remove(entity,row)),
    ));
  }

  @override Widget build(BuildContext context){
    if(loading)return const Center(child:CircularProgressIndicator());
    final visibleNotes=notes.where((r)=>folderId==null||body(r)['folder_id']==folderId).toList();
    final visibleTasks=tasks.where((r)=>folderId==null||body(r)['folder_id']==folderId).toList();
    final visibleFiles=files.where((r)=>folderId==null||r['folder_id']==folderId).toList();
    return RefreshIndicator(onRefresh:()async{await widget.api.sync.run();await refresh();},child:ListView(padding:const EdgeInsets.all(22),children:[
      const Text('Your workspace',style:TextStyle(fontSize:28,fontWeight:FontWeight.bold,color:navy)),
      const SizedBox(height:8),const Text('Notes, tasks, and files. Saved on this device first, synced when connected.'),
      if(error!=null)Text(error!,style:const TextStyle(color:Colors.red)),
      const SizedBox(height:20),
      Wrap(spacing:10,runSpacing:10,children:[FilledButton.icon(onPressed:()=>edit('note'),icon:const Icon(Icons.add),label:const Text('New note')),OutlinedButton.icon(onPressed:()=>edit('task'),icon:const Icon(Icons.checklist),label:const Text('New task')),OutlinedButton.icon(onPressed:()=>edit('folder'),icon:const Icon(Icons.create_new_folder_outlined),label:const Text('New folder')),OutlinedButton.icon(onPressed:chooseFiles,icon:const Icon(Icons.cloud_upload_outlined),label:const Text('Add files'))]),
      const SizedBox(height:22),
      Wrap(spacing:8,children:[ChoiceChip(label:const Text('All folders'),selected:folderId==null,onSelected:(_)=>setState(()=>folderId=null)),...folders.map((folder)=>InputChip(label:Text(body(folder)['name'] as String),selected:folderId==folder['record_id'],onSelected:(_)=>setState(()=>folderId=folder['record_id'] as String),onDeleted:()=>remove('folder',folder)))]),
      if(conflicts.isNotEmpty)...[
        const SizedBox(height:20),const Text('Resolve sync conflicts',style:TextStyle(fontSize:18,fontWeight:FontWeight.bold)),
        ...conflicts.map((conflict)=>Card(color:const Color(0xFFFFF2E5),child:Padding(padding:const EdgeInsets.all(16),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
          Text('${conflict['entity']} · ${body(conflict)['title'] ?? body(conflict)['name'] ?? conflict['record_id']}',style:const TextStyle(fontWeight:FontWeight.bold)),
          const Text('This item changed on another device. Your local version is still saved.'),
          SelectableText('Device: ${conflict['body']}\nServer: ${conflict['conflict']}',maxLines:5,style:const TextStyle(fontSize:11)),
          Wrap(spacing:8,children:[TextButton(onPressed:()=>act(()=>store.resolve(conflict['entity'] as String,conflict['record_id'] as String,keepLocal:true)),child:const Text('Keep my version')),TextButton(onPressed:()=>act(()=>store.resolve(conflict['entity'] as String,conflict['record_id'] as String,keepLocal:false)),child:const Text('Use server version'))]),
        ])))),
      ],
      const SizedBox(height:24),const Text('Notes',style:TextStyle(fontSize:19,fontWeight:FontWeight.bold)),
      if(visibleNotes.isEmpty)const Padding(padding:EdgeInsets.symmetric(vertical:16),child:Text('No notes in this folder yet.')),
      ...visibleNotes.map((row)=>recordTile('note',row)),
      const SizedBox(height:20),const Text('Tasks',style:TextStyle(fontSize:19,fontWeight:FontWeight.bold)),
      if(visibleTasks.isEmpty)const Padding(padding:EdgeInsets.symmetric(vertical:16),child:Text('No tasks yet.')),
      ...visibleTasks.map((row)=>recordTile('task',row)),
      const SizedBox(height:20),const Text('Files',style:TextStyle(fontSize:19,fontWeight:FontWeight.bold)),
      const Text('Up to 10 MB per file. Local copies and queued uploads persist after restart.'),
      if(visibleFiles.isEmpty)const Padding(padding:EdgeInsets.symmetric(vertical:16),child:Text('Add a file to save it on this device and queue an upload.')),
      ...visibleFiles.map((file)=>Card(child:ListTile(leading:const Icon(Icons.insert_drive_file_outlined,color:navy),title:Text(file['filename'] as String),subtitle:Text('${((file['size_bytes'] as int)/1024).toStringAsFixed(1)} KB · ${file['state']}${file['error']!=null?'\n${file['error']}':''}'),trailing:Wrap(children:[
        if(file['state']=='blocked')IconButton(tooltip:'Retry upload',icon:const Icon(Icons.refresh),onPressed:()=>act(()async{await store.db.update('files',{'state':'pending','error':null},where:'file_id=?',whereArgs:[file['file_id']]);})),
        IconButton(tooltip:'Save a copy',icon:const Icon(Icons.download_outlined),onPressed:()=>export(file)),
        IconButton(tooltip:'Delete file',icon:const Icon(Icons.delete_outline),onPressed:()=>act(()=>store.deleteFile(file['file_id'] as String))),
      ])))),
      const SizedBox(height:28),
    ]));
  }
}
