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
  ,users: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m2 9v-2a5 5 0 0 0-3-4.6"/>'
  ,chart: '<path d="M4 20V4M4 20h16M8 16v-5m5 5V7m5 9v-8"/>'
  ,settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9 7 7m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const tabs = [
  ['Home','home'], ['Explore','compass'], ['Gabay AI','sparkles'], ['Upload','plus'], ['Activity','check'], ['Profile','profile']
];
const adminTabs = [['Home','home'],['Users','users'],['Gabay AI','sparkles'],['Upload','plus'],['Reports','chart'],['Profile','profile']];
const professorTabs = [['Home','home'],['Grade Report','chart'],['Classes','calendar'],['Gabay AI','sparkles'],['Upload','plus'],['Profile','profile']];
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
let professorClasses = [];
let professorGradeQueue = [];
let professorClassStatus = 'loading';
let professorGradeMessage = '';
let professorSectionKey = null;
const professorStoreKey = suffix => `omnira-professor-${suffix}-v1-${student?.id || 2}`;
function restoreProfessorData() {
  try { professorClasses=JSON.parse(localStorage.getItem(professorStoreKey('classes'))||'[]'); } catch { professorClasses=[]; }
  try { professorGradeQueue=JSON.parse(localStorage.getItem(professorStoreKey('grades'))||'[]'); } catch { professorGradeQueue=[]; }
  professorClassStatus=professorClasses.length?'cached':'loading';
}
function cacheProfessorData() {
  localStorage.setItem(professorStoreKey('classes'),JSON.stringify(professorClasses));
  localStorage.setItem(professorStoreKey('grades'),JSON.stringify(professorGradeQueue));
}
function applyPendingProfessorGrades() {
  for(const pending of professorGradeQueue) {
    const pupil=professorClasses.find(item=>item.id===pending.class_id)?.students.find(item=>item.id===pending.student_id);
    if(pupil) pupil.score=pending.score;
  }
}
async function loadProfessorClasses() {
  if(student?.role!=='professor') return;
  try {
    const assigned=await api('/professor/classes');
    professorClasses=assigned;
    professorClassStatus='ready';
    applyPendingProfessorGrades();
    cacheProfessorData();
  } catch { professorClassStatus=professorClasses.length?'cached':'offline'; }
  if(authView==='app' && student?.role==='professor') render(true);
}
let professorSyncing=false;
async function syncProfessorGrades() {
  if(student?.role!=='professor'||professorSyncing||!navigator.onLine||!professorGradeQueue.length) return;
  professorSyncing=true;
  try {
    while(professorGradeQueue.length) {
      const pending=professorGradeQueue[0];
      try { await post('/professor/grades',pending); }
      catch(error) {
        if(error.status===403) { professorGradeQueue.shift(); professorGradeMessage='A grade was rejected because this student is not in your class.'; cacheProfessorData(); continue; }
        professorGradeMessage='Grades are saved on this device and will sync when the server is available.';
        break;
      }
      professorGradeQueue.shift();
      professorGradeMessage='Grade saved and synced.';
      cacheProfessorData();
    }
    if(!professorGradeQueue.length) await loadProfessorClasses();
  } finally { professorSyncing=false; if(student?.role==='professor'&&authView==='app') render(true); }
}
window.addEventListener('online',()=>{if(student?.role==='professor'){loadProfessorClasses().then(syncProfessorGrades);}});
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
const classStoreKey='omnira-class-timetable-v1';
const defaultClassTimetable=[{title:'Programming',subject:'Computer Studies',start:'09:00',end:'10:30',day:'weekdays'},{title:'Philippine History',subject:'History',start:'13:00',end:'14:30',day:'weekdays'}];
let classTimetable=defaultClassTimetable;
try {const saved=JSON.parse(localStorage.getItem(classStoreKey)||'null');if(Array.isArray(saved)) classTimetable=saved;} catch {}
let adminSection=null;
const gradeReportKey='omnira-grade-reports-v1';
let gradeReports=[];
try {const saved=JSON.parse(localStorage.getItem(gradeReportKey)||'[]');if(Array.isArray(saved)) gradeReports=saved;} catch {}
let selectedGradeStudentId=null;
let gradeSearchQuery='';
const ticketStoreKey='omnira-admin-tickets-v1';
const demoTickets=[{id:'demo-lab',sender:'Alex Student',subject:'Computer Lab',messages:[{from:'student',text:'PC 12 is not turning on. Could someone check it?',at:Date.now()-3600000}],status:'new',updatedAt:Date.now()-3600000},{id:'demo-schedule',sender:'Prof. Reyes',subject:'Class schedule',messages:[{from:'professor',text:'Please check the room assignment for tomorrow’s class.',at:Date.now()-86400000}],status:'pending',updatedAt:Date.now()-86400000}];
let adminTickets=[];
try {const saved=JSON.parse(localStorage.getItem(ticketStoreKey)||'null');adminTickets=Array.isArray(saved)?saved:demoTickets;} catch {adminTickets=demoTickets;}
let selectedTicketId=null;
let ticketMenuId=null;
let ticketReplyTo=null;
let ticketAttachment=null;
let ticketDraft='';
const saveTickets=()=>localStorage.setItem(ticketStoreKey,JSON.stringify(adminTickets));
let adminUserRole='professor';
let adminUserMenuId=null;
let adminUsers=[{id:1,name:'Alex Student',email:'student@omnira.test',role:'student',course:'BSIT'},{id:2,name:'Prof. Reyes',email:'professor@omnira.test',role:'professor',department:'Computer Studies'}];
let adminUsersLoaded=false;
const adminUserStatusKey='omnira-admin-user-status-v1';
let adminUserStatuses={};
try {adminUserStatuses=JSON.parse(localStorage.getItem(adminUserStatusKey)||'{}')||{};} catch {}
function adminUserRows() {
  const accounts=adminUsers.filter(person=>person.role===adminUserRole);
  if(!accounts.length) return '<div class="simple-card"><p>No accounts in this group yet.</p></div>';
  const key=adminUserRole==='student'?'course':'department';
  const groups=new Map();
  for(const person of accounts){const group=String(person[key]||'Unassigned').trim()||'Unassigned';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(person);}
  return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([group,people])=>`<section class="admin-user-group"><h2>${escapeHtml(group)} <span>${people.length}</span></h2>${people.map(person=>{
    const status=adminUserStatuses[person.id]||'active';
    const open=adminUserMenuId===String(person.id);
    return `<div class="admin-user-card"><span class="admin-user-avatar">${escapeHtml(person.name.slice(0,1).toUpperCase())}</span><div class="admin-user-info"><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.email)}</small><span class="admin-user-status ${escapeHtml(status)}">${escapeHtml(status)}</span></div><div class="admin-user-actions"><button class="admin-user-more" data-user-menu="${person.id}" aria-label="Actions for ${escapeHtml(person.name)}" aria-expanded="${open}">⋮</button>${open?`<div class="admin-user-menu"><button data-user-action="deleted" data-user-id="${person.id}" ${status==='deleted'?'disabled':''}>Delete</button><button data-user-action="archived" data-user-id="${person.id}" ${status==='archived'?'disabled':''}>Archive</button><button data-user-action="suspended" data-user-id="${person.id}" ${status==='suspended'?'disabled':''}>Suspend</button>${status!=='active'?`<button data-user-action="active" data-user-id="${person.id}">Restore access</button>`:''}</div>`:''}</div></div>`;
  }).join('')}</section>`).join('');
}
function adminUsersPage() {
  return `${brand()}<div class="eyebrow">Admin workspace</div><h1>Users</h1><p class="intro">Students by course and professors by department.</p><div class="admin-user-tabs"><button data-admin-user-role="professor" class="${adminUserRole==='professor'?'selected':''}" aria-pressed="${adminUserRole==='professor'}">Professor</button><button data-admin-user-role="student" class="${adminUserRole==='student'?'selected':''}" aria-pressed="${adminUserRole==='student'}">Students</button></div><div id="admin-user-list">${adminUserRows()}</div><p class="small-note">Account status actions are a browser preview until shared account management is connected.</p>`;
}
async function loadAdminUsers() {
  if(adminUsersLoaded) return;
  adminUsersLoaded=true;
  try {const accounts=await api('/users');if(Array.isArray(accounts)) adminUsers=accounts.filter(person=>person.role==='student'||person.role==='professor').map(person=>({...person,course:person.course||(person.email==='student@omnira.test'?'BSIT':null),department:person.department||(person.email==='professor@omnira.test'?'Computer Studies':null)}));}
  catch { /* Keep the demo accounts when the API is unavailable. */ }
  if(student?.role==='admin' && active===1 && $('admin-user-list')) $('admin-user-list').innerHTML=adminUserRows();
  if(student?.role==='admin' && active===0 && adminSection==='grade-report') render(true);
}
const sectionStoreKey='omnira-class-sections-v1';
let classSections=[];
try {const saved=JSON.parse(localStorage.getItem(sectionStoreKey)||'[]');if(Array.isArray(saved)) classSections=saved;} catch {}
const saveSections=()=>localStorage.setItem(sectionStoreKey,JSON.stringify(classSections));
let selectedSectionId=null;
let generatedScheduleSectionId=null;
let scheduleMode='create';
function scheduleSearchResults(query='') {
  const matching=classSections.filter(item=>item.name.toLowerCase().includes(query.trim().toLowerCase()));
  return matching.length?matching.map(item=>`<button type="button" class="admin-section-choice" data-generate-section="${escapeHtml(item.id)}"><strong>${escapeHtml(item.name)}</strong><small>${classesForSection(item).length} classes</small>${icon('arrow')}</button>`).join(''):'<p class="small-note">No matching section found.</p>';
}
function classesForSection(section) {
  return classTimetable.filter(item=>item.sectionId===section?.id || (!item.sectionId && !section?.customSchedule));
}
function studentClasses() {
  const section=classSections.find(item=>item.students.some(person=>person.userId===student?.id || person.email===student?.email));
  return classesForSection(section);
}
function generateSubjectSchedule(value) {
  const subjects=String(value).split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(!subjects.length) throw new Error('Enter at least one subject.');
  if(subjects.length>20) throw new Error('Add up to 20 subjects per section.');
  const slots=[['09:00','10:30'],['10:30','12:00'],['13:00','14:30'],['14:30','16:00']];
  return subjects.map((subject,index)=>{
    const [start,end]=slots[Math.floor(index/5)];
    return {title:subject,subject,day:String(index%5+1),start,end};
  });
}
let studentSearchResults=[];
let studentSearchRequestId=0;
async function searchSectionStudents(value) {
  const resultBox=$('student-mention-results');
  if(!resultBox) return;
  if(!value.startsWith('@')) {studentSearchResults=[];resultBox.innerHTML='<p>Start with @ to find a student account.</p>';return;}
  const requestId=++studentSearchRequestId;
  const query=value.slice(1).trim();
  resultBox.innerHTML='<p>Searching students…</p>';
  try {studentSearchResults=await api(`/users/students?query=${encodeURIComponent(query)}`);}
  catch {studentSearchResults=[{id:1,name:'Alex Student',email:'student@omnira.test'}].filter(person=>`${person.name} ${person.email}`.toLowerCase().includes(query.toLowerCase()));}
  if(requestId!==studentSearchRequestId || !$('student-mention-results')) return;
  resultBox.innerHTML=studentSearchResults.length?studentSearchResults.map((person,index)=>{
    const assigned=classSections.find(section=>section.students.some(item=>item.userId===person.id || item.email===person.email || item.name.toLowerCase()===person.name.toLowerCase()));
    return `<button type="button" class="student-search-result" data-add-student-index="${index}" ${assigned?'disabled':''}><span><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.email)}</small></span><b>${assigned?`In ${escapeHtml(assigned.name)}`:'Add'}</b></button>`;
  }).join(''):'<p>No student account found.</p>';
}
const scheduleImageKey='omnira-schedule-image-v1';
function scheduleImagePanel() {
  let saved;
  try { saved=JSON.parse(localStorage.getItem(scheduleImageKey)||'null'); } catch {}
  return `<div class="simple-card schedule-image-card"><strong>Class schedule image</strong><p>Add one image of your timetable. You can replace it anytime.</p><label class="schedule-image-button" for="schedule-image-input">${saved?'Replace image':'Upload image'}</label><input id="schedule-image-input" type="file" accept="image/*" hidden><div id="schedule-image-feedback" aria-live="polite"></div>${saved?`<div class="schedule-image-preview"><img src="${saved.data}" alt="Uploaded class schedule"><button type="button" data-action="remove-schedule-image" aria-label="Remove schedule image">Remove</button></div>`:''}</div>`;
}
function nextClass(now=new Date()) {
  for(let offset=0;offset<8;offset++) {
    const day=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset);
    for(const item of studentClasses().filter(entry=>entry.day==='weekdays'||Number(entry.day)===day.getDay()).sort((a,b)=>a.start.localeCompare(b.start))) {
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
  const item=student?.role==='professor'?nextProfessorClass():nextClass();
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
    <div class="class-schedule-card" id="class-schedule"><div class="class-schedule-note">Class timetable</div>${studentClasses().length?studentClasses().map(item=>`<div class="class-row"><span>${new Date('2000-01-01T'+item.start).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}<br>${new Date('2000-01-01T'+item.end).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</span><strong>${escapeHtml(item.title)}<small>${item.subject!==item.title?`${escapeHtml(item.subject)} · `:''}${escapeHtml(item.day==='weekdays'?'Weekdays':['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][Number(item.day)]||'Weekdays')}</small></strong>${icon('calendar')}</div>`).join(''):'<p class="small-note">No classes arranged yet.</p>'}</div>
    <div class="deadline-card"><section><h2>${icon('calendar')} Due Today <span>${dueToday.length}</span></h2>${dueToday.length?dueToday.slice(0,3).map(task=>`<button data-tab="4" class="deadline-row"><i></i><strong>${escapeHtml(task.title)}</strong></button>`).join(''):'<p>No deadlines today</p>'}</section><section><h2>${icon('receipt')} Upcoming Deadlines <span>${later.length}</span></h2>${later.length?later.slice(0,3).map(task=>`<button data-tab="4" class="deadline-row"><i></i><strong>${escapeHtml(task.title)}<small>${new Date(task.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</small></strong></button>`).join(''):'<p>No upcoming deadlines</p>'}</section></div>`;
}
const weekDays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function nextProfessorClass(now=new Date()) {
  for(let offset=0;offset<8;offset++) {
    const day=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset);
    const options=professorClasses.filter(item=>Number(item.day_of_week)===day.getDay()).sort((a,b)=>a.start_time.localeCompare(b.start_time));
    for(const item of options) {
      const [hour,minute]=item.start_time.split(':').map(Number);
      const starts=new Date(day.getFullYear(),day.getMonth(),day.getDate(),hour,minute);
      if(starts>now) return {...item,title:item.subject,starts};
    }
  }
  return null;
}
function professorHome() {
  const today=localDateKey(new Date()), day=weekDays[new Date().getDay()];
  const upcoming=planner.tasks.filter(task=>!task.done&&task.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
  const dueToday=upcoming.filter(task=>task.date===today), later=upcoming.filter(task=>task.date>today);
  const next=nextProfessorClass(), minutes=next?Math.ceil((next.starts-Date.now())/60000):0;
  const name=(student?.name||'Professor').split(' ')[0];
  const dateLabel=new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
  return `<div class="home-top">${brand()}<div class="home-date">${dateLabel}</div><h1>Good morning<br><span>${escapeHtml(name)},</span></h1>
    <button class="home-current" data-action="home-next-class"><span><small>Up next · ${next?next.starts.toLocaleDateString('en-US',{weekday:'short'}):'Schedule'}</small><strong class="home-next-title">${escapeHtml(next?.subject||'No upcoming class')}</strong><small>${escapeHtml(next?.section_name||'Class schedule')}</small></span><span class="home-current-action"><b class="home-next-countdown">${next?`${minutes} min until class`:'View schedule'}</b>${icon('arrow')}</span></button>
    <div class="home-summary"><button data-tab="2">${icon('calendar')}<b>${professorClasses.filter(item=>Number(item.day_of_week)===new Date().getDay()).length}</b><span>Today's classes</span>${icon('arrow')}</button><button data-action="professor-paperworks">${icon('check')}<b>${upcoming.length}</b><span>Paperworks</span>${icon('arrow')}</button></div></div>
    <div class="home-upcoming-head"><h2>Class Schedule</h2><button data-tab="2" aria-label="View classes">${icon('arrow')}</button></div>
    <div class="class-schedule-card" id="class-schedule"><div class="class-schedule-note">Class timetable</div>${professorClasses.length?professorClasses.map(item=>`<div class="class-row"><span>${new Date('2000-01-01T'+item.start_time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}<br>${new Date('2000-01-01T'+item.end_time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</span><strong>${escapeHtml(item.subject)}<small>${escapeHtml(item.section_name)} · ${escapeHtml(weekDays[Number(item.day_of_week)])}</small></strong>${icon('calendar')}</div>`).join(''):`<p class="small-note">${professorClassStatus==='offline'?'Connect once to download your assigned classes for offline use.':'No classes assigned yet.'}</p>`}</div>
    <div class="deadline-card" id="professor-paperworks"><section><h2>${icon('calendar')} Due Today <span>${dueToday.length}</span></h2>${dueToday.length?dueToday.slice(0,3).map(task=>`<div class="deadline-row"><i></i><strong>${escapeHtml(task.title)}</strong></div>`).join(''):'<p>No deadlines today</p>'}</section><section><h2>${icon('receipt')} Upcoming Deadlines <span>${later.length}</span></h2>${later.length?later.slice(0,3).map(task=>`<div class="deadline-row"><i></i><strong>${escapeHtml(task.title)}<small>${new Date(task.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</small></strong></div>`).join(''):'<p>No upcoming deadlines</p>'}</section></div>`;
}
function professorSections() {
  const groups=new Map();
  for(const item of professorClasses) {
    const key=`${item.course}|${item.section_name}`;
    if(!groups.has(key)) groups.set(key,{key,course:item.course,name:item.section_name,classes:[]});
    groups.get(key).classes.push(item);
  }
  return [...groups.values()];
}
function professorClassesPage() {
  const sections=professorSections();
  const selected=sections.find(section=>section.key===professorSectionKey);
  if(selected) return `${brand()}<button class="admin-back" data-action="professor-section-back">← Classes</button><div class="eyebrow">${escapeHtml(selected.course)}</div><h1>${escapeHtml(selected.name)}</h1><p class="intro">Subjects, schedules, and meeting links for this section.</p><div class="professor-section-detail">${selected.classes.map(item=>`<section class="professor-meeting-card"><div class="professor-grade-subject-title"><strong>${escapeHtml(item.subject)}</strong><small>${escapeHtml(weekDays[Number(item.day_of_week)]||item.day_of_week)} · ${escapeHtml(item.start_time)}–${escapeHtml(item.end_time)}</small></div>${item.meeting_url?`<a class="professor-meeting-link" href="${escapeHtml(item.meeting_url)}" target="_blank" rel="noopener noreferrer">Open meeting ${icon('arrow')}</a>`:'<p class="small-note">No meeting link added yet.</p>'}<form class="professor-meeting-form" data-class-id="${item.id}"><input type="url" name="url" value="${escapeHtml(item.meeting_url||'')}" placeholder="https://meeting-link" aria-label="Meeting link for ${escapeHtml(item.subject)}"><button type="submit">${item.meeting_url?'Update link':'Add link'}</button></form></section>`).join('')}</div><p class="small-note" role="status">${escapeHtml(professorGradeMessage)}</p>`;
  return `${brand()}<div class="eyebrow">Professor workspace</div><h1>Classes</h1><p class="intro">Open a section to see its subjects and meeting links.</p><div class="professor-section-grid">${sections.length?sections.map(section=>`<button class="professor-section-card professor-card-button" data-professor-section="${escapeHtml(section.key)}"><span class="professor-section-icon">${icon('book')}</span><span><small>${escapeHtml(section.course)}</small><h2>${escapeHtml(section.name)}</h2><p>${section.classes.length} ${section.classes.length===1?'subject':'subjects'} · ${new Set(section.classes.flatMap(item=>item.students.map(pupil=>pupil.id))).size} students</p></span><span class="professor-card-arrow">${icon('arrow')}</span></button>`).join(''):`<div class="simple-card"><p>${professorClassStatus==='offline'?'Connect once to load your classes for offline use.':'No classes assigned yet.'}</p></div>`}</div>`;
}
function professorGradePage() {
  const sections=professorSections();
  const selected=sections.find(section=>section.key===professorSectionKey);
  const status=`<div class="professor-sync ${professorGradeQueue.length?'pending':''}">${icon(professorGradeQueue.length?'receipt':'check')}<span>${professorGradeQueue.length?`${professorGradeQueue.length} grade ${professorGradeQueue.length===1?'change':'changes'} pending sync`:professorClassStatus==='offline'?'Offline · connect to load classes':professorClassStatus==='cached'?'Showing saved classes · checking connection':'Grades up to date'}</span>${professorGradeQueue.length?'<button data-action="sync-professor-grades">Sync now</button>':''}</div>${professorGradeMessage?`<p class="small-note" role="status">${escapeHtml(professorGradeMessage)}</p>`:''}`;
  if(!selected) return `${brand()}<div class="eyebrow">Professor workspace</div><h1>Grade Report</h1><p class="intro">Choose a section to view and grade its students.</p>${status}<div class="professor-section-grid">${sections.length?sections.map(section=>`<button class="professor-section-card professor-card-button" data-professor-section="${escapeHtml(section.key)}"><span class="professor-section-icon">${icon('chart')}</span><span><small>${escapeHtml(section.course)}</small><h2>${escapeHtml(section.name)}</h2><p>${section.classes.length} ${section.classes.length===1?'subject':'subjects'} · ${new Set(section.classes.flatMap(item=>item.students.map(pupil=>pupil.id))).size} students</p></span><span class="professor-card-arrow">${icon('arrow')}</span></button>`).join(''):`<div class="simple-card"><p>${professorClassStatus==='offline'?'Connect once to load your assigned classes.':'No sections assigned yet.'}</p></div>`}</div>`;
  return `${brand()}<button class="admin-back" data-action="professor-section-back">← Grade Report</button><div class="eyebrow">${escapeHtml(selected.course)}</div><h1>${escapeHtml(selected.name)}</h1><p class="intro">Students and grades in your assigned subjects.</p>${status}<div class="professor-grade-sections">${selected.classes.map(item=>`<section class="professor-grade-section"><header><span class="professor-section-icon">${icon('book')}</span><span><h2>${escapeHtml(item.subject)}</h2><small>${escapeHtml(weekDays[Number(item.day_of_week)]||item.day_of_week)} · ${item.students.length} students</small></span></header>${item.students.length?item.students.map(pupil=>`<form class="professor-grade-form" data-class-id="${item.id}" data-student-id="${pupil.id}"><label><span>${escapeHtml(pupil.name)}</span><input type="number" name="score" min="0" max="100" step="0.01" inputmode="decimal" value="${pupil.score??''}" placeholder="—" aria-label="Grade for ${escapeHtml(pupil.name)} in ${escapeHtml(item.subject)}" required></label><button type="submit">Save</button></form>`).join(''):'<p class="small-note">No students enrolled in this subject.</p>'}</section>`).join('')}</div><p class="small-note">Grades entered offline are saved on this device and sync automatically when internet returns.</p>`;
}
function professorPage() { return [professorHome,professorGradePage,professorClassesPage,gabay,upload,profile][active](); }
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
  const groups=[['Account',[['Manage Profile','profile'],['Password & Security','lock'],['Language','globe','English']]],['Preferences',[['Theme','sparkles','Light']]],['Support',[['Help Center','help'],['Contact Us','phone']]]];
  const rows=items=>items.map(([label,glyph,value])=>`<button class="profile-setting" data-profile-detail="${escapeHtml(label)}"><span class="profile-setting-icon">${icon(glyph)}</span><span>${label}</span>${value?`<small>${value}</small>`:''}<svg class="profile-row-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>`).join('');
  return `<div class="profile-title">${profileDetail?`<button data-action="profile-back" aria-label="Back to profile">‹</button>`:''}<strong>${profileDetail?escapeHtml(profileDetail):'Profile'}</strong></div>${profileDetail?`<div class="profile-detail-card"><span class="profile-avatar">${escapeHtml((student?.name||'Alex Student').slice(0,1).toUpperCase())}</span><h2>${escapeHtml(profileDetail)}</h2><p>${profileDetail==='Manage Profile'?'Your profile details will appear here.':profileDetail==='Appointments'?'Your upcoming appointments will appear here.':'This setting is ready for the next part of the app.'}</p></div>`:`<div class="profile-account"><span class="profile-avatar">${escapeHtml((student?.name||'Alex Student').slice(0,1).toUpperCase())}</span><span><strong>${escapeHtml(student?.name||'Alex Student')}</strong><small>${escapeHtml(student?.email||'student@omnira.test')}</small></span></div>${groups.map(([title,items])=>`<section class="profile-group"><h2>${title}</h2><div class="profile-list">${rows(items)}</div></section>`).join('')}`}`;
}
function arrangeClassPage() {
  const section=classSections.find(item=>item.id===selectedSectionId);
  const markup=`${brand()}<button class="admin-back" data-action="admin-home">← Home</button><div class="eyebrow">Admin workspace</div><h1>Arrange Class</h1><p class="intro">Create a section, then add its students.</p>
    <div class="section-heading"><h2>Sections</h2></div>
    <form id="admin-section-form" class="simple-card admin-class-form"><label class="field-label">Section name<input class="field" name="name" placeholder="e.g. BSIT 1A" required></label><button class="primary">Create section</button><div id="section-form-message" role="status"></div></form>
    <div class="admin-section-list">${classSections.length?classSections.map(item=>`<button class="admin-section-choice ${item.id===selectedSectionId?'selected':''}" data-section-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.name)}</strong><small>${item.students.length} student${item.students.length===1?'':'s'}</small>${icon('arrow')}</button>`).join(''):'<div class="simple-card"><p>No sections yet. Create one above to get started.</p></div>'}</div>
    ${section?`<div class="section-heading"><h2>${escapeHtml(section.name)} students</h2></div><div class="simple-card admin-class-form"><label class="field-label">Find a student<input class="field" id="student-mention-search" type="search" placeholder="Type @ then a name or email" autocomplete="off"></label><div id="student-mention-results" class="student-mention-results" role="status"><p>Start with @ to find a student account.</p></div></div>${section.students.length?section.students.map(item=>`<div class="simple-card admin-class-item"><div><strong>${escapeHtml(item.name)}</strong><p>${item.email?escapeHtml(item.email):`ID: ${escapeHtml(item.studentId)}`}</p></div><button data-remove-section-student="${escapeHtml(item.studentId)}" aria-label="Remove ${escapeHtml(item.name)} from ${escapeHtml(section.name)}">Remove</button></div>`).join(''):'<p class="small-note">No students in this section yet.</p>'}`:''}
    <p class="small-note">Sections and student assignments are saved in this browser.</p>`;
  return markup;
}
function generateSchedulePage() {
  const section=classSections.find(item=>item.id===generatedScheduleSectionId);
  const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const formatTime=value=>new Date(`2000-01-01T${value}`).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  const classes=section?classesForSection(section):[];
  const schedule=section?`<div id="generated-schedule" class="generated-schedule"><div class="generated-schedule-brand"><img src="assets/logo-transparent.png" alt="Omnira"><span>CLASS SCHEDULE</span></div><h2>${escapeHtml(section.name)}</h2><p>${section.students.length} student${section.students.length===1?'':'s'} · Generated ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</p>${[1,2,3,4,5,6,0].map(day=>{const daily=classes.filter(item=>item.day==='weekdays'&&day>=1&&day<=5 || Number(item.day)===day).sort((a,b)=>a.start.localeCompare(b.start));return daily.length?`<section class="generated-day"><h3>${weekdays[day]}</h3>${daily.map(item=>`<div class="generated-class"><span>${escapeHtml(formatTime(item.start))}–${escapeHtml(formatTime(item.end))}</span><div><strong>${escapeHtml(item.title)}</strong>${item.subject!==item.title?`<small>${escapeHtml(item.subject)}</small>`:''}</div></div>`).join('')}</section>`:'';}).join('')||'<div class="generated-empty">No classes have been arranged for this section yet.</div>'}<small>Omnira · Campus schedule preview</small></div><button class="primary print-schedule" data-action="print-schedule">Print or save as PDF</button>`:'';
  const createForm=`<form id="generate-new-schedule-form" class="simple-card admin-class-form"><label class="field-label">Section name<input class="field" name="sectionName" placeholder="e.g. BSIT 1D" required></label><label class="field-label">Subjects<textarea class="field schedule-lines-input" name="subjects" placeholder="Computer Programming&#10;Philippine History&#10;Mathematics" required></textarea></label><p class="small-note">One subject per line. Each class lasts 90 minutes, starting at 9:00 AM.</p><button class="primary">Create section and generate</button><div id="schedule-lines-message" role="status"></div></form>`;
  const searchForm=`<div class="simple-card admin-class-form"><label class="field-label">Search section<input class="field" id="schedule-section-search" type="search" placeholder="Type a section name" autocomplete="off"></label><div id="schedule-search-results" class="admin-section-list">${scheduleSearchResults()}</div></div>`;
  return `${brand()}<button class="admin-back" data-action="admin-home">← Home</button><div class="eyebrow">Admin workspace</div><h1>Generate Class Schedule</h1><p class="intro">${scheduleMode==='create'?'List subjects and Omnira will assign the class times.':'Find a section to view its schedule.'}</p><div class="schedule-mode-switch"><button type="button" data-schedule-mode="create" class="${scheduleMode==='create'?'selected':''}" aria-pressed="${scheduleMode==='create'}">Create</button><button type="button" data-schedule-mode="search" class="${scheduleMode==='search'?'selected':''}" aria-pressed="${scheduleMode==='search'}">Search</button></div>${scheduleMode==='create'?createForm:searchForm}${schedule}<p class="small-note">Schedules are saved in this browser. Printing can save a PDF.</p>`;
}
function gradeStudentResults() {
  const matches=adminUsers.filter(person=>person.role==='student' && (person.name+' '+person.email).toLowerCase().includes(gradeSearchQuery.toLowerCase().trim()) && (gradeSearchQuery || !selectedGradeStudentId || String(person.id)===String(selectedGradeStudentId)));
  return matches.length?matches.map(person=>`<button class="grade-student-result ${String(person.id)===String(selectedGradeStudentId)?'selected':''}" data-grade-student="${person.id}" aria-pressed="${String(person.id)===String(selectedGradeStudentId)}"><span class="admin-user-avatar">${escapeHtml(person.name.slice(0,1).toUpperCase())}</span><span><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(person.email)}</small></span><em>${String(person.id)===String(selectedGradeStudentId)?'Selected':'View grades'}</em></button>`).join(''):'<p class="small-note">No students found.</p>';
}
function gradeSubjectsFor(account) {
  const section=classSections.find(item=>item.students?.some(person=>String(person.userId)===String(account.id)||person.email===account.email));
  const scheduled=classTimetable.filter(item=>!item.sectionId || item.sectionId===section?.id).map(item=>String(item.title||item.subject||'').trim());
  const recorded=gradeReports.filter(item=>String(item.studentId)===String(account.id)).map(item=>item.subject);
  return [...new Map([...scheduled,...recorded].filter(Boolean).map(subject=>[subject.toLowerCase(),subject])).values()];
}
function gradeReportPage() {
  const account=adminUsers.find(person=>person.role==='student'&&String(person.id)===String(selectedGradeStudentId));
  const records=account?gradeReports.filter(item=>String(item.studentId)===String(account.id)):[];
  const latest=new Map(records.sort((a,b)=>a.createdAt-b.createdAt).map(item=>[item.subject.toLowerCase(),item]));
  const subjects=account?gradeSubjectsFor(account):[];
  return `${brand()}<button class="admin-back" data-action="admin-home">← Home</button><div class="eyebrow">Admin workspace</div><h1>Grade Report</h1><p class="intro">Find a student to view subject grades.</p><label class="field-label">Search student<input class="field" id="grade-student-search" type="search" value="${escapeHtml(gradeSearchQuery)}" placeholder="Type a student name" autocomplete="off"></label><div id="grade-student-results" class="grade-student-results">${gradeStudentResults()}</div>${account?`<section class="grade-compact grade-readonly"><div class="grade-compact-head"><span class="admin-user-avatar">${escapeHtml(account.name.slice(0,1).toUpperCase())}</span><span><strong>${escapeHtml(account.name)}</strong><small>${escapeHtml(account.course||account.email)}</small></span></div><div class="grade-compact-label"><span>Subject</span><span>Grade</span></div>${subjects.length?subjects.map(subject=>{const item=latest.get(subject.toLowerCase());return `<div class="grade-compact-row"><span>${escapeHtml(subject)}</span><strong>${item?Number(item.grade).toFixed(1):'—'}</strong></div>`;}).join(''):'<p class="grade-card-empty">No subjects or grades available.</p>'}</section>`:'<div class="simple-card"><p>Select a student above to view grades.</p></div>'}<p class="small-note">A dash means no grade has been recorded for that subject.</p>`;
}
function reportsPage() {
  const ticket=adminTickets.find(item=>item.id===selectedTicketId&&item.status!=='deleted');
  if(ticket) return `<div class="ticket-conversation">${brand()}<button class="admin-back" data-ticket-back>← Reports</button><div class="eyebrow">Ticket report</div><h1>${escapeHtml(ticket.sender)}</h1><p class="intro">${escapeHtml(ticket.subject)} · ${ticket.status==='done'?'Done':'Pending'}</p><div class="ticket-thread">${ticket.messages.map((message,index)=>`<div class="ticket-message ${message.from==='admin'?'outgoing':''}" ${message.from!=='admin'?`data-swipe-reply="${index}"`:''}><div class="ticket-bubble ${message.from==='admin'?'outgoing':''}">${message.replyTo?`<div class="ticket-quoted"><strong>${escapeHtml(message.replyTo.sender)}</strong><span>${escapeHtml(message.replyTo.text)}</span></div>`:''}${message.text?`<p>${escapeHtml(message.text)}</p>`:''}${message.image?`<img class="ticket-message-image" src="${message.image}" alt="Attached image">`:''}<small>${new Date(message.at).toLocaleString()}</small></div>${message.from!=='admin'?`<button class="ticket-inline-reply" data-reply-message="${index}" aria-label="Reply to ${escapeHtml(ticket.sender)} message">↩</button>`:''}</div>`).join('')}</div><form id="ticket-reply-form" class="ticket-reply-form">${ticketReplyTo!==null&&ticket.messages[ticketReplyTo]?`<div class="ticket-composer-preview"><span><strong>Replying to ${escapeHtml(ticket.sender)}</strong><small>${escapeHtml(ticket.messages[ticketReplyTo].text||'Image')}</small></span><button type="button" data-clear-ticket-reply aria-label="Cancel reply">×</button></div>`:''}${ticketAttachment?`<div class="ticket-composer-preview"><img src="${ticketAttachment.data}" alt="Image ready to send"><span><strong>Image ready</strong><small>${escapeHtml(ticketAttachment.name)}</small></span><button type="button" data-clear-ticket-image aria-label="Remove image">×</button></div>`:''}<div class="ticket-composer-row"><button type="button" class="ticket-image-button" data-add-ticket-image aria-label="Add image">＋</button><input id="ticket-image-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden><input class="field" name="reply" maxlength="500" value="${escapeHtml(ticketDraft)}" placeholder="Write a reply…" aria-label="Write a reply"><button class="ticket-send-button" aria-label="Send reply">➤</button></div><div id="ticket-compose-error" role="status"></div></form></div>`;
  const visible=[...adminTickets].filter(item=>item.status!=='deleted').sort((a,b)=>b.updatedAt-a.updatedAt);
  return `${brand()}<div class="eyebrow">Admin workspace</div><h1>Reports</h1><p class="intro">Messages and ticket reports from campus users.</p><div class="ticket-summary"><span><i></i> ${visible.filter(item=>item.status==='new').length} new</span><span>${visible.filter(item=>item.status==='pending').length} pending</span><span>${visible.filter(item=>item.status==='done').length} done</span></div><div class="ticket-list">${visible.length?visible.map(item=>`<div class="ticket-item"><button class="ticket-open" data-ticket-open="${escapeHtml(item.id)}"><span class="admin-user-avatar">${escapeHtml(item.sender.slice(0,1).toUpperCase())}</span><span class="ticket-preview"><strong>${escapeHtml(item.sender)} <small>${escapeHtml(item.subject)}</small></strong><span>${escapeHtml(item.messages.at(-1)?.text||'')}</span><em class="ticket-status ${item.status}">${item.status==='new'?'New':item.status==='done'?'Done':'Pending'}</em></span></button><div class="admin-user-actions"><button class="admin-user-more" data-ticket-menu="${escapeHtml(item.id)}" aria-label="Actions for ${escapeHtml(item.sender)} ticket" aria-expanded="${ticketMenuId===item.id}">⋮</button>${ticketMenuId===item.id?`<div class="admin-user-menu"><button data-ticket-action="done" data-ticket-id="${escapeHtml(item.id)}">Mark done</button><button data-ticket-action="deleted" data-ticket-id="${escapeHtml(item.id)}">Delete</button></div>`:''}</div></div>`).join(''):'<div class="simple-card"><p>No ticket reports yet.</p></div>'}</div><p class="small-note">Ticket reports are saved in this browser preview only.</p>`;
}
function adminPage() {
  const name=(student?.name||'Campus Admin').split(' ')[0];
  if(active===0 && adminSection==='arrange-class') return arrangeClassPage();
  if(active===0 && adminSection==='generate-schedule') return generateSchedulePage();
  if(active===0 && adminSection==='grade-report') return gradeReportPage();
  if(active===0) {const recent=[...adminTickets].filter(item=>item.status==='new').sort((a,b)=>b.updatedAt-a.updatedAt)[0];return `${brand()}<div class="eyebrow">Admin workspace</div><h1>Welcome, ${escapeHtml(name)}</h1><p class="intro">Your campus overview starts here.</p><div class="admin-welcome-card"><span>OMNIRA ADMIN</span><strong>Campus management</strong><p>Arrange classes, view grades, and review campus reports.</p></div><div class="section-heading"><h2>Overview</h2></div><div class="admin-summary-grid"><button class="simple-card admin-overview-action" data-action="arrange-class">${icon('calendar')}<strong>Arrange Class</strong><p>Organize sections and students</p></button><button class="simple-card admin-overview-action" data-action="generate-schedule">${icon('receipt')}<strong>Generate Class Schedule</strong><p>Print a section timetable</p></button><button class="simple-card admin-overview-action" data-action="grade-report">${icon('chart')}<strong>Grade Report</strong><p>View subject grades</p></button></div><div class="section-heading"><h2>Recent notification</h2></div><button class="recent-notification" data-action="open-reports"><span class="notification-mark ${recent?'new':''}">${icon('bell')}</span><span><strong>${recent?escapeHtml(recent.sender+' · '+recent.subject):'You’re all caught up'}</strong><small>${recent?escapeHtml(recent.messages.at(-1)?.text||'New ticket report'):'No new ticket reports'}</small></span>${icon('arrow')}</button>`;}
  if(active===1) return adminUsersPage();
  if(active===2) return gabay();
  if(active===3) return upload();
  if(active===5) return profile();
  return reportsPage();
}
function featureView(name) {
  const labels = {labs:'Computer Labs',reserve:'Reserve a PC',printing:'Printing',billing:'Bills & Receipts',schedule:'Schedule',materials:'Study Materials'};
  return `${brand()}<button class="top-action" data-action="back-home" aria-label="Back to home" style="margin-bottom:18px">←</button><div class="eyebrow">Features</div><h1>${labels[name]}</h1><p class="intro">${name==='labs'?'See computer availability.':name==='reserve'?'Book a lab computer.':name==='printing'?'Send a campus print request.':name==='billing'?'Review your payments and receipts.':name==='schedule'?'See upcoming reservations.':'Keep your study files in one place.'}</p><div id="feature-content"><div class="simple-card"><strong>Loading…</strong></div></div>`;
}
function render(preserveScroll=false) {
  if(authView !== 'app') {
    $('bottom-nav').parentElement.hidden = true;
    $('screen').classList.add('welcome-screen');
    $('screen').innerHTML = authView==='welcome' ? `<div class="welcome-page"><div class="welcome-glow"></div><div class="welcome-content"><img src="assets/logo-transparent.png" alt="Omnira" class="welcome-logo"><h1>Welcome to Omnira</h1><p>Your campus resources, study tools, and activities in one place.</p><button class="welcome-primary" data-action="show-login">Get Started</button><div class="welcome-login">Already have an account? <button data-action="show-login">Log in</button></div></div></div>` : `<div class="login-page"><button class="login-back" data-action="show-welcome" aria-label="Back">‹</button><img src="assets/logo-transparent.png" alt="Omnira" class="login-brand"><h1>Welcome back</h1><p>Log in to your Omnira account.</p><div class="login-account-switch"><button type="button" data-demo-account="student">Student demo</button><button type="button" data-demo-account="professor">Professor demo</button><button type="button" data-demo-account="admin">Admin demo</button></div><form id="student-login"><label>Email<input name="email" type="email" value="student@omnira.test" required></label><label>Password<input name="password" type="password" value="demo123" required></label><div id="recaptcha-area"></div><button class="welcome-primary">Log in</button><div id="login-message" role="status"></div></form><small>Demo accounts use password demo123.</small></div>`;
    $('screen').scrollTop=0;
    if(authView==='login') requestAnimationFrame(showRecaptcha);
    return;
  }
  $('bottom-nav').parentElement.hidden = false;
  $('screen').classList.remove('welcome-screen');
  const previousScroll = preserveScroll ? $('screen').scrollTop : 0;
  const nav = $('bottom-nav');
  const isAdmin=student?.role==='admin';
  const isProfessor=student?.role==='professor';
  nav.setAttribute('aria-label',isAdmin?'Admin navigation':isProfessor?'Professor navigation':'Student navigation');
  nav.innerHTML = (isAdmin?adminTabs:isProfessor?professorTabs:tabs).map(([label,glyph],index) => `<button class="nav-button ${active===index?'active':''}" data-tab="${index}" aria-label="${label}" ${active===index?'aria-current="page"':''}>${icon(glyph)}<span>${label}</span></button>`).join('');
  requestAnimationFrame(() => {
    const selected = nav.querySelector('.nav-button.active');
    if (!selected) return;
    nav.style.setProperty('--pill-left', `${selected.offsetLeft}px`);
    nav.style.setProperty('--pill-width', `${selected.offsetWidth}px`);
    nav.style.setProperty('--pill-opacity', '1');
  });
  $('screen').classList.toggle('chat-active', active===(isProfessor?3:2) && !currentFeature);
  $('screen').innerHTML = isAdmin ? adminPage() : isProfessor ? professorPage() : currentFeature ? featureView(currentFeature) : [home,explore,gabay,upload,activity,profile][active]();
  $('screen').scrollTop = previousScroll;
  if(!isAdmin && currentFeature) loadFeature(currentFeature);
  else if(isAdmin && (active===1 || adminSection==='grade-report')) loadAdminUsers();
  else if(active===(isProfessor?3:2) && chatMessages.length) $('chat-thread').scrollTop = $('chat-thread').scrollHeight;
  else if(active===(isProfessor?4:3) && selectedFolderId) loadFolderFiles();
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
  const userRoleButton=event.target.closest('[data-admin-user-role]');
  if(userRoleButton && student?.role==='admin') {adminUserRole=userRoleButton.dataset.adminUserRole;adminUserMenuId=null;render(true);return;}
  const userMenuButton=event.target.closest('[data-user-menu]');
  if(userMenuButton && student?.role==='admin') {adminUserMenuId=adminUserMenuId===userMenuButton.dataset.userMenu?null:userMenuButton.dataset.userMenu;render(true);return;}
  const userAction=event.target.closest('[data-user-action]');
  if(userAction && student?.role==='admin') {
    const account=adminUsers.find(person=>String(person.id)===userAction.dataset.userId);
    if(!account) return;
    const status=userAction.dataset.userAction;
    if(status==='deleted' && !window.confirm(`Delete ${account.name} from this preview? You can restore the account from this menu.`)) return;
    adminUserStatuses[account.id]=status;
    localStorage.setItem(adminUserStatusKey,JSON.stringify(adminUserStatuses));
    adminUserMenuId=null;render(true);return;
  }
  const gradeStudent=event.target.closest('[data-grade-student]');
  if(gradeStudent && student?.role==='admin') {selectedGradeStudentId=gradeStudent.dataset.gradeStudent;gradeSearchQuery='';render(true);return;}
  if(event.target.closest('[data-action="open-reports"]') && student?.role==='admin') {transitionPage(()=>{active=4;adminSection=null;});return;}
  const ticketOpen=event.target.closest('[data-ticket-open]');
  if(ticketOpen && student?.role==='admin') {const ticket=adminTickets.find(item=>item.id===ticketOpen.dataset.ticketOpen);if(ticket){selectedTicketId=ticket.id;ticketMenuId=null;ticketReplyTo=null;ticketAttachment=null;ticketDraft='';if(ticket.status==='new'){ticket.status='pending';saveTickets();}render(true);}return;}
  if(event.target.closest('[data-ticket-back]')) {selectedTicketId=null;ticketReplyTo=null;ticketAttachment=null;ticketDraft='';render(true);return;}
  const replyMessage=event.target.closest('[data-reply-message]');
  if(replyMessage && student?.role==='admin') {ticketReplyTo=Number(replyMessage.dataset.replyMessage);render(true);$('ticket-reply-form')?.elements.reply.focus();return;}
  if(event.target.closest('[data-clear-ticket-reply]')) {ticketReplyTo=null;render(true);return;}
  if(event.target.closest('[data-clear-ticket-image]')) {ticketAttachment=null;render(true);return;}
  if(event.target.closest('[data-add-ticket-image]')) {$('ticket-image-input')?.click();return;}
  const ticketMenu=event.target.closest('[data-ticket-menu]');
  if(ticketMenu && student?.role==='admin') {ticketMenuId=ticketMenuId===ticketMenu.dataset.ticketMenu?null:ticketMenu.dataset.ticketMenu;render(true);return;}
  const ticketAction=event.target.closest('[data-ticket-action]');
  if(ticketAction && student?.role==='admin') {const ticket=adminTickets.find(item=>item.id===ticketAction.dataset.ticketId);if(!ticket)return;if(ticketAction.dataset.ticketAction==='deleted'&&!window.confirm('Delete this ticket from the browser preview?'))return;ticket.status=ticketAction.dataset.ticketAction;ticketMenuId=null;saveTickets();render(true);return;}
  const scheduleModeButton=event.target.closest('[data-schedule-mode]');
  if(scheduleModeButton && student?.role==='admin' && adminSection==='generate-schedule') {scheduleMode=scheduleModeButton.dataset.scheduleMode;generatedScheduleSectionId=null;render(true);return;}
  const generateSection=event.target.closest('[data-generate-section]');
  if(generateSection && student?.role==='admin' && adminSection==='generate-schedule') {generatedScheduleSectionId=generateSection.dataset.generateSection;render(true);requestAnimationFrame(()=>$('generated-schedule')?.scrollIntoView({behavior:'smooth',block:'start'}));return;}
  const addStudent=event.target.closest('[data-add-student-index]');
  if(addStudent && student?.role==='admin') {
    const section=classSections.find(item=>item.id===selectedSectionId);
    const person=studentSearchResults[Number(addStudent.dataset.addStudentIndex)];
    if(section && person && !classSections.some(item=>item.students.some(entry=>entry.userId===person.id || entry.email===person.email || entry.name.toLowerCase()===person.name.toLowerCase()))) {
      section.students.push({name:person.name,studentId:person.email,userId:person.id,email:person.email});saveSections();render(true);
    }
    return;
  }
  const sectionChoice=event.target.closest('[data-section-id]');
  if(sectionChoice && student?.role==='admin') {selectedSectionId=sectionChoice.dataset.sectionId;render(true);return;}
  const removeSectionStudent=event.target.closest('[data-remove-section-student]');
  if(removeSectionStudent && student?.role==='admin') {const section=classSections.find(item=>item.id===selectedSectionId);if(section){section.students=section.students.filter(item=>item.studentId!==removeSectionStudent.dataset.removeSectionStudent);saveSections();render(true);}return;}
  if(event.target.closest('[data-action="arrange-class"]')) {transitionPage(()=>{adminSection='arrange-class';});return;}
  if(event.target.closest('[data-action="generate-schedule"]')) {transitionPage(()=>{adminSection='generate-schedule';scheduleMode='create';generatedScheduleSectionId=null;});return;}
  if(event.target.closest('[data-action="grade-report"]')) {transitionPage(()=>{adminSection='grade-report';});return;}
  if(event.target.closest('[data-action="print-schedule"]') && student?.role==='admin') {window.print();return;}
  if(event.target.closest('[data-action="admin-home"]')) {transitionPage(()=>{adminSection=null;});return;}
  const demoAccount=event.target.closest('[data-demo-account]');
  if(demoAccount) {const form=$('student-login');if(form){form.elements.email.value=`${demoAccount.dataset.demoAccount}@omnira.test`;form.elements.password.value='demo123';$('login-message').textContent='';}return;}
  if(event.target.closest('[data-action="remove-schedule-image"]')) {localStorage.removeItem(scheduleImageKey);if(currentFeature==='schedule') loadFeature('schedule');return;}
  if(event.target.closest('[data-action="home-next-class"]')) {document.getElementById('class-schedule')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
  if(event.target.closest('[data-action="professor-paperworks"]')) {document.getElementById('professor-paperworks')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
  if(event.target.closest('[data-action="sync-professor-grades"]')) {loadProfessorClasses().then(syncProfessorGrades);return;}
  const professorSection=event.target.closest('[data-professor-section]');
  if(professorSection && student?.role==='professor') {transitionPage(()=>{professorSectionKey=professorSection.dataset.professorSection;});return;}
  if(event.target.closest('[data-action="professor-section-back"]') && student?.role==='professor') {transitionPage(()=>{professorSectionKey=null;});return;}
  if(event.target.closest('[data-action="show-login"]')) {switchAuthView('login');return;}
  if(event.target.closest('[data-action="show-welcome"]')) {switchAuthView('welcome');return;}
  const tab = event.target.closest('[data-tab]');
  if(tab) { const destination=Number(tab.dataset.tab); if(destination===active && !currentFeature && !profileDetail && !adminSection && !professorSectionKey) return; transitionPage(()=>{active=destination;currentFeature=null;historyOpen=false;profileDetail=null;adminSection=null;adminUserMenuId=null;professorSectionKey=null;});return; }
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
  if(event.target.closest('[data-action="attach"]')) {active=student?.role==='professor'?4:3;currentFeature=null;render();return;}
  const prompt=event.target.closest('[data-prompt]');
  if(prompt) {sendChat(prompt.dataset.prompt);return;}
  if(event.target.closest('[data-action="notifications"]')) alert('No new notifications.');
});
document.addEventListener('submit', async event => {
  if(event.target.matches('.professor-meeting-form')) {
    event.preventDefault();
    const form=event.target, classId=Number(form.dataset.classId), url=form.elements.url.value.trim();
    if(!professorClasses.some(item=>item.id===classId)) return;
    try {
      const result=await post(`/professor/classes/${classId}/meeting`,{url});
      professorClasses.find(item=>item.id===classId).meeting_url=result.meeting_url;
      professorGradeMessage='Meeting link saved.';
      cacheProfessorData();
    } catch(error) {professorGradeMessage=error.message||'Could not save the meeting link. Check your connection.';}
    render(true);
    return;
  }
  if(event.target.id==='ticket-reply-form') {
    event.preventDefault();
    if(student?.role!=='admin') return;
    const ticket=adminTickets.find(item=>item.id===selectedTicketId);
    const reply=String(new FormData(event.target).get('reply')||'').trim();
    if(!ticket || (!reply && !ticketAttachment)) {if($('ticket-compose-error')) $('ticket-compose-error').textContent='Write a reply or add an image.';return;}
    const quoted=ticketReplyTo!==null?ticket.messages[ticketReplyTo]:null;
    const message={from:'admin',text:reply,at:Date.now(),...(ticketAttachment?{image:ticketAttachment.data}:{}),...(quoted?{replyTo:{sender:ticket.sender,text:quoted.text||'Image'}}:{})};
    const previousUpdatedAt=ticket.updatedAt;
    ticket.messages.push(message);ticket.updatedAt=message.at;
    try {saveTickets();} catch {ticket.messages.pop();ticket.updatedAt=previousUpdatedAt;if($('ticket-compose-error')) $('ticket-compose-error').textContent='Could not save this reply on this device. Try a smaller image.';return;}
    ticketReplyTo=null;ticketAttachment=null;ticketDraft='';render(true);
    return;
  }
  if(event.target.id==='generate-new-schedule-form') {
    event.preventDefault();
    if(student?.role!=='admin') return;
    const values=Object.fromEntries(new FormData(event.target));
    const name=String(values.sectionName||'').trim();
    const message=$('schedule-lines-message');
    if(classSections.some(item=>item.name.toLowerCase()===name.toLowerCase())) {if(message) message.textContent='This section already exists. Choose it below to generate its schedule.';return;}
    let entries;
    try {entries=generateSubjectSchedule(values.subjects);} catch(error) {if(message) message.textContent=error.message;return;}
    const section={id:crypto.randomUUID(),name,students:[],customSchedule:true};
    classSections.push(section);
    classTimetable.push(...entries.map(item=>({...item,sectionId:section.id})));
    saveSections();localStorage.setItem(classStoreKey,JSON.stringify(classTimetable));
    selectedSectionId=section.id;generatedScheduleSectionId=section.id;render();
    requestAnimationFrame(()=>$('generated-schedule')?.scrollIntoView({behavior:'smooth',block:'start'}));
    return;
  }
  if(event.target.id==='admin-section-form') {
    event.preventDefault();
    if(student?.role!=='admin') return;
    const name=String(new FormData(event.target).get('name')||'').trim();
    if(classSections.some(item=>item.name.toLowerCase()===name.toLowerCase())) {if($('section-form-message')) $('section-form-message').textContent='This section already exists.';return;}
    const section={id:crypto.randomUUID(),name,students:[]};
    classSections.push(section);selectedSectionId=section.id;saveSections();render(true);return;
  }
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
  if(event.target.id==='ticket-image-input') {
    const file=event.target.files?.[0];
    if(!file) return;
    if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type) || file.size>750*1024) {if($('ticket-compose-error')) $('ticket-compose-error').textContent='Choose a PNG, JPG, WebP, or GIF image smaller than 750 KB.';return;}
    const reader=new FileReader();
    reader.onload=()=>{ticketAttachment={name:file.name,data:String(reader.result)};render(true);};
    reader.readAsDataURL(file);
    return;
  }
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
document.addEventListener('input', event => {
  if(event.target.name==='reply' && event.target.closest('#ticket-reply-form')) ticketDraft=event.target.value;
  if(event.target.id==='grade-student-search' && student?.role==='admin') {gradeSearchQuery=event.target.value;if($('grade-student-results')) $('grade-student-results').innerHTML=gradeStudentResults();}
  if(event.target.id==='student-mention-search' && student?.role==='admin') searchSectionStudents(event.target.value);
  if(event.target.id==='schedule-section-search' && student?.role==='admin' && $('schedule-search-results')) $('schedule-search-results').innerHTML=scheduleSearchResults(event.target.value);
});
let ticketSwipeStart=null;
document.addEventListener('touchstart', event => {
  const message=event.target.closest('[data-swipe-reply]');
  ticketSwipeStart=message&&event.touches.length===1?{index:Number(message.dataset.swipeReply),x:event.touches[0].clientX,y:event.touches[0].clientY}:null;
},{passive:true});
document.addEventListener('touchend', event => {
  if(!ticketSwipeStart || !event.changedTouches.length) return;
  const start=ticketSwipeStart;ticketSwipeStart=null;
  const dx=event.changedTouches[0].clientX-start.x,dy=event.changedTouches[0].clientY-start.y;
  if(dx>55 && Math.abs(dy)<45 && student?.role==='admin' && selectedTicketId){ticketReplyTo=start.index;render(true);$('ticket-reply-form')?.elements.reply.focus();}
},{passive:true});
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
  if(event.target.matches('.professor-grade-form')) {
    event.preventDefault();
    const form=event.target, classId=Number(form.dataset.classId), studentId=Number(form.dataset.studentId), score=Number(form.elements.score.value);
    const assigned=professorClasses.find(item=>item.id===classId);
    const pupil=assigned?.students.find(item=>item.id===studentId);
    if(!pupil||!Number.isFinite(score)||score<0||score>100) {professorGradeMessage='Choose a student in your class and a grade from 0 to 100.';render(true);return;}
    pupil.score=score;
    const pending={class_id:classId,student_id:studentId,score};
    professorGradeQueue=professorGradeQueue.filter(item=>item.class_id!==classId||item.student_id!==studentId);
    professorGradeQueue.push(pending);
    professorGradeMessage='Grade saved on this device. It will sync when connected.';
    cacheProfessorData();
    render(true);
    syncProfessorGrades();
    return;
  }
  if(event.target.id!=='student-login') return;
  event.preventDefault();
  const values=Object.fromEntries(new FormData(event.target));
  if(window.OMNIRA_RECAPTCHA_SITE_KEY) {
    values.recaptcha_token=window.grecaptcha?.getResponse(recaptchaWidget)||'';
    if(!values.recaptcha_token) {if($('login-message')) $('login-message').textContent='Complete verification first.';return;}
  } else if(!$('demo-verified')?.checked) {if($('login-message')) $('login-message').textContent='Check the preview verification box first.';return;}
  try { student=await window.omnira.request('/auth/login',{method:'POST',body:JSON.stringify(values)});active=0;authView='app';if(student.role==='professor'){restoreProfessorData();loadProfessorClasses().then(syncProfessorGrades);}render(); }
  catch { if(!window.OMNIRA_RECAPTCHA_SITE_KEY && values.password==='demo123' && ['student@omnira.test','professor@omnira.test','admin@omnira.test'].includes(values.email)){const role=values.email.split('@')[0];student={id:role==='student'?1:role==='professor'?2:3,name:role==='admin'?'Campus Admin':role==='professor'?'Prof. Reyes':'Alex Student',email:values.email,role};active=0;authView='app';if(role==='professor'){restoreProfessorData();loadProfessorClasses().then(syncProfessorGrades);}render();} else if($('login-message')) $('login-message').textContent='Could not log in. Check your details and try again.'; }
});
render();
setInterval(()=>{if(authView==='app' && active===0) updateNextClass();},30000);

