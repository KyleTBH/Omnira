const $ = id => document.getElementById(id);
let user = JSON.parse(localStorage.getItem('omniraUser') || 'null');
let page = 'Dashboard';
const navByRole = {
  student: ['Dashboard','Computers','Reservations','Sessions','Printing','Payments','AI Reviewer'],
  professor: ['Dashboard','Reservations','Printing','Analytics','AI Reviewer'],
  admin: ['Dashboard','Computers','Reservations','Sessions','Printing','Payments','Maintenance','Analytics']
};
const api = (path, options={}) => window.omnira.request(path, options, user?.id);
const post = (path, body={}) => api(path,{method:'POST',body:JSON.stringify(body)});
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notice(message){ $('notice').textContent=message; setTimeout(()=>{$('notice').textContent=''},4500) }
function card(value,label){return `<div class="card"><b>${esc(value)}</b><span>${esc(label)}</span></div>`}
function item(title,detail,right=''){return `<div class="item"><div><strong>${esc(title)}</strong><small>${esc(detail)}</small></div>${right}</div>`}
function button(label,action,id){return `<button class="action" data-action="${action}" data-id="${id}">${label}</button>`}
function renderShell(){
  $('login').classList.toggle('hidden',!!user); $('app').classList.toggle('hidden',!user);
  if(!user)return;
  $('identity').textContent=`${user.name} · ${user.role}`; $('avatar').textContent=user.name[0];
  $('nav').innerHTML=navByRole[user.role].map(p=>`<button class="${page===p?'active':''}" data-page="${p}">${p}</button>`).join('');
  $('page-title').textContent=page;
}
async function render(){
  renderShell(); if(!user)return;
  $('content').innerHTML='<div class="panel">Loading…</div>';
  try{
    let html='';
    if(page==='Dashboard'){
      const d=await api('/dashboard');
      html=`<div class="hero"><div><h2>Good day, ${esc(user.name)}!</h2><p>Your campus workspace is ready.</p></div><div class="orb">✦</div></div><div class="cards">${card(d.available_computers,'Available computers')}${card(d.active_sessions,'Active sessions')}${card(d.reservations,'Reservations')}${card(d.open_print_jobs,'Open print jobs')}</div><div class="panel"><h2>Quick access</h2><div class="actions">${navByRole[user.role].slice(1,5).map(p=>`<button class="action" data-page="${p}">${p}</button>`).join('')}</div></div>`;
    } else if(page==='Computers'){
      const data=await api('/computers');
      html=`<div class="panel"><h2>Computer availability</h2><div class="list">${data.map(c=>item(c.label,c.lab,`<span class="pill ${c.status==='maintenance'?'warn':''}">${esc(c.status)}</span>`)).join('')}</div></div>`;
    } else if(page==='Reservations'){
      const [data,pcs]=await Promise.all([api('/reservations'),api('/computers')]);
      const form=user.role==='student'?`<div class="panel"><h2>Reserve a computer</h2><form class="form" id="reserve-form"><label>Computer</label><select name="computer_id">${pcs.filter(p=>p.status==='available').map(p=>`<option value="${p.id}">${p.label} · ${p.lab}</option>`).join('')}</select><label>Start</label><input type="datetime-local" name="starts_at" required><label>End</label><input type="datetime-local" name="ends_at" required><button class="primary">Reserve now</button></form></div>`:'';
      html=`<div class="grid">${form}<div class="panel"><h2>Bookings</h2><div class="list">${data.length?data.map(r=>item(`${r.label} · ${r.lab}`,`${r.student} · ${new Date(r.starts_at).toLocaleString()} to ${new Date(r.ends_at).toLocaleString()}`,`<div class="actions"><span class="pill">${r.status}</span>${r.status==='confirmed'?button('Cancel','cancel',r.id):''}</div>`)).join(''):'<div class="empty">No reservations yet</div>'}</div></div></div>`;
    } else if(page==='Sessions'){
      const [data,pcs]=await Promise.all([api('/sessions'),api('/computers')]);
      const form=user.role!=='professor'?`<div class="panel"><h2>Start a lab session</h2><form class="form" id="session-form"><label>Computer</label><select name="computer_id">${pcs.filter(p=>p.status==='available').map(p=>`<option value="${p.id}">${p.label} · ${p.lab}</option>`).join('')}</select><button class="primary">Start session</button></form></div>`:'';
      html=`<div class="grid">${form}<div class="panel"><h2>Lab sessions</h2><div class="list">${data.length?data.map(s=>item(`${s.label} · ${s.student}`,`${new Date(s.started_at).toLocaleString()} · ₱${s.amount.toFixed(2)}`,s.ended_at?'<span class="pill">Ended</span>':button('End session','end',s.id))).join(''):'<div class="empty">No sessions yet</div>'}</div></div></div>`;
    } else if(page==='Printing'){
      const data=await api('/printing');
      const form=user.role!=='admin'?`<div class="panel"><h2>Request printing</h2><form class="form" id="print-form"><label>Filename</label><input name="filename" placeholder="Project_Report.pdf" required><label>Pages</label><input type="number" name="pages" min="1" value="1" required><label>Copies</label><input type="number" name="copies" min="1" value="1" required><button class="primary">Submit request</button></form></div>`:'';
      html=`<div class="grid">${form}<div class="panel"><h2>Print jobs</h2><div class="list">${data.length?data.map(j=>item(j.filename,`${j.student} · ${j.pages} pages × ${j.copies} · ₱${j.amount.toFixed(2)}`,user.role==='admin'&&j.status==='pending'?button('Complete','complete',j.id):`<span class="pill">${j.status}</span>`)).join(''):'<div class="empty">No print jobs yet</div>'}</div></div></div>`;
    } else if(page==='Payments'){
      const [paid,sessions,prints]=await Promise.all([api('/payments'),api('/sessions'),api('/printing')]);
      const isPaid=(type,id)=>paid.some(p=>p.item_type===type&&p.item_id===id);
      const bills=[...sessions.filter(s=>s.ended_at&&!isPaid('session',s.id)).map(s=>({type:'session',id:s.id,title:`Lab session · ${s.label}`,amount:s.amount})),...prints.filter(p=>!isPaid('print',p.id)).map(p=>({type:'print',id:p.id,title:`Printing · ${p.filename}`,amount:p.amount}))];
      html=`<div class="grid"><div class="panel"><h2>Unpaid bills</h2><div class="list">${bills.length?bills.map(b=>item(b.title,`₱${b.amount.toFixed(2)}`,user.role==='student'?`<button class="action" data-action="pay" data-type="${b.type}" data-id="${b.id}">Demo QR Pay</button>`:'' )).join(''):'<div class="empty">No unpaid bills</div>'}</div></div><div class="panel"><h2>Payment records</h2><div class="list">${paid.length?paid.map(p=>item(`Receipt OM-DEMO-${String(p.id).padStart(6,'0')}`,`${p.item_type} #${p.item_id} · ₱${p.amount.toFixed(2)} · ${p.method}`,button('View','receipt',p.id))).join(''):'<div class="empty">No payments yet</div>'}</div></div></div>`;
    } else if(page==='Maintenance'){
      const [data,pcs]=await Promise.all([api('/maintenance'),api('/computers')]);
      html=`<div class="grid"><div class="panel"><h2>Log a maintenance issue</h2><form class="form" id="maintenance-form"><label>Computer</label><select name="computer_id">${pcs.map(p=>`<option value="${p.id}">${p.label}</option>`).join('')}</select><label>Issue</label><textarea name="note" rows="4" required></textarea><button class="primary">Save issue</button></form></div><div class="panel"><h2>Maintenance records</h2><div class="list">${data.length?data.map(m=>item(m.label,m.note,`<span class="pill warn">${m.status}</span>`)).join(''):'<div class="empty">No issues logged</div>'}</div></div></div>`;
    } else if(page==='Analytics'){
      const d=await api('/analytics'); html=`<div class="cards">${card(d.total_students,'Students')}${card(Math.round(d.total_lab_minutes),'Total lab minutes')}</div><div class="panel"><h2>Academic performance</h2><p class="muted">${esc(d.note)}</p></div>`;
    } else if(page==='AI Reviewer'){
      html=`<div class="grid"><div class="panel"><h2>Make a reviewer</h2><p class="muted">This demo creates a local rule-based outline from your notes.</p><form class="form" id="reviewer-form"><label>Subject</label><input name="subject" required placeholder="Computer Programming"><label>Notes</label><textarea name="notes" rows="8" required placeholder="Paste at least ten characters of lesson notes"></textarea><button class="primary">Generate reviewer</button></form></div><div class="panel"><h2>Reviewer preview</h2><div id="reviewer-result" class="muted">Your reviewer will appear here.</div></div></div>`;
    }
    $('content').innerHTML=html;
  }catch(error){$('content').innerHTML=`<div class="panel error">${esc(error.message)}. Check that the FastAPI server is running.</div>`}
}
$('sign-in').onclick=async()=>{try{user=await window.omnira.request('/auth/login',{method:'POST',body:JSON.stringify({email:$('email').value,password:$('password').value})});localStorage.setItem('omniraUser',JSON.stringify(user));page='Dashboard';$('login-error').textContent='';render()}catch(e){$('login-error').textContent=e.message}};
$('logout').onclick=()=>{user=null;localStorage.removeItem('omniraUser');renderShell()};
document.addEventListener('click',async e=>{const nav=e.target.closest('[data-page]');if(nav){page=nav.dataset.page;render();return}const action=e.target.closest('[data-action]');if(!action)return;try{let msg='Done';if(action.dataset.action==='cancel')await post(`/reservations/${action.dataset.id}/cancel`);if(action.dataset.action==='end'){const r=await post(`/sessions/${action.dataset.id}/end`);msg=`Session ended. Charge: ₱${r.amount.toFixed(2)}`}if(action.dataset.action==='complete')await post(`/printing/${action.dataset.id}/complete`);if(action.dataset.action==='pay'){const r=await post('/payments',{item_type:action.dataset.type,item_id:Number(action.dataset.id),method:'demo_qr'});msg=`Demo payment recorded. Receipt #${r.receipt_id}`}if(action.dataset.action==='receipt'){const r=await api(`/receipts/${action.dataset.id}`);msg=`${r.receipt_no}: ₱${r.amount.toFixed(2)} · ${r.note}`}await render();notice(msg)}catch(err){notice(err.message)}});
document.addEventListener('submit',async e=>{e.preventDefault();const form=e.target;const v=Object.fromEntries(new FormData(form));try{let msg='Saved';if(form.id==='reserve-form')await post('/reservations',{computer_id:Number(v.computer_id),starts_at:new Date(v.starts_at).toISOString(),ends_at:new Date(v.ends_at).toISOString()});if(form.id==='session-form')await post('/sessions/start',{computer_id:Number(v.computer_id)});if(form.id==='print-form'){const r=await post('/printing',{filename:v.filename,pages:Number(v.pages),copies:Number(v.copies)});msg=`Print request saved. Charge: ₱${r.amount.toFixed(2)}`}if(form.id==='maintenance-form')await post('/maintenance',{computer_id:Number(v.computer_id),note:v.note});if(form.id==='reviewer-form'){const r=await post('/reviewer',{subject:v.subject,notes:v.notes});$('reviewer-result').innerHTML=r.reviewer.map(esc).join('<br><br>');return}await render();notice(msg)}catch(err){notice(err.message)}});
render();
