const test=require('node:test'),assert=require('node:assert/strict'),{createApp}=require('./app-harness.cjs');
const C=require('../dist/core.js');
test('最终完整工作流：各模块记录、首页摘要、备份、重启加载一致',async()=>{
 const app=await createApp();
 await app.submit('project',{name:'DayUp',status:'进行中',nextAction:'验收'});const project=app.snapshot().projects[0];
 await app.submit('plan',{title:'最终验收',date:C.localDate(),time:'10:00',module:'开发工作',linkedId:project.id,priority:'高',status:'待处理',recurrence:'不重复',reminder:'15',isTop:'是'});
 await app.submit('client',{name:'个人客户',topic:'需求',status:'跟进中',nextFollowup:C.localDate()});
 await app.submit('fitnessplan',{name:'规律运动',frequency:'每周三次',progress:'30'});
 await app.submit('workout',{date:C.localDate(),type:'力量训练',duration:'40',detail:'训练完成'});
 await app.submit('meal',{date:C.localDate(),name:'早餐',foods:'鸡蛋',calories:'200',protein:'20'});
 await app.submit('water',{date:C.localDate(),water:'500'});
 await app.submit('game',{name:'休闲游戏',status:'在玩',progress:'15'});
 const html=app.exec('renderOverview()');for(const text of ['最终验收','验收','1 位客户','今天已完成训练','饮水 500ml','休闲游戏'])assert.ok(html.includes(text),text);
 app.exec('exportData()');const backup=JSON.parse(await app.downloads[0].blob.text());
 const restarted=await createApp(backup);for(const key of C.collections)assert.deepEqual(restarted.snapshot()[key],app.snapshot()[key]);
});
test('重复系列修改“本次及以后”保留过去，未来使用新时间',async()=>{
 const app=await createApp();await app.submit('plan',{title:'每周例会',date:'2026-01-01',time:'09:00',module:'个人',status:'待处理',recurrence:'每周',reminder:'不提醒',isTop:'否'});
 const p=app.snapshot().plans.find(p=>p.date==='2026-01-08');
 await app.submit('plan',{...p,time:'10:00',status:'待处理',isTop:'否',editScope:'本次及以后'});
 app.exec("dayPlans('2026-01-15')");const rows=app.snapshot().plans;
 assert.equal(rows.find(p=>p.date==='2026-01-01').time,'09:00');
 assert.equal(rows.filter(p=>p.date==='2026-01-15').length,1);
 assert.equal(rows.find(p=>p.date==='2026-01-15').time,'10:00');
});
test('实际提醒调用通知接口，保存去重键后重启不会重复发送',async()=>{
 const app=await createApp();const notifications=[];
 app.context.Notification=class{static permission='granted';constructor(title,options){notifications.push({title,...options})}};
 app.context.window.Notification=app.context.Notification;
 const now=new Date(),date=C.localDate(now),time=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
 app.context.reminderPlan={id:'notice1',title:'测试提醒',date,time,status:'todo',reminder:'0'};
 app.exec('state.plans.push(reminderPlan)');await app.exec('checkReminders()');await app.exec('checkReminders()');
 assert.equal(notifications.length,1);assert.equal(notifications[0].body,'测试提醒');assert.equal(app.snapshot().notified.length,1);
 const restarted=await createApp(app.snapshot());restarted.context.Notification=app.context.Notification;restarted.context.window.Notification=app.context.Notification;
 await restarted.exec('checkReminders()');assert.equal(notifications.length,1);
});
