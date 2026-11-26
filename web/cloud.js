(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const request = (path, options={}) => window.omnira.request(path, options);
  let records = [], files = [], busy = false;
  const feedback = message => { $('feedback').textContent = message; };
  const isLive = record => !record.deleted;
  async function mutate(entity, recordId, body, baseVersion=0, deleted=false) {
    const result = await request('/sync/push', {method:'POST', body:JSON.stringify({changes:[{operation_id:crypto.randomUUID(),entity,record_id:recordId,base_version:baseVersion,body,deleted}]})});
    if(result.results[0].status==='conflict') throw new Error('This item changed on another device. Refresh to review the latest version before editing again.');
  }
  async function load() {
    records=[]; let cursor=0, more=true;
    while(more) { const result=await request(`/sync/pull?after=${cursor}&limit=500`);records.push(...result.records);cursor=result.cursor;more=result.has_more; }
    files=[]; let offset=0;
    while(offset!==null) { const result=await request(`/cloud/files?offset=${offset}`);files.push(...result.files);offset=result.next_offset; }
    const status=await request('/cloud/status');
    $('storage-status').textContent=`${status.backend==='s3'?'Private cloud object storage':'Local development storage'} · ${(status.used_bytes/1048576).toFixed(1)} MB of ${(status.quota_bytes/1048576).toFixed(0)} MB used`;
    render();
  }
  function render() {
    const folders=records.filter(r=>r.entity==='folder'&&isLive(r));
    const option=$('upload-folder').value;
    $('upload-folder').innerHTML='<option value="">No folder</option>'+folders.map(r=>`<option value="${esc(r.record_id)}">${esc(r.body.name)}</option>`).join('');
    if(folders.some(r=>r.record_id===option))$('upload-folder').value=option;
    $('folders').innerHTML=folders.map(r=>`<div class="item"><div><strong>${esc(r.body.name)}</strong></div><button data-edit="${r.record_id}">Rename</button><button data-delete="${r.record_id}" class="danger">Delete</button></div>`).join('')||'<p class="small">No folders yet.</p>';
    $('notes').innerHTML=records.filter(r=>r.entity==='note'&&isLive(r)).map(r=>`<div class="item"><div><strong>${esc(r.body.title)}</strong><pre>${esc(r.body.text)}</pre></div><button data-edit="${r.record_id}">Edit</button><button data-delete="${r.record_id}" class="danger">Delete</button></div>`).join('')||'<p class="small">No notes yet.</p>';
    $('tasks').innerHTML=records.filter(r=>r.entity==='task'&&isLive(r)).map(r=>`<div class="item"><input type="checkbox" aria-label="Complete ${esc(r.body.title)}" data-task="${r.record_id}" ${r.body.done?'checked':''}><div><strong>${esc(r.body.title)}</strong></div><button data-delete="${r.record_id}" class="danger">Delete</button></div>`).join('')||'<p class="small">No tasks yet.</p>';
    $('files').innerHTML=files.map(file=>`<div class="item"><div><strong>${esc(file.filename)}</strong><small>${(file.size_bytes/1024).toFixed(1)} KB · private</small></div><button data-download="${file.file_id}">Download</button><button data-file-delete="${file.file_id}" class="danger">Delete</button></div>`).join('')||'<p class="small">No cloud files yet.</p>';
  }
  async function act(action) {
    if(busy)return;
    busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);feedback('Working…');
    try { await action();feedback('Saved.'); }
    catch(error){feedback(error.message);}
    finally {busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  function showAccount() {
    const user=window.omnira.user();
    $('login-panel').hidden=!!user;$('workspace').hidden=!user;$('signout').hidden=!user;
    if(user)$('greeting').textContent=`${user.name}’s workspace`;
  }
  $('login-form').onsubmit=event=>{event.preventDefault();act(async()=>{const values=Object.fromEntries(new FormData(event.target));await request('/auth/login',{method:'POST',body:JSON.stringify(values)});showAccount();await load();});};
  $('signout').onclick=()=>act(async()=>{try{await request('/auth/logout',{method:'POST'});}finally{window.omnira.clearSession();showAccount();}});
  $('refresh').onclick=()=>act(load);
  for(const entity of ['folder','note','task']) $(entity+'-form').onsubmit=event=>{event.preventDefault();act(async()=>{const body=Object.fromEntries(new FormData(event.target));if(entity==='task')body.done=false;await mutate(entity,crypto.randomUUID(),body);event.target.reset();await load();});};
  $('upload-form').onsubmit=event=>{event.preventDefault();act(async()=>{const file=event.target.elements.file.files[0];if(file.size>10*1048576)throw new Error('The maximum file size is 10 MB.');const body=new FormData();body.append('file_id',crypto.randomUUID());body.append('file',file);if($('upload-folder').value)body.append('folder_id',$('upload-folder').value);await request('/cloud/files',{method:'POST',body});event.target.reset();await load();});};
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    const id=button.dataset.edit||button.dataset.delete;
    if(id)act(async()=>{const r=records.find(r=>r.record_id===id);if(button.dataset.delete){if(!confirm('Delete this item on your connected devices?'))return;await mutate(r.entity,id,r.body,r.version,true);}else{const key=r.entity==='folder'?'name':'title';const title=prompt('Title',r.body[key]);if(!title?.trim())return;const body={...r.body,[key]:title.trim()};if(r.entity==='note'){const text=prompt('Note text',r.body.text||'');if(text===null)return;body.text=text;}await mutate(r.entity,id,body,r.version);}await load();});
    if(button.dataset.fileDelete)act(async()=>{if(!confirm('Delete this private file?'))return;await request(`/cloud/files/${button.dataset.fileDelete}`,{method:'DELETE'});await load();});
    if(button.dataset.download)act(async()=>{const file=files.find(f=>f.file_id===button.dataset.download);const response=await request(`/cloud/files/${file.file_id}/content`,{raw:true});const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download=file.filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback('Download started.');});
  });
  document.addEventListener('change',event=>{if(event.target.dataset.task)act(async()=>{const r=records.find(r=>r.record_id===event.target.dataset.task);await mutate('task',r.record_id,{...r.body,done:event.target.checked},r.version);await load();});});
  showAccount();if(window.omnira.user())act(load);
})();
