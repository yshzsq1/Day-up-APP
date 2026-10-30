const STORAGE_KEY = 'dayup-local-v1';
const storage = (() => {
  try {
    const value = window.localStorage;
    const probe = '__dayup_probe__';
    value.setItem(probe, '1');
    value.removeItem(probe);
    return value;
  } catch { return null; }
})();
const fallbackDbName = 'dayup-fallback';
const today = () => DayUpCore.localDate();
const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const nowIso = () => new Date().toISOString();
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const dateAtNoon = date => new Date(`${date}T12:00:00`);
const isoPlus = (date, days) => DayUpCore.addDays(date, days);
const formatDate = (date, options = { month:'long', day:'numeric', weekday:'long' }) => new Intl.DateTimeFormat('zh-CN', options).format(dateAtNoon(date));
const formatShort = date => new Intl.DateTimeFormat('zh-CN', { month:'numeric', day:'numeric' }).format(dateAtNoon(date));
const defaultState = () => ({ version:1, plans:[], memos:[], projects:[], devLogs:[], clients:[], consultLogs:[], fitnessPlans:[], workouts:[], meals:[], games:[], gameSessions:[], series:[], notified:[], settings:{ reminders:true }, learning:DayUpLearning.empty() });
const normaliseState = value => DayUpCore.normalise(value);
const adapters=DayUpStorage.browserAdapters();
const persistence=new DayUpStorage.LocalStore(adapters.primary,adapters.secondary,STORAGE_KEY);
const backupClient=typeof DayUpBackups!=='undefined'&&typeof fetch==='function'&&typeof location!=='undefined'&&location.protocol==='http:'?DayUpBackups.createClient(fetch.bind(globalThis)):null;
let state = loadState();
let lastPersisted=JSON.stringify(state);
let dataReady=false;
let storageError='';
let busy=false;
let confirmResolve=null;
let previousFocus=null;
let currentView = 'overview';
let selectedDate = today();
const notifiedReminders = new Set();
const app = document.querySelector('#app');

