const $ = id => document.getElementById(id);
const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  sparkles: '<path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7z"/><path d="m19 17 .7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7z"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  check: '<path d="M20 7 10 17l-5-5"/><circle cx="12" cy="12" r="10"/>',
  profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><circle cx="12" cy="12" r="10"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  computer: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4m8-4v4"/>',
  printer: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 15h12v6H6z"/>',
  receipt: '<path d="M5 3h14v18l-3-2-4 2-4-2-3 2zM8 8h8m-8 4h8"/>',
  book: '<path d="M3 4h8a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H3zM21 4h-4a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h4z"/>',
  folder: '<path d="M3 6h7l2 2h9v12H3z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18M12 3c-5 5-5 13 0 18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 1c0 2-3 2-3 4m0 3h.01"/>',
  phone: '<path d="M6 3h4l1 5-2 2a15 15 0 0 0 5 5l2-2 5 1v4a3 3 0 0 1-3 3A17 17 0 0 1 3 6a3 3 0 0 1 3-3z"/>',
  clip: '<path d="m8 12 5-5a3 3 0 0 1 4 4l-7 7a5 5 0 0 1-7-7l8-8"/>'
  ,send: '<path d="m4 12 16-8-5 16-3-7-8-1zM12 13l8-9"/>'
  ,menu: '<path d="M4 6h16M4 12h16M4 18h16"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const tabs = [
  ['Home','home'], ['Explore','compass'], ['Gabay AI','sparkles'], ['Upload','plus'], ['Activity','check'], ['Profile','profile']
];
let active = 0;
let authView = 'welcome';
let authTransitioning = false;
function switchAuthView(nextView) {
  if(authTransitioning) return;
  const page=$('screen').firstElementChild;
  if(!page || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {authView=nextView;render();return;}
  authTransitioning=true;
  page.classList.add('auth-leaving');
  setTimeout(()=>{authView=nextView;render();authTransitioning=false;},280);
}
let pageTransitioning=false;
function transitionPage(update) {
  if(pageTransitioning) return;
  const screen=$('screen');
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) {update();render();return;}
  pageTransitioning=true;
  screen.classList.remove('page-entering');
  screen.classList.add('page-leaving');
  setTimeout(()=>{
    update();render();
    screen.classList.remove('page-leaving');
    screen.classList.add('page-entering');
    setTimeout(()=>{screen.classList.remove('page-entering');pageTransitioning=false;},330);
  },150);
}
let demoVerified = false;
let recaptchaWidget = null;
function showRecaptcha() {
  const area=$('recaptcha-area');
  if(!area) return;
  const siteKey=window.OMNIRA_RECAPTCHA_SITE_KEY;
  if(!siteKey) {area.innerHTML='<label class="demo-verify"><input type="checkbox" id="demo-verified"> <span>Verify for preview</span><small>Demo check · live reCAPTCHA needs keys</small></label>';return;}
  area.innerHTML='<div id="recaptcha-widget"></div>';
  const draw=()=>{if(authView==='login' && window.grecaptcha?.render) recaptchaWidget=grecaptcha.render('recaptcha-widget',{sitekey:siteKey,size:'compact'});};
  if(window.grecaptcha?.render) draw();
  else if(!document.getElementById('recaptcha-script')) {const script=document.createElement('script');script.id='recaptcha-script';script.src='https://www.google.com/recaptcha/api.js?render=explicit';script.async=true;script.defer=true;script.onload=draw;document.head.appendChild(script);}
}
let student = null;
let currentFeature = null;
let chatMessages = [];
const chatStoreKey = 'omnira-gabay-chats-v1';
let chats = [];
try {
  const saved = JSON.parse(localStorage.getItem(chatStoreKey) || '[]');
  chats = Array.isArray(saved) ? saved.filter(item => item && typeof item.id === 'string' && Array.isArray(item.messages)) : [];
} catch { chats = []; }
let activeChatId = null;
let historyOpen = false;
const folderStoreKey = 'omnira-subject-folders-v1';
let subjectFolders = [];
try {
  const saved = JSON.parse(localStorage.getItem(folderStoreKey) || '[]');
  subjectFolders = Array.isArray(saved) ? saved.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string') : [];
} catch { subjectFolders = []; }
let selectedFolderId = null;
let queuedFiles = [];
let addFolderOpen = false;
const plannerStoreKey = 'omnira-student-planner-v1';
let planner = {tasks:[],projects:[]};
try {
  const saved = JSON.parse(localStorage.getItem(plannerStoreKey) || '{}');
  if(Array.isArray(saved.tasks) && Array.isArray(saved.projects)) planner = saved;
} catch {}
const localDateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
let selectedActivityDate = localDateKey(new Date());
let activityMonth = new Date(new Date().getFullYear(),new Date().getMonth(),1);
let activityMode = 'tasks';
let activityShowAll = false;
let activityMenuOpen = false;
let activityFormOpen = false;
let selectedProjectId = null;
let profileDetail = null;
const savePlanner = () => localStorage.setItem(plannerStoreKey,JSON.stringify(planner));
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const api = path => window.omnira.request(path, {}, student?.id);
const post = (path, body) => window.omnira.request(path, {method:'POST', body:JSON.stringify(body)}, student?.id);

