const test=require('node:test'),assert=require('node:assert/strict'),C=require('../dist/core.js'),L=require('../dist/learning-core.js'),{createApp}=require('./app-harness.cjs');
async function subjectApp(){const a=await createApp();await a.submit('learnsubject',{name:'Python 基础',status:'进行中',goal:'独立写出小工具'});return a;}
test('旧备份迁移增加空学习空间，原模块数据不变，损坏学习数据拒绝恢复',()=>{
 const old=require('./fixtures/sample-backup.json'),before=JSON.stringify(old),m=C.validateBackup(old);assert.deepEqual(m.learning,L.empty());assert.equal(JSON.stringify(old),before);assert.deepEqual(m.plans[0].title,old.plans[0].title);assert.throws(()=>C.validateBackup({...old,learning:{subjects:'bad',sessions:[],notes:[]}}),/科目/);
});
test('科目新增、修改和归档保持章节及旧模块记录隔离，刷新可读取',async()=>{
 const a=await subjectApp(),id=a.snapshot().learning.subjects[0].id;await a.submit('learnunit',{subjectId:id,title:'变量与类型'});await a.submit('learnsubject',{id,name:'Python 进阶',status:'归档'});const s=a.snapshot().learning.subjects[0];assert.equal(s.name,'Python 进阶');assert.equal(s.units.length,1);assert.equal(s.status,'归档');const reopened=await createApp(C.validateBackup(a.snapshot()));assert.deepEqual(reopened.snapshot().learning,a.snapshot().learning);assert.equal(a.snapshot().projects.length,0);await assert.rejects(a.submit('learnsubject',{name:'',status:'进行中'}),/科目/);
});
test('章节完成驱动进度，不以计划完成或科目状态冒充实际学习',async()=>{
 const a=await subjectApp(),s=a.snapshot().learning.subjects[0];await a.submit('learnunit',{subjectId:s.id,title:'变量'});await a.submit('learnunit',{subjectId:s.id,title:'循环'});const id=a.snapshot().learning.subjects[0].units[0].id;await a.click('learn-toggle-unit',id);let st=L.stats(a.snapshot().learning,s.id,C.localDate());assert.equal(st.progress,50);assert.equal(st.minutes,0);await a.click('learn-toggle-unit',id);assert.equal(L.stats(a.snapshot().learning,s.id,C.localDate()).progress,0);
});
test('学习时长按日期和科目统计，可编辑修正，拒绝未来日期和非法时长',async()=>{
 const a=await subjectApp(),subjectId=a.snapshot().learning.subjects[0].id,date=C.localDate();await a.submit('learnsession',{subjectId,date,duration:'45',content:'练习列表'});const r=a.snapshot().learning.sessions[0];await a.submit('learnsession',{...r,duration:'60'});const stats=L.stats(a.snapshot().learning,subjectId,date);assert.equal(stats.today,60);assert.equal(stats.week,60);assert.equal(stats.days.length,7);assert.equal(a.snapshot().learning.sessions.length,1);
 const before=a.snapshot();for(const patch of [{duration:0},{duration:-1},{duration:1.5},{date:C.addDays(date,1)},{subjectId:'missing'}])await assert.rejects(a.submit('learnsession',{subjectId,date,duration:20,...patch}));assert.deepEqual(a.snapshot(),before);
});
test('科目可安排到今日计划，首页与关联选择同步显示，备份完整',async()=>{
 const a=await subjectApp(),s=a.snapshot().learning.subjects[0];await a.click('learn-schedule',s.id);assert.match(a.nodes.get('#modal-root').innerHTML,/学习 · Python 基础/);assert.match(a.nodes.get('#modal-root').innerHTML,/学习空间/);await a.submit('plan',{title:'学习 Python',module:'学习空间',linkedId:s.id,date:C.localDate(),time:'全天',priority:'普通',status:'待处理',recurrence:'不重复',reminder:'不提醒'});assert.match(a.exec('renderOverview()'),/学习空间/);assert.match(a.exec("linkedSelect('学习空间')"),/Python 基础/);const restored=C.validateBackup(a.snapshot());assert.equal(restored.plans[0].linkedId,restored.learning.subjects[0].id);
});
test('章节和学习记录按所属科目隔离，外来编号不能误改另一科目',async()=>{
 const a=await subjectApp(),id=a.snapshot().learning.subjects[0].id;await a.submit('learnunit',{subjectId:id,title:'函数'});await a.submit('learnsubject',{name:'Java',status:'进行中'});const second=a.snapshot().learning.subjects[1];await assert.rejects(a.submit('learnunit',{subjectId:second.id,id:a.snapshot().learning.subjects[0].units[0].id,title:'误修改'}),/不存在/);assert.equal(a.snapshot().learning.subjects[0].units[0].title,'函数');
});