function loadState(){ try{return normaliseState(storage?.getItem(STORAGE_KEY)?JSON.parse(storage.getItem(STORAGE_KEY)):null)}catch{return defaultState()} }
function openFallbackDb(){return new Promise((resolve,reject)=>{if(!window.indexedDB)return reject(new Error('indexedDB unavailable'));const request=indexedDB.open(fallbackDbName,1);request.onupgradeneeded=()=>request.result.createObjectStore('state');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function readFallback(){const db=await openFallbackDb();return new Promise((resolve,reject)=>{const request=db.transaction('state').objectStore('state').get(STORAGE_KEY);request.onsuccess=()=>resolve(request.result||'');request.onerror=()=>reject(request.error)})}
function writeFallback(value){openFallbackDb().then(db=>db.transaction('state','readwrite').objectStore('state').put(value,STORAGE_KEY)).catch(()=>{})}
async function save(){
  const normalised=normaliseState(state);
  try{state=await persistence.write(normalised);lastPersisted=JSON.stringify(state);storageError='';}
  catch(error){state=JSON.parse(lastPersisted);storageError=error.message;notify(error.message);render();throw error;}
}
async function hydrateFallback(){
  try{const raw=await persistence.load();if(raw)state=DayUpCore.validateBackup(raw);lastPersisted=JSON.stringify(state);}
  catch(error){storageError=error.message;}
  dataReady=true;
}
function notify(message){const element=document.querySelector('#toast');if(!element)return;element.textContent=message;element.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>element.classList.remove('show'),2200)}
function closeModal(){document.querySelector('#modal-root').innerHTML='';document.body.classList.remove('modal-open');document.querySelector('.app-shell').inert=false;if(previousFocus?.isConnected)previousFocus.focus();if(confirmResolve){confirmResolve(false);confirmResolve=null;}}
function moduleLabel(value){return value||'个人'}
function priorityPill(priority){if(priority==='高')return '<span class="pill orange">高优先级</span>';if(priority==='低')return '<span class="pill">低优先级</span>';return '<span class="pill blue">普通</span>'}
function empty(title,description,action=''){return `<div class="empty"><strong>${title}</strong><span>${description}</span>${action}</div>`}
function setView(view){if(view==='learning')resetLearningHome();currentView=view;document.querySelectorAll('.nav-item').forEach(button=>button.classList.toggle('active',button.dataset.view===view));const titles={overview:'首页总览',plans:'今日计划',development:'开发工作',consulting:'咨询工作',fitness:'健身计划',diet:'饮食计划',games:'游戏娱乐',learning:'学习空间',settings:'数据与设置'};document.querySelector('#page-title').textContent=titles[view]||'首页总览';render()}
function render(){document.querySelector('#header-date').textContent=`${formatDate(today(),{year:'numeric',month:'long',day:'numeric',weekday:'long'})} · 本地工作台`;const views={overview:renderOverview,plans:renderPlans,development:renderDevelopment,consulting:renderConsulting,fitness:renderFitness,diet:renderDiet,games:renderGames,learning:renderLearning,settings:renderSettings};app.innerHTML=(storageError?`<div class="notice error-notice" role="alert">${esc(storageError)}</div>`:'')+views[currentView]()}
function planDateTime(plan){if(plan.time==='全天')return -1;if(!plan.time||plan.time==='待安排')return Number.MAX_SAFE_INTEGER;return Number(plan.time.replace(':',''));}
function dayPlans(date){DayUpCore.ensureOccurrence(state,date);return state.plans.filter(plan=>plan.date===date).sort((a,b)=>planDateTime(a)-planDateTime(b));}
function planRow(plan,options={}){const actionButtons=options.compact?'':`<div class="row-actions"><button class="link-button" data-action="edit-plan" data-id="${plan.id}">编辑</button><button class="link-button" data-action="cancel-plan" data-id="${plan.id}">取消</button><button class="link-button" data-action="move-plan" data-id="${plan.id}">明天</button><button class="link-button danger-text" data-action="delete-plan" data-id="${plan.id}">删除</button></div>`;return `<div class="task-row ${plan.status==='done'?'done':plan.status==='cancelled'?'cancelled':''} ${plan.isTop?'focus-row':''}"><button class="check ${plan.status==='done'?'checked':''}" aria-label="${plan.status==='done'?'标记未完成':'标记完成'}" data-action="toggle-plan" data-id="${plan.id}">${plan.status==='done'?'✓':''}</button><button type="button" class="task-copy plan-open" data-action="edit-plan" data-id="${plan.id}"><strong>${esc(plan.title)}</strong><small>${esc(plan.time||'全天')} · ${esc(moduleLabel(plan.module))}${plan.status==='cancelled'?' · 已取消':plan.status==='doing'?' · 进行中':''}${plan.recurrence&&plan.recurrence!=='不重复'?` · ↻ ${plan.recurrence}`:''}</small></button>${priorityPill(plan.priority)}${actionButtons}${plan.notes||plan.linkedId||plan.reminder&&plan.reminder!=='不提醒'?`<div class="plan-extra full-row">${esc(linkedChoices(plan.module).find(row=>row.id===plan.linkedId)?.name||'')}${plan.notes?` · ${esc(plan.notes)}`:''}${plan.reminder&&plan.reminder!=='不提醒'?` · 提前 ${esc(plan.reminder)} 分钟提醒`:''}</div>`:''}</div>`}
function attentionItems(){
 const date=today(), now=Date.now();
 const overdue=state.plans.filter(p=>p.date<date&&!['done','cancelled'].includes(p.status)).map(p=>({kind:'计划逾期',title:p.title,detail:`${formatShort(p.date)} · ${moduleLabel(p.module)}`,action:`data-action="edit-plan" data-id="${p.id}"`}));
 const upcoming=state.plans.filter(p=>!['done','cancelled'].includes(p.status)&&p.time&&!['全天','待安排'].includes(p.time)&&p.reminder&&p.reminder!=='不提醒'&&new Date(`${p.date}T${p.time}:00`).getTime()>=now&&new Date(`${p.date}T${p.time}:00`).getTime()-now<=60*60000).map(p=>({kind:'即将提醒',title:p.title,detail:`${p.time} · 提前 ${p.reminder} 分钟`,action:`data-action="edit-plan" data-id="${p.id}"`}));
 const due=state.clients.filter(c=>c.nextFollowup&&c.nextFollowup<=date&&c.status!=='已结束').map(c=>({kind:'咨询跟进',title:c.name,detail:c.topic||'今天需要跟进',action:`data-action="edit-client" data-id="${c.id}"`}));
 const stale=state.projects.filter(p=>p.status==='进行中'&&p.updatedAt&&now-new Date(p.updatedAt).getTime()>7*86400000).map(p=>({kind:'项目停滞',title:p.name,detail:'超过 7 天没有更新 · '+(p.nextAction||'明确下一步行动'),action:`data-action="edit-project" data-id="${p.id}"`}));
 const habits=[];
 const recent=isoPlus(date,-3);
 if(state.fitnessPlans.length && !state.workouts.some(w=>w.date>=recent&&w.date<=date))habits.push({kind:'训练记录',title:'最近 3 天没有训练记录',detail:'查看训练安排或记录恢复日',action:'data-view="fitness"'});
 if(state.meals.length && !state.meals.some(m=>m.name!=='饮水'&&m.date>=recent&&m.date<=date))habits.push({kind:'饮食记录',title:'最近 3 天没有餐食记录',detail:'从今天的一餐开始记录',action:'data-view="diet"'});
 return [...upcoming,...due,...overdue,...stale,...habits];
}

function renderOverview(){const plans=dayPlans(today());const focus=plans.filter(plan=>plan.isTop&&plan.status!=='cancelled').slice(0,3);const done=plans.filter(plan=>plan.status==='done').length;const attention=attentionItems();const activeProjects=state.projects.filter(project=>project.status==='进行中');const dueConsults=state.clients.filter(client=>client.nextFollowup&&client.nextFollowup<=today()&&client.status!=='已结束');const todayMeals=state.meals.filter(meal=>meal.date===today()&&meal.name!=='饮水');const todayWater=state.meals.filter(meal=>meal.date===today()).reduce((sum,meal)=>sum+Number(meal.water||0),0);const playing=state.games.filter(game=>game.status==='在玩');return `<div class="content-grid"><section class="hero-card card"><p class="eyebrow">今日驾驶舱 · ${formatDate(today(),{month:'long',day:'numeric',weekday:'long'})}</p><h2>${plans.length?`还有 ${plans.filter(plan=>!['done','cancelled'].includes(plan.status)).length} 件事，按节奏推进。`:'今天还没有安排，给自己定一个轻盈的起点。'}</h2><p>${done} / ${plans.length} 项计划已完成 · 数据保存在当前浏览器</p></section><div class="cockpit-grid"><section class="card"><div class="section-heading"><div><h2>今天最重要的事</h2><p>最多保留三件，保持注意力</p></div><button class="link-button" data-view="plans">管理计划 →</button></div>${focus.length?`<div class="task-list">${focus.map(plan=>planRow(plan,{compact:true})).join('')}</div>`:empty('还没有标记重点','在今日计划中把最重要的事项标记出来。')}</section><section class="card"><div class="section-heading"><h2>需要关注</h2><span class="pill ${attention.length?'orange':'green'}">${attention.length?`${attention.length} 项`:'目前清爽'}</span></div>${attention.length?`<div class="compact-list attention-list">${attention.map(item=>`<button class="attention-row" ${item.action}><span class="attention-dot"></span><span><strong>${esc(item.title)}</strong><small>${esc(item.kind)} · ${esc(item.detail)}</small></span><b>›</b></button>`).join('')}</div>`:empty('暂时没有需要处理的事项','新的逾期或待跟进内容会出现在这里。')}</section></div><section class="card"><div class="section-heading"><div><h2>今日时间线</h2><p>${done} / ${plans.length} 项已完成</p></div><button class="primary-button" data-action="new-plan">＋ 添加计划</button></div>${plans.length?`<div class="task-list">${planGroups(plans)}</div>`:empty('今天还没有计划','安排一件重要的事，或者留出一段真正属于自己的时间。')}</section><div class="two-col"><section class="card"><div class="section-heading"><h2>快速备忘</h2><span class="subtle">想到就记，不打断节奏</span></div><div class="memo-box"><textarea id="quick-memo" placeholder="此刻想到什么？写下来……"></textarea><button class="primary-button" data-action="add-memo">保存</button></div>${state.memos.length?`<div class="memo-list">${state.memos.slice().reverse().map(memo=>`<div class="memo-item"><div>${esc(memo.text)}<small>${esc(memo.module||'个人')} · ${new Date(memo.createdAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small></div><div class="row-actions"><button class="link-button" data-action="edit-memo" data-id="${memo.id}">编辑</button><button class="link-button" data-action="memo-to-plan" data-id="${memo.id}">转计划</button><button class="link-button danger-text" data-action="delete-memo" data-id="${memo.id}">删除</button></div></div>`).join('')}</div>`:''}</section><section class="card"><div class="section-heading"><h2>今日状态摘要</h2><span class="subtle">保持全局感</span></div><div class="module-summary-list"><button class="summary-row" data-view="development"><span class="summary-icon">⌘</span><span><strong>开发工作</strong><small>${activeProjects.length?`${activeProjects.length} 个项目进行中 · ${esc(activeProjects[0].nextAction||'查看下一步')}`:'还没有进行中的项目'}</small></span><b>›</b></button><button class="summary-row" data-view="consulting"><span class="summary-icon">◎</span><span><strong>咨询工作</strong><small>${state.clients.length?`${state.clients.length} 位客户 · ${dueConsults.length} 项待跟进`:'还没有咨询记录'}</small></span><b>›</b></button><button class="summary-row" data-view="fitness"><span class="summary-icon">◒</span><span><strong>健身计划</strong><small>${state.workouts.some(workout=>workout.date===today())?'今天已完成训练':(state.plans.filter(p=>p.module==='健身计划'&&p.date>=today()&&!['done','cancelled'].includes(p.status)).sort((a,b)=>a.date.localeCompare(b.date))[0]?`下次训练：${state.plans.filter(p=>p.module==='健身计划'&&p.date>=today()&&!['done','cancelled'].includes(p.status)).sort((a,b)=>a.date.localeCompare(b.date))[0].date}`:'今天还没有训练记录')}</small></span><b>›</b></button><button class="summary-row" data-view="diet"><span class="summary-icon">◍</span><span><strong>饮食计划</strong><small>${`今天已记录 ${todayMeals.length} 餐 · 饮水 ${todayWater}ml`}</small></span><b>›</b></button>${learningSummary()}<button class="summary-row" data-view="games"><span class="summary-icon">◇</span><span><strong>游戏娱乐</strong><small>${playing.length?`${esc(playing[0].name)} · ${playing[0].progress||0}%`:'没有正在游玩的游戏'}</small></span><b>›</b></button></div></section></div></div>`}
function renderPlans(){const plans=dayPlans(selectedDate);const done=plans.filter(plan=>plan.status==='done').length;const focus=plans.filter(plan=>plan.isTop);return `<div class="page-toolbar"><div class="date-switcher"><button data-action="shift-date" data-delta="-1">‹</button>${dateControl("date-picker","",selectedDate,'aria-label="选择查看日期"')}<span class="date-label">${selectedDate===today()?'今天':formatDate(selectedDate,{month:'long',day:'numeric',weekday:'short'})}</span><button data-action="shift-date" data-delta="1">›</button><button class="secondary-button" data-action="go-today">回到今天</button></div><button class="primary-button" data-action="new-plan">＋ 添加计划</button></div><div class="content-grid wide-grid"><section class="card"><div class="section-heading"><div><h2>${formatDate(selectedDate,{month:'long',day:'numeric',weekday:'long'})}</h2><p>${done} / ${plans.length} 项已完成 · ${focus.length} 项重点</p></div>${plans.length?`<span class="pill green">完成率 ${Math.round(done/plans.length*100)}%</span>`:''}</div>${plans.length?`<div class="task-list">${planGroups(plans)}</div>`:empty('这一天还没有计划','安排一件重要的事，或者留出一段真正属于自己的时间。')}</section><section class="card"><div class="section-heading"><h2>计划小提示</h2></div><div class="notice">重复计划会自动生成未来安排。提醒需要允许浏览器通知，并且页面保持打开。</div><div class="kpi-row"><div class="kpi"><strong>${state.plans.filter(plan=>!['done','cancelled'].includes(plan.status)).length}</strong><span>待处理计划</span></div><div class="kpi"><strong>${state.plans.filter(plan=>plan.recurrence&&plan.recurrence!=='不重复').length}</strong><span>重复计划记录</span></div><div class="kpi"><strong>${state.plans.filter(plan=>plan.date<today()&&!['done','cancelled'].includes(plan.status)).length}</strong><span>逾期计划</span></div></div></section></div>`}
function renderDevelopment(){return renderDevelopmentWorkspace();}
function renderConsulting(){const due=state.clients.filter(client=>client.nextFollowup&&client.nextFollowup<=today()&&client.status!=='已结束');return `<div class="page-toolbar"><span class="subtle">让每一次沟通都有后续</span><button class="primary-button" data-action="new-client">＋ 添加客户</button></div><div class="content-grid wide-grid"><section class="card"><div class="section-heading"><h2>客户与事项</h2><span class="subtle">${state.clients.length} 位客户</span></div>${state.clients.length?`<div class="compact-list">${state.clients.map(client=>`<div class="list-row"><div class="task-copy"><strong>${esc(client.name)}</strong><small>${esc(client.topic||'未填写主题')} · 下次跟进 ${client.nextFollowup||'未安排'}</small></div><span class="pill ${client.status==='已结束'?'green':'blue'}">${client.status}</span><div class="row-actions"><button class="link-button" data-action="edit-client" data-id="${client.id}">编辑</button><button class="link-button" data-action="new-consult-log" data-client-id="${client.id}">记沟通</button><button class="link-button danger-text" data-action="delete-client" data-id="${client.id}">删除</button></div></div>`).join('')}</div>`:empty('还没有客户记录','把重要的合作关系放进一个清晰的地方。')}</section><section class="card"><div class="section-heading"><h2>最近沟通</h2><button class="link-button" data-action="new-consult-log">记录沟通 →</button></div>${state.consultLogs.length?`<div class="log-list">${state.consultLogs.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(log=>`<div class="log-entry"><strong>${formatShort(log.date)} · ${esc(state.clients.find(c=>c.id===log.clientId)?.name||log.clientName)} · ${esc(log.channel)}</strong><p>${esc(log.summary)}${log.nextAction?` · 下一步：${esc(log.nextAction)}`:''}</p></div>`).join('')}</div>`:empty('还没有沟通记录','每一次沟通结束后，留下一句摘要和下一步。')}</section></div><section class="card section-gap"><div class="section-heading"><h2>待跟进</h2><span class="pill ${due.length?'orange':'green'}">${due.length?`${due.length} 项需要处理`:'目前清爽'}</span></div>${due.length?`<div class="task-list">${due.map(client=>`<div class="task-row"><span class="attention-dot"></span><div class="task-copy"><strong>${esc(client.name)} · ${esc(client.topic||'咨询事项')}</strong><small>原定 ${client.nextFollowup} · ${esc(client.notes||'')}</small></div><button class="secondary-button" data-action="edit-client" data-id="${client.id}">查看</button></div>`).join('')}</div>`:empty('暂时没有逾期跟进','下一个跟进日到来时，这里会提醒你。')}</section>`}
function renderFitness(){return renderFitnessCalendar();}
function renderDiet(){const meals=state.meals.filter(meal=>meal.date===selectedDate&&meal.name!=='饮水');const water=state.meals.filter(meal=>meal.date===selectedDate).reduce((sum,meal)=>sum+Number(meal.water||0),0);return `<div class="page-toolbar"><div class="date-switcher"><button data-action="shift-date" data-delta="-1">‹</button>${dateControl("date-picker","",selectedDate,'aria-label="选择查看日期"')}<span class="date-label">${selectedDate===today()?'今天':formatShort(selectedDate)}</span><button data-action="shift-date" data-delta="1">›</button><button class="secondary-button" data-action="go-today">今天</button></div><button class="primary-button" data-action="new-meal">＋ 记录餐食</button></div>${renderMonthCalendar('diet')}<div class="content-grid wide-grid section-gap"><section class="card"><div class="section-heading"><h2>${formatDate(selectedDate,{month:'long',day:'numeric'})} 的餐食</h2><span class="subtle">${meals.length} 餐</span></div>${meals.length?`<div class="compact-list">${meals.map(meal=>`<div class="list-row"><div class="task-copy"><strong>${esc(meal.name)} <span class="pill">${esc(meal.time||'')}</span></strong><small>${esc(meal.foods)}${meal.notes?` · ${esc(meal.notes)}`:''}${meal.calories?` · ${meal.calories} kcal`:''}${meal.protein?` · 蛋白质 ${meal.protein}g`:''}</small></div><div class="row-actions"><button class="link-button" data-action="edit-meal" data-id="${meal.id}">编辑</button><button class="link-button danger-text" data-action="delete-meal" data-id="${meal.id}">删除</button></div></div>`).join('')}</div>`:empty('今天还没有餐食记录','提前想好下一餐，选择会变得轻松一些。')}</section><section class="card"><div class="section-heading"><h2>所选日期小指标</h2></div><div class="kpi-row"><div class="kpi"><strong>${meals.reduce((sum,meal)=>sum+Number(meal.calories||0),0)}</strong><span>估算热量 kcal</span></div><div class="kpi"><strong>${meals.reduce((sum,meal)=>sum+Number(meal.protein||0),0)}g</strong><span>蛋白质</span></div><div class="kpi"><strong>${water}ml</strong><span>饮水记录</span></div></div><div class="form-actions"><button class="secondary-button" data-action="new-water">＋ 记录饮水</button></div></section></div>`}
function renderGames(){const playing=state.games.filter(game=>game.status==='在玩');return `<div class="page-toolbar"><span class="subtle">把娱乐也安排得心安理得</span><button class="primary-button" data-action="new-game">＋ 添加游戏</button></div><section class="card"><div class="section-heading"><h2>我的游戏库</h2><span class="subtle">${state.games.length} 款游戏 · ${playing.length} 款在玩</span></div>${state.games.length?`<div class="compact-list">${state.games.map(game=>`<div class="list-row"><div class="task-copy"><strong>${esc(game.name)}</strong><small>${esc(game.platform||'未填写平台')} · ${game.progress||0}% · 最近游玩 ${game.lastPlayed||'—'}${game.rating?` · 评分 ${game.rating}/10`:''}${game.notes?` · ${esc(game.notes)}`:''}</small></div><span class="pill ${game.status==='已通关'?'green':game.status==='在玩'?'blue':''}">${game.status}</span><div class="row-actions"><button class="secondary-button" data-action="new-session" data-game-id="${game.id}">记录游玩</button><button class="link-button" data-action="edit-game" data-id="${game.id}">编辑</button><button class="link-button danger-text" data-action="delete-game" data-id="${game.id}">删除</button></div></div>`).join('')}</div>`:empty('游戏库还是空的','把想玩的、正在玩的和已经通关的都收进来。')}</section>${state.gameSessions.length?`<section class="card section-gap"><div class="section-heading"><h2>游玩记录</h2><span class="subtle">最近记录</span></div><div class="log-list">${state.gameSessions.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map(session=>`<div class="log-entry"><strong>${formatShort(session.date)} · ${esc(state.games.find(g=>g.id===session.gameId)?.name||session.gameName)} · ${session.duration||0} 分钟</strong><p>${esc(session.note||'')}</p></div>`).join('')}</div></section>`:''}`}
function renderSettings(){return `<div class="content-grid wide-grid"><section class="card"><div class="section-heading"><h2>提醒与显示</h2></div><div class="settings-list"><div class="setting-row"><div><strong>计划提醒</strong><small>页面打开时提醒；${'Notification' in window?Notification.permission==='granted'?'通知已授权':Notification.permission==='denied'?'通知被拒绝，请在浏览器设置中允许':'尚未授权通知':'当前浏览器不支持通知'}</small><button class="link-button" data-action="request-notification">启用通知 / 测试提醒</button></div><label class="switch"><input type="checkbox" data-setting="reminders" ${state.settings.reminders?'checked':''}><span class="slider"></span></label></div><div class="setting-row"><div><strong>数据状态</strong><small>当前浏览器本地保存 · ${JSON.stringify(state).length} 字节</small></div><span class="pill ${storageError?'orange':'green'}">${storageError?'保存异常':'已保存'}</span></div></div></section><section class="card"><div class="section-heading"><h2>备份与恢复</h2></div><p class="subtle" style="line-height:1.7">备份会包含计划、备忘、项目、客户、训练、饮食、游戏、学习科目与笔记和设置。备份保存在项目目录的 backups 文件夹，按日期和时间命名。同一天可以保存多份，互不覆盖。</p><div class="toolbar-group"><button class="primary-button" data-action="export-data">导出备份</button><button class="secondary-button" data-action="import-data">导入备份</button><button class="secondary-button" data-action="view-backups">查看备份文件夹</button><button class="secondary-button" data-action="delete-backups">删除备份</button><button class="link-button" data-action="import-other">从其他位置导入</button><input type="file" id="import-file" accept="application/json" hidden></div></section></div><section class="card section-gap"><div class="section-heading"><h2>清理数据</h2></div><div class="notice">清空数据会删除当前浏览器中 DayUp 的全部记录，操作前请先导出备份。</div><div class="form-actions"><button class="danger-button" data-action="clear-data">清空全部数据</button></div></section>`}
function formField(label,name,type='text',value='',extra=''){
 const id=`field-${name}`;const attrs=extra.replace(/class="full"/g,'');
 const min=type==='number'&&!attrs.includes('min=')?' min="0"':'';
 const control=type==='date'?dateControl(id,name,value,attrs):type==='textarea'?`<textarea id="${id}" class="form-control" name="${name}" autocomplete="off" ${attrs}>${esc(value)}</textarea>`:`<input id="${id}" class="form-control" type="${type}" name="${name}" autocomplete="off" value="${esc(value)}" ${attrs}${min}>`;
 return `<div class="form-field ${extra.includes('full')?'full':''}"><label for="${id}">${label}</label>${control}</div>`;
}
function dateControl(id,name,value='',attrs=''){
 return `<div class="date-control"><input id="${id}" class="form-control" type="text" ${name?`name="${name}"`:''} data-date-text autocomplete="off" inputmode="numeric" placeholder="YYYY-MM-DD" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" maxlength="10" value="${esc(value)}" ${attrs}><button type="button" class="calendar-trigger" aria-label="打开日历" data-action="pick-date" data-target="${id}">▦</button><input class="native-date" type="date" aria-label="日历选择日期" tabindex="-1" data-date-for="${id}" value="${esc(value)}"></div>`;
}
function selectField(label,name,options,value='',extra=''){
 if(value&&!options.includes(value))options=[...options,value];
 return `<div class="form-field ${extra.includes('full')?'full':''}"><label for="field-${name}">${label}</label><select id="field-${name}" class="form-control" name="${name}" ${extra}>${options.map(option=>`<option value="${esc(option)}" ${option===value?'selected':''}>${esc(option)}</option>`).join('')}</select></div>`;
}
function timeChoices(){return ['全天','待安排',...Array.from({length:288},(_,index)=>{const minutes=index*5;return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`})];}
function modalForm(action,fields,button='保存'){
 // Isolate both browser form history and browser-restored values by form and opening.
 const scope=`${action}__${uid('form')}__`;
 fields=fields.replace(/name="([\w]+)"/g,(_,name)=>`name="${scope}${name}" data-field="${name}"`);
 return `<form data-form="${action}" autocomplete="off"><div class="form-grid">${fields}</div><div class="form-actions"><button type="button" class="secondary-button" data-action="close-modal">取消</button><button type="submit" class="primary-button">${button}</button></div></form>`;
}
function openModal(title,body){
 previousFocus=document.activeElement;document.querySelector('.app-shell').inert=true;
 document.querySelector('#modal-root').innerHTML=`<div class="modal-backdrop" data-action="close-modal"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="modal-header"><h2 id="dialog-title">${title}</h2><button type="button" aria-label="关闭" class="close-button" data-action="close-modal">×</button></div>${body}</div></div>`;
 document.body.classList.add('modal-open');(document.querySelector('.modal input:not([type="hidden"]):not(.native-date),.modal select,.modal textarea')||document.querySelector('.modal button'))?.focus();
}
function openPlan(plan=null){const p=plan||{date:selectedDate,time:'全天',module:'个人',priority:'普通',recurrence:'不重复',reminder:'不提醒',status:'todo',notes:'',isTop:false};const fields=`${formField('计划名称','title','text',p.title||'','required')}${selectField('所属模块','module',['个人','开发工作','咨询工作','健身计划','饮食计划','游戏娱乐','学习空间'],p.module)}${linkedSelect(p.module,p.linkedId)}${p.devItemId?`<input type="hidden" name="devItemId" value="${esc(p.devItemId)}">`:''}${formField('日期','date','date',p.date||selectedDate,'required')}${selectField('时间','time',timeChoices(),p.time||'全天')}<details class="form-more full"><summary>更多设置（优先级、重复、提醒、重点）</summary><div class="form-grid">${selectField('优先级','priority',['普通','高','低'],p.priority||'普通')}${selectField('重复','recurrence',['不重复','每天','每周','每月'],p.recurrence||'不重复')}${selectField('提醒','reminder',['不提醒','5','15','30','60'],p.reminder||'不提醒')}${selectField('状态','status',['待处理','进行中','已完成','已取消'],p.status==='todo'?'待处理':p.status==='done'?'已完成':p.status==='cancelled'?'已取消':'进行中')}${selectField('今日重点','isTop',['否','是'],p.isTop?'是':'否')}${p.seriesId?selectField('重复计划修改范围','editScope',['仅本次','本次及以后'],'仅本次'):''}${formField('备注','notes','textarea',p.notes||'','class="full"')}${p.id?`<input type="hidden" name="id" value="${p.id}">`:''}</div></details>`;openModal(p.id?'编辑计划':'添加计划',modalForm('plan',fields));if(p.id)document.querySelector('.form-more')?.setAttribute('open','');}
function openProject(project=null){const p=project||{};const fields=`${formField('项目名称','name','text',p.name||'','required')}${formField('项目目标','goal','text',p.goal||'')}${selectField('状态','status',['规划中','进行中','暂停','已完成'],p.status||'规划中')}${selectField('优先级','priority',['普通','高','低'],p.priority||'普通')}${formField('开始日期','startDate','date',p.startDate||'')}${formField('截止日期','endDate','date',p.endDate||'')}${formField('下一步行动','nextAction','text',p.nextAction||'')}${p.seriesId?selectField('重复计划修改范围','editScope',['仅本次','本次及以后'],'仅本次'):''}${formField('备注','notes','textarea',p.notes||'','class="full"')}${p.id?`<input type="hidden" name="id" value="${p.id}">`:''}`;openModal(project?'编辑开发项目':'新建开发项目',modalForm('project',fields))}
function openDevlog(projectId='',log=null){const l=log||{};const projectOptions=`<option value="">不关联</option>${state.projects.map(item=>`<option value="${item.id}" ${item.id===projectId?'selected':''}>${esc(item.name)}</option>`).join('')}`;const fields=`${formField('日期','date','date',l.date||today(),'required')}<div class="form-field"><label>关联项目</label><select class="form-control" name="projectId">${projectOptions}</select></div>${formField('耗时（分钟）','duration','number',l.duration??'60')}${formField('工作内容','content','textarea',l.content||'','class="full" required')}${formField('遇到的问题','blockers','textarea',l.blockers||'','class="full"')}${l.id?`<input type="hidden" name="id" value="${l.id}">`:''}`;openModal(log?'编辑开发日志':'记录开发日志',modalForm('devlog',fields))}
function openClient(client=null){const c=client||{};const fields=`${formField('客户名称','name','text',c.name||'','required')}${formField('咨询主题','topic','text',c.topic||'')}${selectField('状态','status',['跟进中','待开始','已结束'],c.status||'跟进中')}${formField('下次跟进','nextFollowup','date',c.nextFollowup||'')}${formField('联系方式','contact','text',c.contact||'')}${formField('备注','notes','textarea',c.notes||'','class="full"')}${c.id?`<input type="hidden" name="id" value="${c.id}">`:''}`;openModal(client?'编辑咨询客户':'添加咨询客户',modalForm('client',fields))}
function openConsultLog(clientId=''){const clientOptions=state.clients.map(item=>`<option value="${item.id}" ${item.id===clientId?'selected':''}>${esc(item.name)}</option>`).join('');const fields=`<div class="form-field"><label>客户</label><select class="form-control" name="clientId">${clientOptions||'<option value="">暂无客户</option>'}</select></div>${formField('日期','date','date',today(),'required')}${selectField('沟通方式','channel',['语音','视频','文字','线下'],'文字')}${formField('内容摘要','summary','textarea','','class="full" required')}${formField('后续行动','nextAction','text','')}`;openModal('记录一次沟通',modalForm('consultlog',fields))}
function openWorkout(workout=null){
 const w=workout||{},exercises=w.exercises||[];
 const fields=`${formField('日期','date','date',w.date||selectedDate,'required')}${selectField('训练类型','type',['力量训练','有氧训练','拉伸恢复','球类运动','休息日','其他'],w.type||'力量训练')}${formField('时长（分钟）','duration','number',w.duration??'45')}<div class="full exercise-list" id="exercise-list">${exercises.map(exerciseEditor).join('')||(!workout?exerciseEditor(): '')}</div><div class="full"><button type="button" class="secondary-button" data-action="add-exercise">＋ 添加动作</button><p class="subtle">每个动作分别记录部位、组数和次数。有氧、休息日可移除动作，填写下方完成情况。</p></div>${formField('完成情况（有动作时可选）','detail','textarea',w.detail===exerciseSummary(exercises)?'':w.detail||'','class="full"')}${formField('训练备注','notes','textarea',w.notes||'','class="full"')}${w.id?`<input type="hidden" name="id" value="${w.id}">`:''}`;
 openModal(workout?'编辑训练':'记录训练',modalForm('workout',fields));
}
function openFitnessPlan(plan=null){const p=plan||{};const fields=`${formField('目标名称','name','text',p.name||'','required')}${formField('频率','frequency','text',p.frequency||'每周 3 次')}${formField('目标描述','target','text',p.target||'')}${formField('当前进度（%）','progress','number',p.progress||'0','min="0" max="100"')}${p.id?`<input type="hidden" name="id" value="${p.id}">`:''}`;openModal(plan?'编辑训练目标':'设置训练目标',modalForm('fitnessplan',fields))}
function openMeal(meal=null){const m=meal||{};const fields=`${formField('日期','date','date',m.date||selectedDate,'required')}${selectField('餐次','name',['早餐','午餐','晚餐','加餐'],m.name||'早餐')}${selectField('时间','time',timeChoices().filter(time=>!['全天','待安排'].includes(time)),m.time||'08:00')}${formField('食物内容','foods','textarea',m.foods||'','class="full" required')}${formField('热量（kcal，可选）','calories','number',m.calories||'')}${formField('蛋白质（g，可选）','protein','number',m.protein||'')}${formField('备注','notes','textarea',m.notes||'','class="full"')}${m.id?`<input type="hidden" name="id" value="${m.id}">`:''}`;openModal(meal?'编辑餐食':'记录餐食',modalForm('meal',fields))}
function openWater(){const fields=`${formField('日期','date','date',selectedDate,'required')}${formField('饮水量（ml）','water','number','300','required')}`;openModal('记录饮水',modalForm('water',fields))}
function openGame(game=null){const g=game||{};const fields=`${formField('游戏名称','name','text',g.name||'','required')}${formField('平台','platform','text',g.platform||'')}${selectField('状态','status',['想玩','在玩','已通关','已暂停'],g.status||'想玩')}${formField('当前进度（%）','progress','number',g.progress||'0','min="0" max="100"')}${formField('评分（可选）','rating','number',g.rating||'','min="0" max="10" step="0.5"')}${formField('备注','notes','textarea',g.notes||'','class="full"')}${g.id?`<input type="hidden" name="id" value="${g.id}">`:''}`;openModal(game?'编辑游戏':'添加游戏',modalForm('game',fields))}
function openSession(gameId){const game=state.games.find(item=>item.id===gameId);const fields=`${formField('日期','date','date',today(),'required')}${formField('时长（分钟）','duration','number','60')}${formField('本次体验','note','textarea','','class="full"')}${formField('游玩后进度（%）','progress','number',game?.progress||'0','min="0" max="100"')}<input type="hidden" name="gameId" value="${gameId}">`;openModal('记录游玩',modalForm('session',fields))}
function recurrenceDates(date,recurrence){if(!recurrence||recurrence==='不重复')return[];const count=recurrence==='每天'?365:recurrence==='每周'?52:12;return Array.from({length:count},(_,index)=>recurrence==='每月'?DayUpCore.addMonths(date,index+1):isoPlus(date,(index+1)*(recurrence==='每周'?7:1)))}
function enforceTopThree(date,keepId){const focus=state.plans.filter(plan=>plan.date===date&&plan.isTop);if(focus.length<=3)return;const ordered=[...focus.filter(plan=>plan.id===keepId),...focus.filter(plan=>plan.id!==keepId)];ordered.slice(3).forEach(plan=>{plan.isTop=false})}
function savePlan(data){
 const statusMap={'待处理':'todo','进行中':'doing','已完成':'done','已取消':'cancelled'};
 data.status=statusMap[data.status]||data.status||'todo';data.isTop=data.isTop==='是'||data.isTop===true;
 const existing=data.id&&state.plans.find(plan=>plan.id===data.id);
 const date=data.date;
 if(data.isTop && state.plans.filter(p=>p.date===date&&p.id!==data.id&&p.isTop).length>=3)throw Error('这一天已有三件重点，请先取消其中一件');
 if(!['全天','待安排'].includes(data.time)&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time))throw Error('请选择有效时间');
 if(['全天','待安排'].includes(data.time)&&data.reminder!=='不提醒')throw Error('请先选择具体时间，再设置提醒');
 const stamp=nowIso();
 const scope=data.editScope;delete data.editScope;
 if(existing){
   const original={...existing};
   if(original.seriesId&&scope==='本次及以后'){
     const series=state.series.find(s=>s.id===original.seriesId);
     if(series){
       state.series.push({...series,id:uid('series'),startDate:date,recurrence:data.recurrence,template:{...data,isTop:false},excluded:[]});
       const newSeries=state.series[state.series.length-1];
       series.endDate=isoPlus(original.originalDate||original.date,-1);
       state.plans=state.plans.filter(p=>p.id===original.id||p.seriesId!==series.id||(p.originalDate||p.date)<(original.originalDate||original.date)||p.status==='done');
       Object.assign(existing,data,{seriesId:data.recurrence==='不重复'?null:newSeries.id,originalDate:date,updatedAt:stamp});
       if(data.recurrence==='不重复')state.series=state.series.filter(s=>s.id!==newSeries.id);
     }
   }else{
     Object.assign(existing,data,{updatedAt:stamp});
     // A single occurrence is an exception; its siblings retain their original rule.
     if(original.seriesId)existing.recurrence=original.recurrence;
     else if(data.recurrence!=='不重复')attachSeries(existing);
   }
 }else{
   const base={...data,id:uid('plan'),createdAt:stamp,updatedAt:stamp};state.plans.push(base);
   if(data.recurrence!=='不重复')attachSeries(base);
 }
}
function attachSeries(plan){
 const series={id:uid('series'),startDate:plan.date,recurrence:plan.recurrence,template:{...plan,isTop:false,status:'todo'},excluded:[]};
 plan.seriesId=series.id;plan.originalDate=plan.date;state.series.push(series);
 recurrenceDates(plan.date,plan.recurrence).forEach(date=>DayUpCore.ensureOccurrence(state,date));
}
async function handleForm(form){
 if(form.dataset.form==='backup-import'||form.dataset.form==='backup-delete')return handleBackupForm(form);
 const data=validateSubmission(form),action=form.dataset.form;
 if(await handleLearningForm(action,data))return;
 const stamp=nowIso();let message='已保存';
 const upsert=(key,prefix)=>{
   const existing=data.id&&state[key].find(row=>row.id===data.id);
   if(existing)Object.assign(existing,data,{updatedAt:stamp});
   else state[key].push({...data,id:uid(prefix),createdAt:stamp,updatedAt:stamp});
 };
 if(action==='plan'){savePlan(data);syncDevelopmentPlan(state.plans.find(p=>data.id?p.id===data.id:p.devItemId&&p.devItemId===data.devItemId&&p.date===data.date&&p.linkedId===data.linkedId));message='计划已保存';}if(action==='memo'){if(!data.text.trim())throw Error('备忘内容不能为空');upsert('memos','memo');message='备忘已保存';}
 if(action==='devitem'){saveDevItem(data);message='项目事项已保存';}
 if(action==='project'){upsert('projects','project');message='项目已保存';}
 if(action==='devlog'){
   const project=state.projects.find(p=>p.id===data.projectId);
   const log=data.id&&state.devLogs.find(l=>l.id===data.id);if(log)Object.assign(log,data,{projectName:project?.name||'未关联项目',updatedAt:stamp});else state.devLogs.push({...data,id:uid('log'),projectName:project?.name||'未关联项目',createdAt:stamp,updatedAt:stamp});
   if(project)project.updatedAt=stamp;message='开发日志已记录';
 }
 if(action==='client'){upsert('clients','client');message='客户已保存';}
 if(action==='consultlog'){
   const client=state.clients.find(c=>c.id===data.clientId);
   state.consultLogs.push({...data,id:uid('consultlog'),clientName:client.name,createdAt:stamp,updatedAt:stamp});message='沟通记录已保存';
 }
 if(action==='workout'){upsert('workouts','workout');message='训练已记录';}
 if(action==='fitnessplan'){upsert('fitnessPlans','fitness');message='训练目标已保存';}
 if(action==='meal'){upsert('meals','meal');message='餐食已记录';}
 if(action==='water'){state.meals.push({...data,id:uid('water'),name:'饮水',foods:'饮水记录',createdAt:stamp,updatedAt:stamp});message='饮水已记录';}
 if(action==='game'){upsert('games','game');message='游戏已保存';}
 if(action==='session'){
   const game=state.games.find(g=>g.id===data.gameId);
   state.gameSessions.push({...data,id:uid('session'),gameName:game.name,createdAt:stamp,updatedAt:stamp});
   game.lastPlayed=data.date;game.progress=data.progress;game.updatedAt=stamp;message='游玩记录已保存';
 }
 await save();closeModal();render();notify(message);
}

function exportData(){
 if(backupClient)return backupClient.create(DayUpCore.validateBackup(state)).then(result=>{notify(`备份已保存：${result.name}`);return result;});
 const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`dayup-backup-${today()}.json`;link.click();URL.revokeObjectURL(url);notify('备份已导出到浏览器下载目录；项目文件夹备份请从启动脚本打开');
}
async function showBackups(mode='import'){
 if(!backupClient)throw Error('请使用启动脚本打开 DayUp，才能管理项目文件夹中的备份');
 const result=await backupClient.list(), deleting=mode==='delete',viewing=mode==='view';
 const rows=result.files.map(file=>`<label class="backup-row">${viewing?'':`<input type="${deleting?'checkbox':'radio'}" name="backupNames" value="${esc(file.name)}">`}<span><strong>${esc(file.name)}</strong><small>${(file.size/1024).toFixed(1)} KB</small></span></label>`).join('');
 if(viewing){openModal('备份文件夹',`<div class="backup-view"><p class="backup-path">${esc(result.folder)}</p><p class="subtle">共 ${result.files.length} 份备份 · 这里显示该文件夹中的实际备份文件。也会请求 Windows 资源管理器打开同一目录。</p><div class="backup-list">${rows||empty('还没有备份','点击“导出备份”后，文件会保存在这里。')}</div></div><div class="form-actions"><button class="secondary-button" data-action="close-modal">关闭</button></div>`);return result;}
 openModal(deleting?'删除历史备份':'从备份文件夹恢复',`<form data-form="backup-${mode}" autocomplete="off"><div class="form-grid"><p class="full backup-path">${esc(result.folder)}</p><p class="full subtle">${deleting?'选择要删除的文件，下一步会再次确认。删除备份不影响当前使用中的数据。':'选择一个历史备份，验证通过后再确认覆盖当前数据。'}</p><div class="full backup-list">${rows||empty('还没有备份','请先导出一次备份。')}</div></div><div class="form-actions"><button type="button" class="secondary-button" data-action="close-modal">取消</button><button type="submit" class="${deleting?'danger-button':'primary-button'}" ${result.files.length?'':'disabled'}>${deleting?'删除选中备份':'恢复选中备份'}</button></div></form>`);
}
async function handleBackupForm(form){
 const names=[...new FormData(form).entries()].filter(([name])=>name==='backupNames').map(([,value])=>value);
 if(!names.length)throw Error('请先选择备份文件');
 if(form.dataset.form==='backup-delete'){
  if(!await confirmAction(`确定删除这 ${names.length} 份历史备份吗？文件删除后不能撤销，当前使用中的数据不受影响。`)){await showBackups('delete');return;}
  await backupClient.remove(names);notify(`已删除 ${names.length} 份备份`);await showBackups('delete');
 }else{
  const candidate=await backupClient.read(names[0]);
  if(await restoreBackup(JSON.stringify(candidate),true))closeModal();else await showBackups('import');
 }
}
async function restoreBackup(raw,confirmReplace=true){
 const imported=JSON.parse(raw);
 if(!Array.isArray(imported.plans))throw Error('备份缺少计划列表');
 const candidate=DayUpCore.validateBackup(imported);
 if(confirmReplace && !await confirmAction('导入备份会覆盖当前本地数据，确定继续吗？'))return false;
 const previous=state;state=candidate;
 try{await save()}catch(error){state=previous;throw error}
 render();notify('备份已导入');return true;
}
async function importData(file){
 try{const raw=await file.text();await restoreBackup(raw)}catch(error){notify(`备份文件格式不正确或恢复失败，现有数据未改变：${error.message}`)}
}

async function checkReminders(){
 if(!dataReady||busy||!state.settings.reminders||!('Notification' in window)||Notification.permission!=='granted')return;
 DayUpCore.ensureOccurrence(state,today());DayUpCore.ensureOccurrence(state,isoPlus(today(),1));
 for(const plan of DayUpCore.dueReminders(state)){
  const target=new Date(`${plan.date}T${plan.time}:00`).getTime()-Number(plan.reminder)*60000;
  const key=`${plan.id}:${target}`;
  try{new Notification('DayUp 计划提醒',{body:plan.title});state.notified.push(key);await save();}catch(error){notify('通知未发出，请检查浏览器权限');}
 }
}
async function requestNotifications(){
 if(!('Notification' in window)){notify('当前浏览器不支持通知');return;}
 try{const permission=await Notification.requestPermission();if(permission==='granted'){state.settings.reminders=true;await save();new Notification('DayUp 测试提醒',{body:'通知已启用，页面打开时可接收计划提醒。'});notify('通知已启用');render();}else notify('通知尚未允许，请在浏览器中授权');}catch{notify('无法启用通知，请通过本地启动脚本打开后重试');}
}

document.addEventListener('click',async event=>{try{const element=event.target.closest('[data-action],[data-view]');if(!element)return;if(element.classList.contains('modal-backdrop')&&event.target!==element)return;const action=element.dataset.action;if(!dataReady)return;if(busy&&!(confirmResolve&&['confirm-yes','close-modal'].includes(action)))return;if(element.dataset.view)return setView(element.dataset.view);if(await handleLearningAction(action,element))return;if(await handleWorkspaceAction(action,element))return;if(await handleCalendarAction(action,element))return;if(action==='pick-date'){const picker=document.querySelector(`[data-date-for="${element.dataset.target}"]`);const input=document.querySelector(`#${element.dataset.target}`);picker.value=DayUpCore.validDate(input.value)?input.value:'';if(picker.showPicker)picker.showPicker();else{picker.focus();picker.click();}return;}if(action==='confirm-yes'){const resolve=confirmResolve;confirmResolve=null;closeModal();resolve?.(true);return}if(action==='request-notification'){await requestNotifications();return}if(action==='close-modal'){event.preventDefault();event.stopPropagation();closeModal();return}if(action==='new-plan'){if(currentView==='overview')selectedDate=today();return openPlan();}if(action==='edit-plan')return openPlan(state.plans.find(plan=>plan.id===element.dataset.id));if(action==='toggle-plan'){const plan=state.plans.find(item=>item.id===element.dataset.id);if(plan){plan.status=plan.status==='done'?'todo':'done';plan.updatedAt=nowIso();syncDevelopmentPlan(plan);await save();render()}return}if(action==='cancel-plan'){const plan=state.plans.find(p=>p.id===element.dataset.id);if(plan){plan.status='cancelled';plan.updatedAt=nowIso();await save();render();notify('计划已取消');}return;}if(action==='move-plan'){const plan=state.plans.find(item=>item.id===element.dataset.id);if(plan){plan.date=isoPlus(today(),1);plan.isTop=false;plan.updatedAt=nowIso();await save();render();notify('计划已推迟到明天')}return}if(action==='delete-plan'){if(await confirmAction('确定删除这条计划吗？')){DayUpCore.deleteOccurrence(state,element.dataset.id);await save();render();notify('计划已删除')}return}if(action==='date-picker'){selectedDate=element.value||today();render();return}if(action==='shift-date'){selectedDate=isoPlus(selectedDate,Number(element.dataset.delta));render();return}if(action==='go-today'){selectedDate=today();render();return}if(action==='add-memo'){const textarea=document.querySelector('#quick-memo');if(textarea?.value.trim()){state.memos.push({id:uid('memo'),text:textarea.value.trim(),createdAt:nowIso()});await save();render();notify('备忘已保存')}return}if(action==='edit-memo'){const memo=state.memos.find(m=>m.id===element.dataset.id);if(memo)openModal('编辑备忘',modalForm('memo',`${formField('备忘内容','text','textarea',memo.text,'required class="full"')}${selectField('所属模块','module',['个人','开发工作','咨询工作','健身计划','饮食计划','游戏娱乐','学习空间'],memo.module||'个人')}<input type="hidden" name="id" value="${memo.id}">`));return;}if(action==='delete-memo'){if(!await confirmAction('确定删除这条备忘吗？'))return;state.memos=state.memos.filter(item=>item.id!==element.dataset.id);await save();render();notify('备忘已删除');return}if(action==='memo-to-plan'){const memo=state.memos.find(item=>item.id===element.dataset.id);if(memo)openPlan({title:memo.text,date:today(),time:'全天',module:memo.module||'个人',priority:'普通',recurrence:'不重复',reminder:'不提醒',status:'todo',notes:'来自快速备忘',isTop:false});return}if(action==='new-project')return openProject();if(action==='edit-project')return openProject(state.projects.find(item=>item.id===element.dataset.id));if(action==='new-devlog')return openDevlog(element.dataset.projectId||'');if(action==='delete-project'){if(await confirmAction('确定删除这个项目吗？')){state.projects=state.projects.filter(item=>item.id!==element.dataset.id);await save();render();notify('项目已删除')}return}if(action==='new-client')return openClient();if(action==='edit-client')return openClient(state.clients.find(item=>item.id===element.dataset.id));if(action==='new-consult-log')return openConsultLog(element.dataset.clientId||'');if(action==='delete-client'){if(await confirmAction('确定删除这个客户吗？')){state.clients=state.clients.filter(item=>item.id!==element.dataset.id);await save();render();notify('客户已删除')}return}if(action==='schedule-fitness'){return openPlan({title:'训练',module:'健身计划',date:selectedDate,time:'待安排',recurrence:'不重复',reminder:'不提醒',status:'todo'});}if(action==='new-workout')return openWorkout();if(action==='new-fitness-plan')return openFitnessPlan();if(action==='edit-fitness-plan')return openFitnessPlan(state.fitnessPlans.find(item=>item.id===element.dataset.id));if(action==='delete-fitness-plan'){if(await confirmAction('确定删除这个训练目标吗？')){state.fitnessPlans=state.fitnessPlans.filter(item=>item.id!==element.dataset.id);await save();render();notify('训练目标已删除')}return}if(action==='new-meal')return openMeal();if(action==='edit-meal')return openMeal(state.meals.find(item=>item.id===element.dataset.id));if(action==='delete-meal'){if(await confirmAction('确定删除这条餐食记录吗？')){state.meals=state.meals.filter(item=>item.id!==element.dataset.id);await save();render();notify('餐食已删除')}return}if(action==='new-water')return openWater();if(action==='new-game')return openGame();if(action==='edit-game')return openGame(state.games.find(item=>item.id===element.dataset.id));if(action==='delete-game'){if(await confirmAction('确定删除这个游戏吗？')){state.games=state.games.filter(item=>item.id!==element.dataset.id);await save();render();notify('游戏已删除')}return}if(action==='new-session')return openSession(element.dataset.gameId);if(action==='export-data')return await exportData();if(action==='view-backups'){if(!backupClient)throw Error('请使用启动脚本打开 DayUp');await showBackups('view');try{await backupClient.open();notify('已请求 Windows 打开备份文件夹');}catch(error){notify(error.message);}return;}if(action==='delete-backups')return await showBackups('delete');if(action==='import-data')return backupClient?await showBackups('import'):document.querySelector('#import-file')?.click();if(action==='import-other')return document.querySelector('#import-file')?.click();if(action==='clear-data'&&await confirmAction('确定清空 DayUp 的全部本地数据吗？建议先导出备份。')){state=defaultState();await save();render();notify('数据已清空')}}catch(error){notify(error.message)}});
document.addEventListener('submit',async event=>{
 if(!event.target.matches('[data-form]'))return;event.preventDefault();if(busy||!dataReady)return;
 busy=true;const button=event.target.querySelector('[type="submit"]');if(button)button.disabled=true;
 try{await handleForm(event.target)}catch(error){notify(error.message)}finally{busy=false;if(button)button.disabled=false;}
});
document.addEventListener('change',async event=>{
 try{
  if(event.target.matches('[data-setting]')){state.settings[event.target.dataset.setting]=event.target.checked;await save();notify(event.target.checked?'提醒已开启':'提醒已关闭');}
  if(event.target.matches('#import-file')&&event.target.files?.[0]){const file=event.target.files[0];event.target.value='';await importData(file);}
  if(event.target.matches('[data-date-for]')){const input=document.querySelector(`#${event.target.dataset.dateFor}`);input.value=event.target.value;if(input.id==='date-picker'){selectedDate=input.value||today();render();}}
  if(event.target.matches('#date-picker')){if(!event.target.value||DayUpCore.validDate(event.target.value)){selectedDate=event.target.value||today();render();}else notify('请填写完整日期，例如 2026-10-28');}
  if(event.target.matches('[data-field="module"],[name="module"]')&&document.querySelector('#linked-field'))document.querySelector('#linked-field').outerHTML=linkedSelect(event.target.value);
 }catch(error){notify(error.message)}
});
document.addEventListener('keydown',event=>{
 const modal=document.querySelector('.modal');
 if(event.key==='Escape'&&document.querySelector('.modal-backdrop'))closeModal();
 if(event.key==='Tab'&&modal?.querySelectorAll){
  const controls=[...modal.querySelectorAll('button,input:not([type="hidden"]),select,textarea,summary')].filter(el=>!el.disabled&&el.getClientRects().length);
  const first=controls[0],last=controls[controls.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 }
});
document.querySelector('#quick-add').addEventListener('click',()=>{if(dataReady){selectedDate=today();openPlan();}});
let renderedDate=today();setInterval(()=>{checkReminders().catch(error=>notify(error.message));if(renderedDate!==today()){renderedDate=today();if(currentView==='overview')render();}},30000);
hydrateFallback().finally(render);

function confirmAction(message){
 openModal('请确认',`<p class="confirmation-message">${esc(message)}</p><div class="form-actions"><button type="button" class="secondary-button" data-action="close-modal">取消</button><button type="button" class="danger-button" data-action="confirm-yes">确定</button></div>`);
 return new Promise(resolve=>{confirmResolve=resolve});
}
function planGroups(plans){
 return [['全天事项',plans.filter(p=>p.time==='全天')],['按时间安排',plans.filter(p=>p.time&& !['全天','待安排'].includes(p.time))],['待安排',plans.filter(p=>!p.time||p.time==='待安排')]].filter(([,rows])=>rows.length).map(([title,rows])=>`<div class="timeline-group"><h3>${title}</h3><div class="task-list">${rows.map(p=>planRow(p)).join('')}</div></div>`).join('');
}
function linkedChoices(module){return module==='学习空间'?state.learning.subjects:module==='开发工作'?state.projects:module==='咨询工作'?state.clients:module==='健身计划'?state.fitnessPlans:module==='游戏娱乐'?state.games:[];}
function linkedSelect(module,id=''){
 const rows=linkedChoices(module);
 return `<div class="form-field full" id="linked-field"><label for="field-linkedId">关联记录（可选）</label><select id="field-linkedId" name="linkedId" class="form-control"><option value="">不关联</option>${rows.map(row=>`<option value="${row.id}" ${row.id===id?'selected':''}>${esc(row.name)}</option>`).join('')}</select></div>`;
}
function validateSubmission(form){const data=Object.fromEntries([...new FormData(form).entries()].map(([name,value])=>[name.split('__').pop(),typeof value==='string'?value.trim():value]));if(form.dataset.form==='workout'&&form.querySelectorAll){data.exercises=[...form.querySelectorAll('[data-exercise-row]')].map(row=>Object.fromEntries([...row.querySelectorAll('[data-exercise]')].map(input=>[input.dataset.exercise,input.value.trim()])));if(!data.detail&&data.exercises.length)data.detail=exerciseSummary(data.exercises);if(data.type==='休息日'&&!data.detail)data.detail='休息恢复';}for(const key of Object.keys(data))if(key.startsWith('exercise_'))delete data[key];DayUpCore.assertForm(form.dataset.form,data,state);return data;}
