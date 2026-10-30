/* Project workspace and dated life records. Data remains in the shared local state. */
let selectedProjectId='';
const itemLabels={task:'任务',issue:'问题',milestone:'里程碑'};
function projectProgress(project){const tasks=(project.items||[]).filter(i=>i.kind==='task');return tasks.length?Math.round(tasks.filter(i=>i.status==='已完成').length/tasks.length*100):0;}
function projectLogs(projectId){return state.devLogs.filter(l=>l.projectId===projectId).sort((a,b)=>b.date.localeCompare(a.date));}
function logRows(logs){return logs.length?`<div class="log-list">${logs.map(log=>`<div class="log-entry"><strong>${formatShort(log.date)} · ${esc(state.projects.find(p=>p.id===log.projectId)?.name||log.projectName||'未关联项目')} · ${Number(log.duration)||0} 分钟</strong><p>${esc(log.content)}${log.blockers?` · 阻碍：${esc(log.blockers)}`:''}</p><div class="row-actions"><button class="link-button" data-action="edit-devlog" data-id="${log.id}">编辑</button><button class="link-button danger-text" data-action="delete-devlog" data-id="${log.id}">删除</button></div></div>`).join('')}</div>`:empty('还没有开发日志','记下完成的工作、耗时和阻碍。');}
function renderDevelopmentWorkspace(){
 const project=state.projects.find(p=>p.id===selectedProjectId);
 if(project)return renderProjectDetail(project);
 return `<div class="page-toolbar"><span class="subtle">项目 → 拆分任务 → 安排今天 → 记录进展</span><button class="primary-button" data-action="new-project">＋ 新建项目</button></div><div class="project-grid">${state.projects.map(p=>{
  const items=p.items||[],tasks=items.filter(i=>i.kind==='task'),openIssues=items.filter(i=>i.kind==='issue'&&i.status!=='已完成');
  return `<section class="card project-card"><div class="section-heading"><button class="project-title" data-action="open-project" data-id="${p.id}">${esc(p.name)}</button><span class="pill ${p.status==='已完成'?'green':'blue'}">${esc(p.status)}</span></div><p>${esc(p.goal||'还没有填写目标')}</p><div class="mini-metric"><span>任务完成 ${tasks.filter(i=>i.status==='已完成').length}/${tasks.length}</span><strong>${projectProgress(p)}%</strong></div><div class="progress"><i style="width:${projectProgress(p)}%"></i></div><p class="subtle">${openIssues.length} 个待处理问题 · 截止 ${esc(p.endDate||'未设置')}</p><p class="next-action">下一步：${esc(p.nextAction||'进入项目拆分任务')}</p><div class="row-actions"><button class="primary-button" data-action="open-project" data-id="${p.id}">进入项目</button><button class="link-button" data-action="edit-project" data-id="${p.id}">编辑</button><button class="link-button" data-action="new-devlog" data-project-id="${p.id}">记日志</button><button class="link-button danger-text" data-action="delete-project" data-id="${p.id}">删除</button></div></section>`;
 }).join('')||`<section class="card">${empty('还没有开发项目','先创建项目，再拆分任务、记录问题和设置里程碑。')}</section>`}</div><section class="card section-gap"><div class="section-heading"><h2>开发日志</h2><button class="link-button" data-action="new-devlog">记录今天 →</button></div>${logRows(state.devLogs.slice().sort((a,b)=>b.date.localeCompare(a.date)))}</section>`;
}
function renderProjectDetail(p){
 const items=p.items||[],logs=projectLogs(p.id),plans=state.plans.filter(plan=>plan.module==='开发工作'&&plan.linkedId===p.id);
 return `<div class="page-toolbar"><button class="secondary-button" data-action="project-list">‹ 所有项目</button><div class="toolbar-group"><button class="secondary-button" data-action="edit-project" data-id="${p.id}">编辑项目</button><button class="primary-button" data-action="new-devlog" data-project-id="${p.id}">记录进展</button></div></div><section class="card project-header"><div class="section-heading"><div><p class="eyebrow">开发项目</p><h2>${esc(p.name)}</h2></div><span class="pill blue">${esc(p.status)}</span></div><p>${esc(p.goal||'尚未填写项目目标')}</p><div class="chip-row"><span class="pill">开始 ${esc(p.startDate||'未设置')}</span><span class="pill">截止 ${esc(p.endDate||'未设置')}</span>${priorityPill(p.priority)}</div><p>下一步：${esc(p.nextAction||'尚未定义')}</p>${p.notes?`<p class="preserve-lines subtle">${esc(p.notes)}</p>`:''}<div class="kpi-row"><div class="kpi"><strong>${projectProgress(p)}%</strong><span>任务完成进度</span></div><div class="kpi"><strong>${items.filter(i=>i.kind==='issue'&&i.status!=='已完成').length}</strong><span>待处理问题</span></div><div class="kpi"><strong>${logs.reduce((s,l)=>s+Number(l.duration||0),0)}</strong><span>累计投入（分钟）</span></div></div></section>
 <section class="card section-gap"><div class="section-heading"><h2>任务看板</h2><button class="primary-button" data-action="new-devitem" data-kind="task" data-project-id="${p.id}">＋ 拆分任务</button></div><div class="task-board">${['待处理','进行中','阻塞','已完成'].map(status=>`<div class="board-column"><h3>${status} <span>${items.filter(i=>i.kind==='task'&&i.status===status).length}</span></h3>${items.filter(i=>i.kind==='task'&&i.status===status).map(i=>devItemCard(p,i)).join('')||'<p class="subtle">暂无任务</p>'}</div>`).join('')}</div></section>
 <div class="two-col section-gap">${['issue','milestone'].map(kind=>`<section class="card"><div class="section-heading"><h2>${kind==='issue'?'问题记录':'里程碑'}</h2><button class="link-button" data-action="new-devitem" data-kind="${kind}" data-project-id="${p.id}">＋ 添加${itemLabels[kind]}</button></div><div class="compact-list">${items.filter(i=>i.kind===kind).map(i=>devItemCard(p,i)).join('')||empty(`还没有${itemLabels[kind]}`,'在这里记录与当前项目有关的内容。')}</div></section>`).join('')}</div>
 <section class="card section-gap"><div class="section-heading"><h2>关联计划</h2><button class="link-button" data-view="plans">查看今日计划 →</button></div>${plans.length?plans.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(plan=>`<div class="list-row"><span>${esc(plan.date)}</span>${planRow(plan,{compact:true})}</div>`).join(''):empty('尚未安排计划','点击任务上的“安排到计划”，选择日期和时间。')}</section>
 <section class="card section-gap"><div class="section-heading"><h2>开发日志</h2><button class="link-button" data-action="new-devlog" data-project-id="${p.id}">＋ 记录日志</button></div>${logRows(logs)}</section>`;
}
function devItemCard(project,item){
 return `<article class="dev-item ${item.status==='已完成'?'item-done':''}"><strong>${esc(item.title)}</strong><div class="chip-row"><span class="pill">${esc(item.status)}</span>${priorityPill(item.priority)}${item.severity?`<span class="pill orange">${esc(item.severity)}</span>`:''}</div>${item.description?`<p class="preserve-lines">${esc(item.description)}</p>`:''}${item.acceptance?`<p>验收：${esc(item.acceptance)}</p>`:''}<small>截止 ${esc(item.dueDate||'未设置')}${item.estimate?` · 预计 ${esc(item.estimate)} 分钟`:''}</small><div class="row-actions"><button class="link-button" data-action="edit-devitem" data-project-id="${project.id}" data-id="${item.id}">编辑</button>${item.kind==='task'&&item.status!=='已完成'?`<button class="link-button" data-action="schedule-devitem" data-project-id="${project.id}" data-id="${item.id}">安排到计划</button>`:''}${item.status!=='已完成'?`<button class="link-button" data-action="complete-devitem" data-project-id="${project.id}" data-id="${item.id}">完成</button>`:''}<button class="link-button danger-text" data-action="delete-devitem" data-project-id="${project.id}" data-id="${item.id}">删除</button></div></article>`;
}
function openDevItem(projectId,kind='task',item=null){
 const i=item||{};
 const fields=`${formField(`${itemLabels[kind]}名称`,'title','text',i.title||'','required')}${selectField('状态','status',['待处理','进行中','阻塞','已完成'],i.status||'待处理')}${selectField('优先级','priority',['普通','高','低'],i.priority||'普通')}${formField('截止日期','dueDate','date',i.dueDate||'')}${kind==='task'?formField('预计耗时（分钟）','estimate','number',i.estimate||''):''}${kind==='issue'?selectField('严重程度','severity',['一般','严重','致命'],i.severity||'一般'):''}${formField(kind==='issue'?'问题现象与复现步骤':'说明','description','textarea',i.description||'','class="full"')}${formField(kind==='issue'?'预期行为 / 解决结果':'验收条件','acceptance','textarea',i.acceptance||'','class="full"')}<input type="hidden" name="projectId" value="${esc(projectId)}"><input type="hidden" name="kind" value="${kind}">${i.id?`<input type="hidden" name="id" value="${i.id}">`:''}`;
 openModal(`${item?'编辑':'新增'}${itemLabels[kind]}`,modalForm('devitem',fields));
}
function saveDevItem(data){
 const project=state.projects.find(p=>p.id===data.projectId);if(!project)throw Error('项目已不存在');
 project.items=project.items||[];const stamp=nowIso(),old=project.items.find(i=>i.id===data.id);
 if(data.id&&!old)throw Error('事项已不存在，请重新打开项目');
 if(old)Object.assign(old,data,{updatedAt:stamp});else project.items.push({...data,id:uid('devitem'),createdAt:stamp,updatedAt:stamp});
 project.updatedAt=stamp;
 if(old)for(const plan of state.plans.filter(p=>p.devItemId===old.id&&p.linkedId===project.id)){plan.status={'待处理':'todo','进行中':'doing','已完成':'done','阻塞':'todo'}[old.status];plan.updatedAt=stamp;}
}
function syncDevelopmentPlan(plan){
 const project=state.projects.find(p=>p.id===plan?.linkedId),item=plan?.module==='开发工作'&&project?.items?.find(i=>i.id===plan.devItemId);
 if(item&&plan.status!=='cancelled'){item.status={todo:'待处理',doing:'进行中',done:'已完成'}[plan.status]||item.status;item.updatedAt=nowIso();project.updatedAt=nowIso();}
}
async function handleWorkspaceAction(action,element){
 const id=element.dataset.id,project=state.projects.find(p=>p.id===element.dataset.projectId),item=project?.items?.find(i=>i.id===id);
 if(action==='open-project'){selectedProjectId=id;render();return true;}
 if(action==='project-list'){selectedProjectId='';render();return true;}
 if(action==='new-devitem'){openDevItem(project?.id||selectedProjectId,element.dataset.kind);return true;}
 if(action==='edit-devitem'){if(item)openDevItem(project.id,item.kind,item);return true;}
 if(action==='complete-devitem'){if(item){saveDevItem({...item,projectId:project.id,status:'已完成'});await save();render();}return true;}
 if(action==='delete-devitem'){
  if(item&&await confirmAction('确定删除这个项目事项吗？已安排的计划将保留记录并解除事项关联。')){
   project.items=project.items.filter(i=>i.id!==id);project.updatedAt=nowIso();
   state.plans.filter(p=>p.devItemId===id&&p.linkedId===project.id).forEach(p=>{delete p.devItemId;});await save();render();
  }return true;
 }
 if(action==='schedule-devitem'){
  if(item){const existing=state.plans.find(p=>p.devItemId===id&&p.linkedId===project.id&&!['done','cancelled'].includes(p.status));selectedDate=today();openPlan(existing||{title:item.title,date:today(),module:'开发工作',linkedId:project.id,devItemId:id,time:'待安排',priority:item.priority||'普通',recurrence:'不重复',reminder:'不提醒',status:'todo',notes:item.acceptance||item.description||''});}return true;
 }
 if(action==='edit-devlog'){const log=state.devLogs.find(l=>l.id===id);if(log)openDevlog(log.projectId,log);return true;}
 if(action==='delete-devlog'){if(await confirmAction('确定删除这条开发日志吗？')){state.devLogs=state.devLogs.filter(l=>l.id!==id);await save();render();}return true;}
 return false;
}
function renderMonthCalendar(kind){
 const grid=DayUpCore.monthGrid(selectedDate),month=selectedDate.slice(0,7),fitness=kind==='fitness';
 for(const date of grid)DayUpCore.ensureOccurrence(state,date);
 return `<section class="card month-card"><div class="section-heading"><div><h2>${fitness?'训练日历':'饮食日历'}</h2><p>点击日期，查看和记录当天的${fitness?'训练':'饮食'}</p></div><div class="calendar-navigation"><button class="secondary-button" aria-label="上个月" data-action="calendar-month" data-delta="-1">‹</button><strong>${month.replace('-',' 年 ')} 月</strong><button class="secondary-button" aria-label="下个月" data-action="calendar-month" data-delta="1">›</button><button class="secondary-button" data-action="go-today">今天</button></div></div><div class="calendar-grid" role="group" aria-label="${fitness?'训练':'饮食'}月历"><div class="weekday">一</div><div class="weekday">二</div><div class="weekday">三</div><div class="weekday">四</div><div class="weekday">五</div><div class="weekday">六</div><div class="weekday">日</div>${grid.map(date=>{
  const workouts=state.workouts.filter(w=>w.date===date),meals=state.meals.filter(m=>m.date===date&&m.name!=='饮水'),water=state.meals.filter(m=>m.date===date).reduce((s,m)=>s+Number(m.water||0),0),planned=state.plans.filter(p=>p.date===date&&p.module==='健身计划'&&!['done','cancelled'].includes(p.status));
  const parts=[...new Set(workouts.flatMap(w=>(w.exercises||[]).map(e=>e.bodyPart)))];
  const sets=workouts.reduce((s,w)=>s+(w.exercises||[]).reduce((sum,e)=>sum+Number(e.sets||0),0),0);
  const actions=workouts.flatMap(w=>(w.exercises||[]).map(e=>`${e.name} ${e.sets}组`)).join(' / ');
  const lines=fitness?[...(workouts.length?[parts.join(' / ')||workouts.map(w=>w.type||'训练').join(' / '),...(actions?[actions]:[]),sets?`${sets} 组 · ${workouts.length} 次训练`:`${workouts.length} 次记录`]:[]),...(planned.length?[`待训练 ${planned.length} 项`]:[])]:[...(meals.length?[`${meals.length} 餐 · ${meals.reduce((s,m)=>s+Number(m.calories||0),0)} kcal`,meals.map(m=>m.foods).join('、')]:[]),...(water?[`饮水 ${water} ml`]:[])];
  const label=`${date} ${lines.join('，')||'暂无记录'}`;
  return `<button class="calendar-day ${date.startsWith(month)?'':'outside-month'} ${date===selectedDate?'selected':''} ${date===today()?'is-today':''}" data-action="calendar-date" data-date="${date}" aria-label="${esc(label)}" aria-pressed="${date===selectedDate}" title="${esc(label)}"><span class="day-number">${Number(date.slice(-2))}${date===today()?'<i>今</i>':''}</span>${lines.map((text,index)=>`<span class="calendar-summary ${index===0?'primary':''}">${esc(text)}</span>`).join('')}</button>`;
 }).join('')}</div></section>`;
}
function exerciseSummary(exercises){return exercises.map(e=>`${e.bodyPart} · ${e.name} ${e.sets} 组 × ${e.reps} 次`).join('；');}
function workoutCard(w){
 return `<article class="workout-detail"><div class="section-heading"><strong>${esc(w.type||'训练')} · ${Number(w.duration)||0} 分钟</strong><div class="row-actions"><button class="link-button" data-action="edit-workout" data-id="${w.id}">编辑</button><button class="link-button danger-text" data-action="delete-workout" data-id="${w.id}">删除</button></div></div>${w.exercises?.length?`<div class="exercise-records">${w.exercises.map(e=>`<div><strong>${esc(e.bodyPart)} · ${esc(e.name)}</strong><span>${e.sets} 组 × ${e.reps} 次${e.weight!==''&&e.weight!=null?` · ${esc(e.weight)} kg`:''}</span></div>`).join('')}</div>`:''}${w.detail&&w.detail!==exerciseSummary(w.exercises||[])?`<p class="preserve-lines">${esc(w.detail)}</p>`:''}${w.notes?`<p class="subtle preserve-lines">${esc(w.notes)}</p>`:''}</article>`;
}
function renderFitnessCalendar(){
 const records=state.workouts.filter(w=>w.date===selectedDate),plans=dayPlans(selectedDate).filter(p=>p.module==='健身计划');
 return `<div class="page-toolbar"><span class="subtle">按天记录身体的进展 · 当前 ${selectedDate}</span><div class="toolbar-group"><button class="secondary-button" data-action="schedule-fitness">安排训练</button><button class="primary-button" data-action="new-workout">＋ 记录训练</button></div></div>${renderMonthCalendar('fitness')}<div class="two-col section-gap"><section class="card"><div class="section-heading"><h2>${formatDate(selectedDate,{month:'long',day:'numeric'})} 的训练</h2><span class="pill green">${records.reduce((s,w)=>s+Number(w.duration||0),0)} 分钟</span></div>${records.map(workoutCard).join('')||empty('这一天还没有训练记录','可记录多个动作的部位、组数、次数和重量，也可以记录休息日。')}${plans.length?`<h3 class="small-heading">当天训练计划</h3>${plans.map(p=>planRow(p,{compact:true})).join('')}`:''}</section><section class="card"><div class="section-heading"><h2>训练目标</h2><button class="link-button" data-action="new-fitness-plan">设置目标 →</button></div>${state.fitnessPlans.map(plan=>`<div class="detail-card"><div class="mini-metric"><strong>${esc(plan.name)}</strong><span>${esc(plan.frequency||'灵活安排')}</span></div><div class="progress"><i style="width:${Math.min(100,Number(plan.progress)||0)}%"></i></div><p class="subtle">${esc(plan.target||'')} · ${Number(plan.progress)||0}%</p><div class="row-actions"><button class="link-button" data-action="edit-fitness-plan" data-id="${plan.id}">编辑</button><button class="link-button danger-text" data-action="delete-fitness-plan" data-id="${plan.id}">删除</button></div></div>`).join('')||empty('还没有训练目标','先定义一个愿意坚持的方向。')}</section></div>`;
}
function exerciseEditor(exercise={}){
 const key=uid('exercise');
 return `<fieldset class="exercise-editor" data-exercise-row><legend>训练动作</legend><div class="form-grid"><label>训练部位<input class="form-control" data-exercise="bodyPart" autocomplete="off" name="${key}_bodyPart" placeholder="如：胸 / 背 / 腿" value="${esc(exercise.bodyPart||'')}" required></label><label>动作名称<input class="form-control" data-exercise="name" autocomplete="off" name="${key}_name" placeholder="如：杠铃卧推" value="${esc(exercise.name||'')}" required></label><label>组数<input class="form-control" data-exercise="sets" type="number" min="1" step="1" value="${esc(exercise.sets??3)}" required></label><label>每组次数<input class="form-control" data-exercise="reps" type="number" min="1" step="1" value="${esc(exercise.reps??10)}" required></label><label>重量（kg，可选）<input class="form-control" data-exercise="weight" type="number" min="0" step="0.1" value="${esc(exercise.weight??'')}"></label><button type="button" class="link-button danger-text" data-action="remove-exercise">移除这个动作</button></div></fieldset>`;
}
async function handleCalendarAction(action,element){
 if(action==='calendar-month'){selectedDate=DayUpCore.addMonths(selectedDate,Number(element.dataset.delta));render();return true;}
 if(action==='calendar-date'){if(DayUpCore.validDate(element.dataset.date)){selectedDate=element.dataset.date;render();}return true;}
 if(action==='add-exercise'){document.querySelector('#exercise-list').insertAdjacentHTML('beforeend',exerciseEditor());return true;}
 if(action==='remove-exercise'){element.closest('[data-exercise-row]')?.remove();return true;}
 if(action==='edit-workout'){const workout=state.workouts.find(w=>w.id===element.dataset.id);if(workout)openWorkout(workout);return true;}
 if(action==='delete-workout'){if(await confirmAction('确定删除这次训练记录吗？')){state.workouts=state.workouts.filter(w=>w.id!==element.dataset.id);await save();render();}return true;}
 return false;
}
