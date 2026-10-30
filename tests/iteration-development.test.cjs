const test=require('node:test'),assert=require('node:assert/strict'),{createApp}=require('./app-harness.cjs'),C=require('../dist/core.js');
async function projectApp(){const app=await createApp();await app.submit('project',{name:'个人工具',status:'进行中'});return app;}
const item=(projectId,kind='task',extra={})=>({projectId,kind,title:'完成一个模块',status:'待处理',priority:'高',dueDate:'2026-12-01',acceptance:'验收可通过',...extra});
test('项目内任务、问题、里程碑分别保存，可编辑删除且项目互相隔离',async()=>{
 const app=await projectApp(),id=app.snapshot().projects[0].id;
 for(const kind of ['task','issue','milestone'])await app.submit('devitem',item(id,kind));
 await app.submit('project',{name:'第二项目'});const second=app.snapshot().projects[1];assert.equal(second.items,undefined);
 let p=app.snapshot().projects[0];assert.equal(p.items.length,3);
 await app.submit('devitem',{...p.items[0],projectId:id,title:'修改任务',status:'进行中'});p=app.snapshot().projects[0];assert.equal(p.items.length,3);assert.equal(p.items[0].title,'修改任务');
 app.context.p=p;const html=app.exec('renderProjectDetail(p)');for(const text of ['任务看板','修改任务','问题记录','里程碑','验收'])assert.ok(html.includes(text),text);
 const before=app.snapshot();await assert.rejects(app.submit('devitem',item('missing')),/有效项目/);assert.deepEqual(app.snapshot(),before);
 app.exec('confirmAction=async()=>true');
 for(const handler of app.events.click)await handler({target:{closest:()=>({dataset:{action:'delete-devitem',projectId:id,id:p.items[1].id},classList:{contains:()=>false}})},preventDefault(){},stopPropagation(){}});
 assert.equal(app.snapshot().projects[0].items.length,2);assert.equal(app.snapshot().projects[1].items,undefined);
});
test('项目任务安排到计划后双向同步状态，再次安排复用已有计划',async()=>{
 const app=await projectApp(),id=app.snapshot().projects[0].id;await app.submit('devitem',item(id));const i=app.snapshot().projects[0].items[0];
 await app.submit('plan',{title:i.title,date:C.localDate(),time:'10:00',module:'开发工作',linkedId:id,devItemId:i.id,priority:'高',status:'待处理',recurrence:'不重复',reminder:'不提醒',isTop:'否'});
 const plan=app.snapshot().plans[0];await app.click('toggle-plan',plan.id);assert.equal(app.snapshot().projects[0].items[0].status,'已完成');
 await app.submit('devitem',{...i,projectId:id,status:'进行中'});assert.equal(app.snapshot().plans[0].status,'doing');
 app.context.el={dataset:{projectId:id,id:i.id}};await app.exec("handleWorkspaceAction('schedule-devitem',el)");assert.ok(app.nodes.get('#modal-root').innerHTML.includes(plan.id));assert.equal(app.snapshot().plans.length,1);
});
test('开发日志可编辑且不生成副本，项目详情计算任务进度、耗时并完整备份',async()=>{
 const app=await projectApp(),id=app.snapshot().projects[0].id;await app.submit('devitem',item(id,'task',{status:'已完成',acceptance:'按钮可正常点击'}));await app.submit('devitem',item(id));
 await app.submit('devlog',{date:'2026-10-28',projectId:id,duration:'30',content:'第一步'});const log=app.snapshot().devLogs[0];
 await app.submit('devlog',{...log,duration:'50',content:'完成修复'});assert.equal(app.snapshot().devLogs.length,1);
 assert.equal(app.exec('projectProgress(state.projects[0])'),50);assert.ok(app.exec('renderProjectDetail(state.projects[0])').includes('完成修复'));
 const backup=C.validateBackup(app.snapshot()),reopened=await createApp(backup);assert.deepEqual(reopened.snapshot().projects,backup.projects);
 const invalid=JSON.parse(JSON.stringify(backup));invalid.projects[0].items[0].dueDate='2026-02-30';assert.throws(()=>C.validateBackup(invalid),/截止日期/);
 const legacy=C.baseState();legacy.projects.push({id:'old',name:'老项目'});assert.equal(C.validateBackup(legacy).projects[0].name,'老项目');
});
