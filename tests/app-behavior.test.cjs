const test=require('node:test'),assert=require('node:assert/strict'),{createApp}=require('./app-harness.cjs');
const C=require('../dist/core.js');
const plan=(overrides={})=>({title:'计划',date:'2026-10-28',time:'09:30',module:'个人',status:'待处理',priority:'普通',recurrence:'不重复',reminder:'不提醒',isTop:'否',...overrides});
test('实际表单创建和刷新加载保留计划，编辑不产生副本',async()=>{
 const app=await createApp();await app.submit('plan',plan());let p=app.snapshot().plans[0];
 await app.submit('plan',plan({id:p.id,title:'更新'}));assert.equal(app.snapshot().plans.length,1);
 const reload=await createApp(JSON.parse(app.memory.get('dayup-local-v1')));assert.equal(reload.snapshot().plans[0].title,'更新');
});
test('实际表单严格限制三件重点，第四件失败且已有记录不变',async()=>{
 const app=await createApp();for(let i=0;i<3;i++)await app.submit('plan',plan({title:`重点${i}`,isTop:'是'}));
 const before=app.snapshot();await assert.rejects(app.submit('plan',plan({title:'第四件',isTop:'是'})),/三件重点/);
 assert.deepEqual(app.snapshot(),before);
});
test('实际表单单次完成不影响每月系列，年底以后继续生成',async()=>{
 const app=await createApp();await app.submit('plan',plan({date:'2026-01-31',recurrence:'每月'}));
 const original=app.snapshot().plans[0];await app.click('toggle-plan',original.id);
 const feb=app.snapshot().plans.find(p=>p.date==='2026-02-28');assert.equal(feb.status,'todo');
 app.exec("dayPlans('2030-03-31')");assert.ok(app.snapshot().plans.find(p=>p.date==='2030-03-31'));
});
test('保存后的单次删除和取消不会重新生成',async()=>{
 const app=await createApp();await app.submit('plan',plan({recurrence:'每天'}));
 const p=app.snapshot().plans[0];app.exec(`DayUpCore.deleteOccurrence(state,${JSON.stringify(p.id)})`);
 app.exec("dayPlans('2026-10-28')");assert.equal(app.snapshot().plans.filter(p=>p.date==='2026-10-28').length,0);
 const sibling=app.snapshot().plans.find(p=>p.date==='2026-10-29');await app.click('cancel-plan',sibling.id);
 app.exec("dayPlans('2026-10-29')");assert.equal(app.snapshot().plans.find(p=>p.id===sibling.id).status,'cancelled');
});
test('开发项目更新和日志通过 ID 关联，首页读取同一记录',async()=>{
 const app=await createApp();await app.submit('project',{name:'原项目',status:'进行中',nextAction:'写代码'});
 const p=app.snapshot().projects[0];await app.submit('devlog',{date:'2026-10-28',projectId:p.id,content:'完成模块',duration:'40',blockers:'无'});
 await app.submit('project',{id:p.id,name:'新名称',status:'进行中',nextAction:'验收'});
 const html=app.exec('renderDevelopment()');assert.ok(html.includes('新名称'));assert.equal(app.snapshot().devLogs[0].projectId,p.id);
});
test('咨询已结束后不会继续出现在待跟进区域',async()=>{
 const app=await createApp();await app.submit('client',{name:'客户',status:'跟进中',topic:'需求',nextFollowup:'2020-01-01'});
 const c=app.snapshot().clients[0];assert.ok(app.exec("attentionItems().some(x=>x.kind==='咨询跟进')"));
 await app.submit('client',{...c,status:'已结束'});assert.equal(app.exec("attentionItems().some(x=>x.kind==='咨询跟进')"),false);
});
test('生活三模块保存不同的数据，饮水不计入餐数',async()=>{
 const app=await createApp();await app.submit('fitnessplan',{name:'力量',frequency:'每周三次',progress:'20'});
 await app.submit('workout',{date:'2026-10-28',type:'力量训练',duration:'30',detail:'深蹲'});
 await app.submit('meal',{date:'2026-10-28',name:'午餐',foods:'米饭',calories:'500',protein:'20'});
 await app.submit('water',{date:'2026-10-28',water:'300'});
 await app.submit('game',{name:'游戏',status:'在玩',progress:'10',platform:'PC'});
 const g=app.snapshot().games[0];await app.submit('session',{gameId:g.id,date:'2026-10-28',duration:'40',progress:'20',note:'第一关'});
 const data=app.snapshot();assert.equal(data.workouts.length,1);assert.equal(data.meals.filter(m=>m.name!=='饮水').length,1);assert.equal(data.games[0].progress,'20');assert.equal(data.gameSessions.length,1);
});
test('实际恢复函数：所有模块完整往返，错误备份和取消导入均不改变原数据',async()=>{
 const app=await createApp();await app.submit('plan',plan());const before=app.snapshot();
 await assert.rejects(app.exec("restoreBackup('{broken',false)"));assert.deepEqual(app.snapshot(),before);
 app.context.rawBackup=JSON.stringify({...before,projects:{}});await assert.rejects(app.exec('restoreBackup(rawBackup,false)'));assert.deepEqual(app.snapshot(),before);
 app.context.rawBackup=JSON.stringify(C.baseState());app.exec('confirmAction=async()=>false');assert.equal(await app.exec('restoreBackup(rawBackup,true)'),false);assert.deepEqual(app.snapshot(),before);
 app.context.rawBackup=JSON.stringify(before);assert.equal(await app.exec('restoreBackup(rawBackup,false)'),true);assert.equal(app.snapshot().plans[0].title,before.plans[0].title);
});
test('提醒引擎跨午夜、禁用、取消和完成过滤及去重',()=>{
 const state=C.baseState(),now=new Date('2026-10-27T23:55:00');
 state.plans.push({id:'p',date:'2026-10-28',time:'00:10',reminder:'15',status:'todo'});
 assert.equal(C.dueReminders(state,now).length,1);
 state.plans[0].status='done';assert.equal(C.dueReminders(state,now).length,0);
 state.plans[0].status='todo';state.notified.push(`p:${now.getTime()}`);assert.equal(C.dueReminders(state,now).length,0);
 state.notified=[];state.settings.reminders=false;assert.equal(C.dueReminders(state,now).length,0);
});