function brand() {
  return `<div class="brand-row"><img class="brand-image" src="assets/logo-transparent.png" alt="Omnira"><button class="top-action" aria-label="Notifications" data-action="notifications">${icon('bell')}</button></div>`;
}
function feature(title, subtitle, glyph, target) {
  return `<button class="feature" data-feature="${target}"><span class="feature-icon">${icon(glyph)}</span><span><strong>${title}</strong><small style="display:block">${subtitle}</small></span></button>`;
}
const classTimetable=[{title:'Programming',subject:'Computer Studies',start:'09:00',end:'10:30'},{title:'Philippine History',subject:'History',start:'13:00',end:'14:30'}];
const scheduleImageKey='omnira-schedule-image-v1';
function scheduleImagePanel() {
  let saved;
  try { saved=JSON.parse(localStorage.getItem(scheduleImageKey)||'null'); } catch {}
  return `<div class="simple-card schedule-image-card"><strong>Class schedule image</strong><p>Add one image of your timetable. You can replace it anytime.</p><label class="schedule-image-button" for="schedule-image-input">${saved?'Replace image':'Upload image'}</label><input id="schedule-image-input" type="file" accept="image/*" hidden><div id="schedule-image-feedback" aria-live="polite"></div>${saved?`<div class="schedule-image-preview"><img src="${saved.data}" alt="Uploaded class schedule"><button type="button" data-action="remove-schedule-image" aria-label="Remove schedule image">Remove</button></div>`:''}</div>`;
}
function nextClass(now=new Date()) {
  for(let offset=0;offset<8;offset++) {
    const day=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset);
    if(day.getDay()===0||day.getDay()===6) continue;
    for(const item of classTimetable) {
      const [hour,minute]=item.start.split(':').map(Number);
      const starts=new Date(day.getFullYear(),day.getMonth(),day.getDate(),hour,minute);
      if(starts>now) return {...item,starts};
    }
  }
  return null;
}
function updateNextClass() {
  const card=document.querySelector('.home-current');
  if(!card) return;
  const item=nextClass();
  const minutes=item?Math.ceil((item.starts-Date.now())/60000):0;
  card.querySelector('.home-next-title').textContent=item?.title||'No upcoming class';
  card.querySelector('.home-next-countdown').textContent=item?`${minutes} min until class`:'View schedule';
}
function home() {
  const today=localDateKey(new Date());
  const upcoming=planner.tasks.filter(task=>!task.done && task.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
  const next=nextClass();
  const minutes=next?Math.ceil((next.starts-Date.now())/60000):0;
  const dueToday=upcoming.filter(task=>task.date===today);
  const later=upcoming.filter(task=>task.date>today);
  const name=(student?.name||'Alex Student').split(' ')[0];
  const dateLabel=new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
  return `<div class="home-top">${brand()}<div class="home-date">${dateLabel}</div><h1>Good morning<br><span>${escapeHtml(name)},</span></h1>
    <button class="home-current" data-action="home-next-class"><span><small>Up next · ${next?next.starts.toLocaleDateString('en-US',{weekday:'short'}):'Schedule'}</small><strong class="home-next-title">${escapeHtml(next?.title||'No upcoming class')}</strong><small>${escapeHtml(next?.subject||'Class schedule')}</small></span><span class="home-current-action"><b class="home-next-countdown">${next?`${minutes} min until class`:'View schedule'}</b>${icon('arrow')}</span></button>
    <div class="home-summary"><button data-tab="4">${icon('calendar')}<b>${planner.tasks.filter(task=>task.date===today).length}</b><span>Today's tasks</span>${icon('arrow')}</button><button data-tab="4">${icon('check')}<b>${planner.tasks.filter(task=>!task.done).length}</b><span>Need review</span>${icon('arrow')}</button></div></div>
    <div class="home-upcoming-head"><h2>Class Schedule</h2><button data-feature="schedule" aria-label="View schedule">${icon('arrow')}</button></div>
    <div class="class-schedule-card" id="class-schedule"><div class="class-schedule-note">Sample weekday timetable</div>${classTimetable.map(item=>`<div class="class-row"><span>${new Date('2000-01-01T'+item.start).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}<br>${new Date('2000-01-01T'+item.end).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</span><strong>${escapeHtml(item.title)}<small>${escapeHtml(item.subject)}</small></strong>${icon('calendar')}</div>`).join('')}</div>
    <div class="deadline-card"><section><h2>${icon('calendar')} Due Today <span>${dueToday.length}</span></h2>${dueToday.length?dueToday.slice(0,3).map(task=>`<button data-tab="4" class="deadline-row"><i></i><strong>${escapeHtml(task.title)}</strong></button>`).join(''):'<p>No deadlines today</p>'}</section><section><h2>${icon('receipt')} Upcoming Deadlines <span>${later.length}</span></h2>${later.length?later.slice(0,3).map(task=>`<button data-tab="4" class="deadline-row"><i></i><strong>${escapeHtml(task.title)}<small>${new Date(task.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</small></strong></button>`).join(''):'<p>No upcoming deadlines</p>'}</section></div>`;
}
function explore() {
  return `${brand()}<div class="eyebrow">Campus services</div><h1>Explore</h1><p class="intro">Find everything you need for your campus day.</p><section class="features explore-features"><div class="section-heading"><h2>Features</h2></div><div class="feature-grid">
      ${feature('Computer Labs','Check availability','computer','labs')}
      ${feature('Reserve a PC','Choose a time','calendar','reserve')}
      ${feature('Printing','Send a request','printer','printing')}
      ${feature('Bills & Receipts','View your charges','receipt','billing')}
      ${feature('Schedule','Upcoming bookings','calendar','schedule')}
      ${feature('Study Materials','Your resources','book','materials')}
    </div></section>`;
}
function gabay() {
  const messages = chatMessages.length ? chatMessages.map(item => `<div class="chat-message ${item.role}">${item.role==='assistant'?'<span class="chat-avatar">G</span>':''}<div class="chat-bubble">${escapeHtml(item.text)}</div></div>`).join('') : `<div class="chat-welcome"><div class="chat-symbol">${icon('sparkles')}</div><h1>Hi, I'm Gabay</h1><p>Your study companion for notes, reviewers, and questions.</p><span class="local-label">Local demo mode</span></div><div class="prompt-list"><button data-prompt="Summarize my notes">Summarize my notes</button><button data-prompt="Make a reviewer">Make a reviewer</button><button data-prompt="Help me study">Help me study</button></div>`;
  const history = [...chats].sort((a,b) => b.updatedAt - a.updatedAt).map(item => `<button class="history-item ${item.id===activeChatId?'selected':''}" data-chat-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.title)}</strong><small>${new Date(item.updatedAt).toLocaleDateString()}</small></button>`).join('') || '<p class="history-empty">No previous chats yet. Start a conversation with Gabay.</p>';
  return `<div class="chat-page"><header class="chat-header"><div class="chat-headmark">G</div><div class="chat-heading"><strong>Gabay AI</strong><small><span class="status-dot"></span> Local demo</small></div><button class="new-chat" data-action="toggle-history" aria-label="Chat history" aria-expanded="${historyOpen}">${icon('menu')}</button></header><div class="chat-thread" id="chat-thread">${messages}</div><form class="chat-composer" id="chat-form"><button type="button" class="attach-button" data-action="attach" aria-label="Add material">${icon('plus')}</button><textarea name="message" id="chat-input" rows="1" placeholder="Message Gabay…" aria-label="Message Gabay" required></textarea><button type="submit" class="send-button" aria-label="Send message">${icon('send')}</button></form><div class="chat-footnote">Demo responses are generated on this device. Local AI model coming later.</div>${historyOpen?`<button class="history-scrim" data-action="close-history" aria-label="Close chat history"></button><aside class="history-drawer" aria-label="Previous Gabay chats"><div class="history-head"><div><strong>Your chats</strong><small>Saved on this device</small></div><button data-action="close-history" aria-label="Close chat history">×</button></div><button class="history-new" data-action="new-chat">${icon('plus')} New chat</button><div class="history-list">${history}</div></aside>`:''}</div>`;
}
function upload() {
  return `${brand()}<div class="eyebrow">Study resources</div><h1>Upload</h1><p class="intro">Keep notes and documents organized by subject.</p>
    <div class="upload-panel"><div class="upload-panel-head">Add files to upload</div><div class="upload-drop" id="upload-drop"><span class="upload-clip">${icon('clip')}</span><strong>Add files to upload</strong><small>PDF, DOCX, PPTX or TXT · 4 MB max each</small><button type="button" class="select-files" data-action="select-files">Select files</button><input type="file" id="upload-file" accept=".pdf,.doc,.docx,.pptx,.txt" multiple hidden></div></div>
    ${queuedFiles.length?`<div class="upload-queue">${queuedFiles.map(item=>`<div class="queue-row">${icon('clip')}<span class="queue-name">${escapeHtml(item.file.name)}<small>${formatBytes(item.file.size)}</small></span>${item.status==='saved'?`<span class="queue-status saved">${icon('check')} Saved</span>`:item.status==='failed'?`<span class="queue-status failed">${escapeHtml(item.error)}</span>`:`<span class="queue-status ready">${icon('check')} Ready</span>`}<button data-remove-file="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.file.name)}">×</button></div>`).join('')}</div>`:''}
    <div class="section-heading subject-heading"><h2>Subject folders</h2><button data-action="add-folder">${icon('plus')} Add folder</button></div>
    ${addFolderOpen?`<form id="folder-form" class="folder-form"><input class="field" name="name" maxlength="40" placeholder="e.g. Computer Programming" aria-label="Subject name" required autofocus><button class="primary" type="submit">Create</button></form>`:''}
    <div class="folder-list">${subjectFolders.length?subjectFolders.map(folder=>`<button class="folder-item ${selectedFolderId===folder.id?'selected':''}" data-folder-id="${escapeHtml(folder.id)}"><span class="folder-icon">${icon('folder')}</span><span>${escapeHtml(folder.name)}</span>${selectedFolderId===folder.id?icon('check'):''}</button>`).join(''):'<div class="folder-empty">No subjects yet. Add a folder to organize your files.</div>'}</div>
    ${queuedFiles.some(item=>item.status==='ready')&&selectedFolderId?'<div class="upload-actions"><button type="button" data-action="cancel-upload">Cancel</button><button type="button" data-action="save-files">Continue</button></div>':''}
    ${queuedFiles.some(item=>item.status==='ready')&&!selectedFolderId?'<p class="small-note select-folder-note">Select or create a subject folder to continue.</p>':''}
    <div id="upload-feedback" aria-live="polite"></div>
    ${selectedFolderId?`<div class="section-heading saved-heading"><h2>Files in ${escapeHtml(subjectFolders.find(folder=>folder.id===selectedFolderId)?.name||'subject')}</h2></div><div id="folder-files"><div class="small-note">Loading files…</div></div>`:''}
    <p class="small-note storage-note">Folders and files are saved in this browser on this device. AI file analysis is not connected yet.</p>`;
}
function formatBytes(bytes) { return bytes<1024?`${bytes} B`:`${(bytes/1024/1024)>=1?(bytes/1024/1024).toFixed(1)+' MB':Math.ceil(bytes/1024)+' KB'}`; }
function addQueuedFiles(files) {
  addFolderOpen=false;
  for(const file of files) {
    if(queuedFiles.some(item=>item.file.name===file.name && item.file.size===file.size && item.file.lastModified===file.lastModified)) continue;
    const allowed=/\.(pdf|doc|docx|pptx|txt)$/i.test(file.name);
    const tooLarge=file.size>4*1024*1024;
    queuedFiles.push({id:crypto.randomUUID(),file,status:allowed&&!tooLarge?'ready':'failed',error:tooLarge?'Over 4 MB':'Unsupported file'});
  }
  render();
}
function activity() {
  const today=localDateKey(new Date());
  const todays=planner.tasks.filter(task=>task.date===today && !task.done).length;
  const scheduled=planner.tasks.filter(task=>task.date>today && !task.done).length;
  const year=activityMonth.getFullYear(),month=activityMonth.getMonth();
  const firstDay=new Date(year,month,1).getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const calendarDays=[...Array(firstDay).fill('<span class="calendar-blank"></span>'),...Array.from({length:daysInMonth},(_,index)=>{const day=index+1,key=localDateKey(new Date(year,month,day));const hasTasks=planner.tasks.some(task=>task.date===key);return `<button class="calendar-day ${key===selectedActivityDate?'selected':''} ${key===today?'today':''}" data-activity-date="${key}" aria-label="${new Date(year,month,day).toDateString()}">${day}${hasTasks?'<i></i>':''}</button>`;})].join('');
  const visibleTasks=planner.tasks.filter(task=>activityShowAll || task.date===selectedActivityDate).sort((a,b)=>a.date.localeCompare(b.date));
  const filteredTasks=selectedProjectId?visibleTasks.filter(task=>task.projectId===selectedProjectId):visibleTasks;
  const modeTitle=activityMode==='projects'?'Projects':activityShowAll?'All Tasks':"Today's Task";
  const taskBody=filteredTasks.length?filteredTasks.map(task=>`<div class="planner-task"><button class="task-check ${task.done?'done':''}" data-toggle-task="${task.id}" aria-label="${task.done?'Mark incomplete':'Complete'} ${escapeHtml(task.title)}">${task.done?icon('check'):''}</button><div><strong class="${task.done?'completed':''}">${escapeHtml(task.title)}</strong><small>${escapeHtml(planner.projects.find(project=>project.id===task.projectId)?.name||'Personal')} · ${escapeHtml(task.date)}</small></div></div>`).join(''):'<div class="planner-empty">No tasks here yet. Tap + to add one.</div>';
  const projectBody=planner.projects.length?planner.projects.map(project=>`<button class="planner-project ${selectedProjectId===project.id?'selected':''}" data-project-view="${project.id}"><span class="project-folder">${icon('folder')}</span><span><strong>${escapeHtml(project.name)}</strong><small>${planner.tasks.filter(task=>task.projectId===project.id).length} task(s)</small></span>${icon('arrow')}</button>`).join(''):'<div class="planner-empty">No projects yet. Tap + to create one.</div>';
  const form=activityFormOpen?(activityMode==='projects'?`<form class="planner-form" id="project-form"><label class="field-label">Project name</label><input class="field" name="name" maxlength="50" placeholder="e.g. Final Requirement" required><button class="primary">Create project</button></form>`:`<form class="planner-form" id="task-form"><label class="field-label">Task</label><input class="field" name="title" maxlength="80" placeholder="e.g. Review lecture notes" required><label class="field-label">Date</label><input class="field" type="date" name="date" value="${selectedActivityDate}" required><label class="field-label">Project</label><select class="field" name="projectId"><option value="">Personal</option>${planner.projects.map(project=>`<option value="${project.id}">${escapeHtml(project.name)}</option>`).join('')}</select><button class="primary">Add task</button></form>`):'';
  return `${brand()}<div class="eyebrow">Your planner</div><h1>Activity</h1><p class="intro">Stay on top of your study plans.</p>
    <div class="section-heading"><h2>Overview</h2></div>
    <div class="overview-grid"><button data-overview="today" class="overview-card blue"><b>${todays}</b><span>Today</span>${icon('arrow')}</button><button data-overview="schedule" class="overview-card orange"><b>${scheduled}</b><span>Schedule</span>${icon('arrow')}</button><button data-overview="projects" class="overview-card sky"><b>${planner.projects.length}</b><span>Projects</span>${icon('arrow')}</button><button data-overview="all" class="overview-card pale"><b>${planner.tasks.length}</b><span>All Tasks</span>${icon('arrow')}</button></div>
    <section class="calendar-card"><div class="calendar-head"><div><strong>${activityMonth.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</strong><small>${new Date(`${selectedActivityDate}T12:00:00`).toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})}</small></div><div><button data-month="-1" aria-label="Previous month">‹</button><button data-month="1" aria-label="Next month">›</button></div></div><div class="calendar-weekdays">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=>`<span>${day}</span>`).join('')}</div><div class="calendar-grid">${calendarDays}</div></section>
    <section class="planner-section"><div class="planner-heading"><div class="planner-switch"><button data-action="activity-menu" aria-expanded="${activityMenuOpen}"><span>${modeTitle}</span><svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>${activityMenuOpen?'<div class="planner-menu"><button data-activity-mode="tasks">Today’s Task</button><button data-activity-mode="projects">Projects</button></div>':''}</div><button class="planner-add" data-action="activity-add" aria-label="Add ${activityMode==='projects'?'project':'task'}">${icon('plus')}</button></div>${form}${activityMode==='projects'?projectBody+(selectedProjectId?`<div class="section-heading project-tasks-title"><h2>${escapeHtml(planner.projects.find(project=>project.id===selectedProjectId)?.name||'Project')} tasks</h2></div>${planner.tasks.filter(task=>task.projectId===selectedProjectId).map(task=>`<div class="planner-task"><button class="task-check ${task.done?'done':''}" data-toggle-task="${task.id}" aria-label="${task.done?'Mark incomplete':'Complete'} ${escapeHtml(task.title)}">${task.done?icon('check'):''}</button><div><strong class="${task.done?'completed':''}">${escapeHtml(task.title)}</strong><small>${escapeHtml(task.date)}</small></div></div>`).join('')||'<div class="planner-empty">No tasks in this project.</div>'}`:''):taskBody}</section>`;
}
function profile() {
  const groups=[['Account',[['Manage Profile','profile'],['Password & Security','lock'],['Notifications','bell'],['Language','globe','English']]],['Preferences',[['About Omnira','receipt'],['Theme','sparkles','Light'],['Appointments','calendar']]],['Support',[['Help Center','help'],['Contact Us','phone']]]];
  const rows=items=>items.map(([label,glyph,value])=>`<button class="profile-setting" data-profile-detail="${escapeHtml(label)}"><span class="profile-setting-icon">${icon(glyph)}</span><span>${label}</span>${value?`<small>${value}</small>`:''}<svg class="profile-row-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>`).join('');
  return `<div class="profile-title">${profileDetail?`<button data-action="profile-back" aria-label="Back to profile">‹</button>`:''}<strong>${profileDetail?escapeHtml(profileDetail):'Profile'}</strong></div>${profileDetail?`<div class="profile-detail-card"><span class="profile-avatar">${escapeHtml((student?.name||'Alex Student').slice(0,1).toUpperCase())}</span><h2>${escapeHtml(profileDetail)}</h2><p>${profileDetail==='Manage Profile'?'Your profile details will appear here.':profileDetail==='Appointments'?'Your upcoming appointments will appear here.':'This setting is ready for the next part of the app.'}</p></div>`:`<div class="profile-account"><span class="profile-avatar">${escapeHtml((student?.name||'Alex Student').slice(0,1).toUpperCase())}</span><span><strong>${escapeHtml(student?.name||'Alex Student')}</strong><small>${escapeHtml(student?.email||'student@omnira.test')}</small></span></div>${groups.map(([title,items])=>`<section class="profile-group"><h2>${title}</h2><div class="profile-list">${rows(items)}</div></section>`).join('')}`}`;
}
function featureView(name) {
  const labels = {labs:'Computer Labs',reserve:'Reserve a PC',printing:'Printing',billing:'Bills & Receipts',schedule:'Schedule',materials:'Study Materials'};
  return `${brand()}<button class="top-action" data-action="back-home" aria-label="Back to home" style="margin-bottom:18px">←</button><div class="eyebrow">Features</div><h1>${labels[name]}</h1><p class="intro">${name==='labs'?'See computer availability.':name==='reserve'?'Book a lab computer.':name==='printing'?'Send a campus print request.':name==='billing'?'Review your payments and receipts.':name==='schedule'?'See upcoming reservations.':'Keep your study files in one place.'}</p><div id="feature-content"><div class="simple-card"><strong>Loading…</strong></div></div>`;
}
function render(preserveScroll=false) {
  if(authView !== 'app') {
    $('bottom-nav').parentElement.hidden = true;
    $('screen').classList.add('welcome-screen');
    $('screen').innerHTML = authView==='welcome' ? `<div class="welcome-page"><div class="welcome-glow"></div><div class="welcome-content"><img src="assets/logo-transparent.png" alt="Omnira" class="welcome-logo"><h1>Welcome to Omnira</h1><p>Your campus resources, study tools, and activities in one place.</p><button class="welcome-primary" data-action="show-login">Get Started</button><div class="welcome-login">Already have an account? <button data-action="show-login">Log in</button></div></div></div>` : `<div class="login-page"><button class="login-back" data-action="show-welcome" aria-label="Back">‹</button><img src="assets/logo-transparent.png" alt="Omnira" class="login-brand"><h1>Welcome back</h1><p>Log in to your Omnira account.</p><form id="student-login"><label>Email<input name="email" type="email" value="student@omnira.test" required></label><label>Password<input name="password" type="password" value="demo123" required></label><div id="recaptcha-area"></div><button class="welcome-primary">Log in</button><div id="login-message" role="status"></div></form><small>Preview account details are filled in for you.</small></div>`;
    $('screen').scrollTop=0;
    if(authView==='login') requestAnimationFrame(showRecaptcha);
    return;
  }
  $('bottom-nav').parentElement.hidden = false;
  $('screen').classList.remove('welcome-screen');
  const previousScroll = preserveScroll ? $('screen').scrollTop : 0;
  const nav = $('bottom-nav');
  nav.innerHTML = tabs.map(([label,glyph],index) => `<button class="nav-button ${active===index?'active':''}" data-tab="${index}" aria-label="${label}" ${active===index?'aria-current="page"':''}>${icon(glyph)}<span>${label}</span></button>`).join('');
  requestAnimationFrame(() => {
    const selected = nav.querySelector('.nav-button.active');
    if (!selected) return;
    nav.style.setProperty('--pill-left', `${selected.offsetLeft}px`);
    nav.style.setProperty('--pill-width', `${selected.offsetWidth}px`);
    nav.style.setProperty('--pill-opacity', '1');
  });
  $('screen').classList.toggle('chat-active', active===2 && !currentFeature);
  $('screen').innerHTML = currentFeature ? featureView(currentFeature) : [home,explore,gabay,upload,activity,profile][active]();
  $('screen').scrollTop = previousScroll;
  if(currentFeature) loadFeature(currentFeature);
  else if(active===2 && chatMessages.length) $('chat-thread').scrollTop = $('chat-thread').scrollHeight;
  else if(active===3 && selectedFolderId) loadFolderFiles();
}
async function loadFolderFiles() {
  const box = $('folder-files');
  if (!box || !selectedFolderId) return;
  const folderId = selectedFolderId;
  try {
    const files = (await localFiles.list(folderId)).sort((a,b)=>b.savedAt-a.savedAt);
    if (folderId !== selectedFolderId || !$('folder-files')) return;
    box.innerHTML = files.length ? files.map(file=>`<button class="stored-file" data-file-id="${escapeHtml(file.id)}">${icon('receipt')}<span><strong>${escapeHtml(file.name)}</strong><small>${Math.max(1,Math.round(file.size/1024))} KB · ${new Date(file.savedAt).toLocaleDateString()}</small></span>${icon('arrow')}</button>`).join('') : '<div class="folder-empty">This folder is empty.</div>';
  } catch { box.innerHTML = '<div class="folder-empty">Files could not be loaded on this device.</div>'; }
}
function localDemoReply(message) {
  const trimmed=message.trim();
  const sentences=trimmed.split(/[.!?\n]+/).map(s=>s.trim()).filter(Boolean);
  if(sentences.length>=2 || trimmed.length>120) {
    return `Here's a quick reviewer from your notes:\n\n${sentences.slice(0,4).map((s,i)=>`${i+1}. ${s}`).join('\n')}\n\nTry reviewing each point in your own words.`;
  }
  return 'I can help organize your lesson notes into a reviewer. Paste a few sentences about your topic, and I’ll turn them into key points. A full local AI model has not been connected yet.';
}
function sendChat(message) {
  const text=message.trim();
  if(!text) return;
  chatMessages.push({role:'user',text});
  chatMessages.push({role:'assistant',text:localDemoReply(text)});
  if (!activeChatId) {
    activeChatId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
    chats.push({id:activeChatId,title:text.slice(0,36),updatedAt:Date.now(),messages:[]});
  }
  const chat = chats.find(item => item.id === activeChatId);
  chat.messages = chatMessages.map(item => ({...item}));
  chat.updatedAt = Date.now();
  localStorage.setItem(chatStoreKey, JSON.stringify(chats));
  render();
}
async function loadFeature(name) {
  const box = $('feature-content');
  try {
    if(name==='labs' || name==='reserve') {
      const pcs=await api('/computers');
      if(name==='labs') box.innerHTML=pcs.map(x=>`<div class="simple-card"><strong>${escapeHtml(x.label)} · ${escapeHtml(x.lab)}</strong><p>${escapeHtml(x.status)}</p></div>`).join('');
      else box.innerHTML=`<form id="reservation-form"><label class="field-label">Computer</label><select class="field" name="computer_id">${pcs.filter(x=>x.status==='available').map(x=>`<option value="${x.id}">${escapeHtml(x.label)} · ${escapeHtml(x.lab)}</option>`).join('')}</select><label class="field-label">Start</label><input class="field" type="datetime-local" name="starts_at" required><label class="field-label">End</label><input class="field" type="datetime-local" name="ends_at" required><button class="primary">Confirm reservation</button></form><div id="feature-result"></div>`;
    } else if(name==='printing') {
      box.innerHTML='<form id="printing-form"><label class="field-label">File name</label><input class="field" name="filename" placeholder="Report.pdf" required><label class="field-label">Pages</label><input class="field" name="pages" type="number" min="1" value="1" required><label class="field-label">Copies</label><input class="field" name="copies" type="number" min="1" value="1" required><button class="primary">Submit print request</button></form><div id="feature-result"></div>';
    } else if(name==='billing') {
      const payments=await api('/payments');box.innerHTML=payments.length?payments.map(x=>`<div class="simple-card"><strong>Receipt #${x.id}</strong><p>₱${Number(x.amount).toFixed(2)} · ${escapeHtml(x.method)}</p></div>`).join(''):'<div class="simple-card"><strong>No payments yet</strong><p>Your receipts will appear here.</p></div>';
    } else if(name==='schedule') {
      box.innerHTML=scheduleImagePanel()+'<div id="schedule-reservations"><div class="simple-card"><strong>Loading reservations…</strong></div></div>';
      const reservations=await api('/reservations');
      const list=$('schedule-reservations');
      if(list) list.innerHTML=reservations.length?reservations.map(x=>`<div class="simple-card"><strong>${escapeHtml(x.label)} · ${escapeHtml(x.lab)}</strong><p>${escapeHtml(x.starts_at.slice(0,16))} · ${escapeHtml(x.status)}</p></div>`).join(''):'<div class="simple-card"><strong>No reservations yet</strong><p>Your reservations will appear here.</p></div>';
    } else box.innerHTML='<div class="simple-card"><strong>Your study materials</strong><p>Use the Upload tab to select a file.</p></div>';
  } catch {if(name==='schedule' && $('schedule-reservations')) $('schedule-reservations').innerHTML='<div class="simple-card"><strong>Reservations unavailable</strong><p>Start the Omnira demo server to load bookings.</p></div>';else box.innerHTML='<div class="simple-card"><strong>Feature unavailable</strong><p>Start the Omnira demo server to load this feature.</p></div>';}
}
document.addEventListener('click', async event => {
  if(event.target.closest('[data-action="remove-schedule-image"]')) {localStorage.removeItem(scheduleImageKey);if(currentFeature==='schedule') loadFeature('schedule');return;}
  if(event.target.closest('[data-action="home-next-class"]')) {document.getElementById('class-schedule')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
  if(event.target.closest('[data-action="show-login"]')) {switchAuthView('login');return;}
  if(event.target.closest('[data-action="show-welcome"]')) {switchAuthView('welcome');return;}
  const tab = event.target.closest('[data-tab]');
  if(tab) { const destination=Number(tab.dataset.tab); if(destination===active && !currentFeature && !profileDetail) return; transitionPage(()=>{active=destination;currentFeature=null;historyOpen=false;profileDetail=null;});return; }
  const feature = event.target.closest('[data-feature]');
  if(feature) {
    const destination = feature.dataset.feature;
    transitionPage(()=>{currentFeature=destination;});
    return;
  }
  if(event.target.closest('[data-action="back-home"]')) {transitionPage(()=>{currentFeature=null;active=1;});return;}
  if(event.target.closest('[data-action="profile-back"]')) {profileDetail=null;render();return;}
  const profileSetting=event.target.closest('[data-profile-detail]');
  if(profileSetting) {profileDetail=profileSetting.dataset.profileDetail;render();return;}
  const monthButton=event.target.closest('[data-month]');
  if(monthButton) {activityMonth=new Date(activityMonth.getFullYear(),activityMonth.getMonth()+Number(monthButton.dataset.month),1);render(true);return;}
  const activityDate=event.target.closest('[data-activity-date]');
  if(activityDate) {selectedActivityDate=activityDate.dataset.activityDate;activityShowAll=false;activityMode='tasks';render(true);return;}
  const overview=event.target.closest('[data-overview]');
  if(overview) {
    const choice=overview.dataset.overview;
    if(choice==='projects') activityMode='projects';
    else {activityMode='tasks';activityShowAll=choice==='all';if(choice==='today'){selectedActivityDate=localDateKey(new Date());activityMonth=new Date(new Date().getFullYear(),new Date().getMonth(),1);}if(choice==='schedule'){const upcoming=planner.tasks.filter(task=>task.date>localDateKey(new Date())).sort((a,b)=>a.date.localeCompare(b.date))[0];if(upcoming){selectedActivityDate=upcoming.date;const date=new Date(`${upcoming.date}T12:00:00`);activityMonth=new Date(date.getFullYear(),date.getMonth(),1);}}}
    activityMenuOpen=false;activityFormOpen=false;render();
    requestAnimationFrame(()=>{$('screen').scrollTo({top:document.querySelector('.planner-section')?.offsetTop||0,behavior:'smooth'});});
    return;
  }
  if(event.target.closest('[data-action="activity-menu"]')) {activityMenuOpen=!activityMenuOpen;render();return;}
  const activityChoice=event.target.closest('[data-activity-mode]');
  if(activityChoice) {activityMode=activityChoice.dataset.activityMode;activityShowAll=false;activityMenuOpen=false;activityFormOpen=false;selectedProjectId=null;render();return;}
  if(event.target.closest('[data-action="activity-add"]')) {activityFormOpen=!activityFormOpen;activityMenuOpen=false;render();return;}
  const projectView=event.target.closest('[data-project-view]');
  if(projectView) {selectedProjectId=selectedProjectId===projectView.dataset.projectView?null:projectView.dataset.projectView;render();return;}
  const toggleTask=event.target.closest('[data-toggle-task]');
  if(toggleTask) {const task=planner.tasks.find(item=>item.id===toggleTask.dataset.toggleTask);if(task){task.done=!task.done;savePlanner();render();}return;}
  if(event.target.closest('[data-action="toggle-history"]')) {historyOpen=!historyOpen;render();return;}
  if(event.target.closest('[data-action="close-history"]')) {historyOpen=false;render();return;}
  if(event.target.closest('[data-action="new-chat"]')) {chatMessages=[];activeChatId=null;historyOpen=false;render();return;}
  if(event.target.closest('[data-action="add-folder"]')) {addFolderOpen=!addFolderOpen;render();return;}
  if(event.target.closest('[data-action="select-files"]')) {document.getElementById('upload-file')?.click();return;}
  const removeFile=event.target.closest('[data-remove-file]');
  if(removeFile) {queuedFiles=queuedFiles.filter(item=>item.id!==removeFile.dataset.removeFile);render();return;}
  if(event.target.closest('[data-action="cancel-upload"]')) {queuedFiles=[];addFolderOpen=false;render();return;}
  if(event.target.closest('[data-action="save-files"]')) {
    if(!selectedFolderId) return;
    let saved=0;
    for(const item of queuedFiles.filter(item=>item.status==='ready')) {
      try {await localFiles.save(item.file,selectedFolderId);item.status='saved';saved++;}
      catch(error) {item.status='failed';item.error='Save failed';}
    }
    render();
    if($('upload-feedback')) $('upload-feedback').innerHTML=`<div class="result">${saved} file${saved===1?'':'s'} saved to ${escapeHtml(subjectFolders.find(folder=>folder.id===selectedFolderId)?.name||'this folder')}.</div>`;
    return;
  }
  const folder = event.target.closest('[data-folder-id]');
  if(folder) {selectedFolderId=selectedFolderId===folder.dataset.folderId?null:folder.dataset.folderId;render();return;}
  const storedFile = event.target.closest('[data-file-id]');
  if(storedFile) {
    try {
      const file = await localFiles.get(storedFile.dataset.fileId);
      if(!file) return;
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement('a');
      link.href=url;link.download=file.name;link.click();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    } catch(error) { alert(`Could not open file: ${error.message}`); }
    return;
  }
  const previousChat=event.target.closest('[data-chat-id]');
  if(previousChat) {
    const selected=chats.find(item => item.id===previousChat.dataset.chatId);
    if(selected) {activeChatId=selected.id;chatMessages=selected.messages.map(item => ({...item}));historyOpen=false;render();}
    return;
  }
  if(event.target.closest('[data-action="attach"]')) {active=3;currentFeature=null;render();return;}
  const prompt=event.target.closest('[data-prompt]');
  if(prompt) {sendChat(prompt.dataset.prompt);return;}
  if(event.target.closest('[data-action="notifications"]')) alert('No new notifications.');
});
document.addEventListener('submit', async event => {
  if(event.target.id==='project-form' || event.target.id==='task-form') {
    event.preventDefault();
    const values=Object.fromEntries(new FormData(event.target));
    if(event.target.id==='project-form') planner.projects.push({id:crypto.randomUUID(),name:String(values.name).trim()});
    else planner.tasks.push({id:crypto.randomUUID(),title:String(values.title).trim(),date:values.date,projectId:values.projectId||null,done:false});
    savePlanner();activityFormOpen=false;render();return;
  }
  if(event.target.id === 'folder-form') {
    event.preventDefault();
    const name = String(new FormData(event.target).get('name')||'').trim();
    if(!name) return;
    if(subjectFolders.some(folder=>folder.name.toLowerCase()===name.toLowerCase())) {alert('That subject folder already exists.');return;}
    const folder = {id:crypto.randomUUID(),name};
    subjectFolders.push(folder);
    localStorage.setItem(folderStoreKey,JSON.stringify(subjectFolders));
    selectedFolderId=null;
    addFolderOpen=false;
    render();
    return;
  }
  if(event.target.id === 'chat-form') {
    event.preventDefault();
    sendChat(new FormData(event.target).get('message'));
    return;
  }
  if(event.target.id === 'reservation-form' || event.target.id === 'printing-form') {
    event.preventDefault();
    const values=Object.fromEntries(new FormData(event.target));
    try {
      const response=event.target.id==='reservation-form'
        ? await post('/reservations',{computer_id:Number(values.computer_id),starts_at:new Date(values.starts_at).toISOString(),ends_at:new Date(values.ends_at).toISOString()})
        : await post('/printing',{filename:values.filename,pages:Number(values.pages),copies:Number(values.copies)});
      $('feature-result').innerHTML=`<div class="result">${event.target.id==='reservation-form'?'Reservation':'Print request'} #${response.id} saved.</div>`;
    } catch(error) {$('feature-result').innerHTML=`<div class="result">${escapeHtml(error.message)}</div>`;}
    return;
  }
  if(event.target.id !== 'reviewer-form') return;
  event.preventDefault();
  const form = event.target;
  const values = Object.fromEntries(new FormData(form));
  try {
    const response = await post('/reviewer', values);
    $('gabay-result').innerHTML = `<div class="result">${escapeHtml(response.reviewer.join('\n\n'))}</div>`;
  } catch(error) {
    $('gabay-result').innerHTML = `<div class="result">${escapeHtml(error.message)}</div>`;
  }
});
document.addEventListener('keydown', event => {
  if(event.target.id === 'chat-input' && event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    event.target.closest('form').requestSubmit();
  }
});
document.addEventListener('change', event => {
  if(event.target.id === 'schedule-image-input') {
    const files=Array.from(event.target.files||[]);
    const feedback=$('schedule-image-feedback');
    if(files.length!==1 || !files[0].type.startsWith('image/')) {if(feedback) feedback.textContent='Choose one image file.';return;}
    if(files[0].size>2*1024*1024) {if(feedback) feedback.textContent='Image must be 2 MB or smaller.';return;}
    const reader=new FileReader();
    reader.onload=()=>{try {localStorage.setItem(scheduleImageKey,JSON.stringify({data:reader.result,name:files[0].name}));if(currentFeature==='schedule') loadFeature('schedule');}catch {if(feedback) feedback.textContent='Could not save this image on this device.';}};
    reader.readAsDataURL(files[0]);
    return;
  }
  if(event.target.id === 'upload-file') {
    addQueuedFiles(event.target.files || []);
  }
});
document.addEventListener('dragover', event => {
  if(event.target.closest('#upload-drop')) {event.preventDefault();event.target.closest('#upload-drop').classList.add('dragging');}
});
document.addEventListener('dragleave', event => {
  if(event.target.closest('#upload-drop')) event.target.closest('#upload-drop').classList.remove('dragging');
});
document.addEventListener('drop', event => {
  const drop=event.target.closest('#upload-drop');
  if(!drop) return;
  event.preventDefault();
  drop.classList.remove('dragging');
  addQueuedFiles(event.dataTransfer?.files || []);
});
document.addEventListener('submit', async event => {
  if(event.target.id!=='student-login') return;
  event.preventDefault();
  const values=Object.fromEntries(new FormData(event.target));
  if(window.OMNIRA_RECAPTCHA_SITE_KEY) {
    values.recaptcha_token=window.grecaptcha?.getResponse(recaptchaWidget)||'';
    if(!values.recaptcha_token) {if($('login-message')) $('login-message').textContent='Complete verification first.';return;}
  } else if(!$('demo-verified')?.checked) {if($('login-message')) $('login-message').textContent='Check the preview verification box first.';return;}
  try { student=await window.omnira.request('/auth/login',{method:'POST',body:JSON.stringify(values)}); authView='app'; render(); }
  catch { if(!window.OMNIRA_RECAPTCHA_SITE_KEY && values.email==='student@omnira.test' && values.password==='demo123'){student={name:'Alex Student',email:values.email}; authView='app'; render();} else if($('login-message')) $('login-message').textContent='Could not log in. Check your details and try again.'; }
});
render();
setInterval(()=>{if(authView==='app' && active===0) updateNextClass();},30000);

