const test=require('node:test'),assert=require('node:assert/strict'),{createApp}=require('./app-harness.cjs'),C=require('../dist/core.js');
test('月历以周一开始，闰年、跨年、月末和无记录月份均正确',()=>{
 const leap=C.monthGrid('2024-02-29');assert.ok(leap.includes('2024-02-29'));assert.equal(new Date(leap[0]+'T12:00:00').getDay(),1);assert.equal(leap.length%7,0);
 assert.ok(C.monthGrid('2026-12-31').includes('2027-01-01'));assert.ok(C.monthGrid('2026-02-28').includes('2026-03-01'));
 assert.throws(()=>C.monthGrid('2026-02-30'));
});
test('训练动作、部位、组数、次数和重量保存编辑后进入当天日历，旧记录仍显示',async()=>{
 const app=await createApp();app.exec("selectedDate='2026-10-28'");
 const exercises=[{bodyPart:'胸',name:'卧推',sets:4,reps:10,weight:30},{bodyPart:'背',name:'划船',sets:3,reps:12,weight:20}];
 await app.submit('workout',{date:'2026-10-28',type:'力量训练',duration:50,detail:'训练完成',exercises});
 let w=app.snapshot().workouts[0];assert.deepEqual(w.exercises,exercises);
 let html=app.exec('renderFitness()');for(const text of ['训练日历','胸 / 背','7 组','卧推','4 组 × 10 次','30 kg'])assert.ok(html.includes(text),text);
 await app.submit('workout',{...w,exercises:[{...exercises[0],sets:5}]});assert.equal(app.snapshot().workouts.length,1);assert.ok(app.exec('renderFitness()').includes('5 组'));
 await app.submit('workout',{date:'2026-10-27',type:'有氧训练',duration:20,detail:'跑步'});app.exec("selectedDate='2026-10-27'");assert.ok(app.exec('renderFitness()').includes('跑步'));
 const restored=C.validateBackup(app.snapshot());assert.equal(restored.workouts[0].exercises[0].sets,5);
 const bad=JSON.parse(JSON.stringify(restored));bad.workouts[0].exercises[0].sets=-1;assert.throws(()=>C.validateBackup(bad),/正整数/);
});
test('训练表单提取多个动作并生成说明，无动作休息日也能保存',async()=>{
 const app=await createApp();const fields=[{bodyPart:'腿',name:'深蹲',sets:'3',reps:'12',weight:'20'},{bodyPart:'腹',name:'卷腹',sets:'2',reps:'15',weight:''}];
 app.context.workoutForm={dataset:{form:'workout'},values:{date:'2026-10-28',type:'力量训练',detail:''},querySelectorAll:()=>fields.map(ex=>({querySelectorAll:()=>Object.entries(ex).map(([exercise,value])=>({dataset:{exercise},value}))}))};
 await app.exec('handleForm(workoutForm)');assert.equal(app.snapshot().workouts[0].exercises.length,2);assert.ok(app.snapshot().workouts[0].detail.includes('深蹲 3 组'));
 app.exec('openWorkout(state.workouts[0])');assert.match(app.nodes.get('#modal-root').innerHTML,/id="field-detail"[^>]*><\/textarea>/);
 app.context.workoutForm={dataset:{form:'workout'},values:{date:'2026-10-29',type:'休息日',detail:''},querySelectorAll:()=>[]};await app.exec('handleForm(workoutForm)');assert.equal(app.snapshot().workouts[1].detail,'休息恢复');
 const before=app.snapshot();await assert.rejects(app.submit('workout',{date:'2026-10-30',detail:'不合法',exercises:[{name:'卧推',bodyPart:'胸',sets:1.5,reps:10}]}),/正整数/);assert.deepEqual(app.snapshot(),before);
});
test('饮食日历按所选日期展示餐次、热量和饮水，切月不改历史数据',async()=>{
 const app=await createApp();app.exec("selectedDate='2026-10-28'");
 await app.submit('meal',{date:'2026-10-28',name:'午餐',foods:'鸡肉米饭',calories:500,protein:35});await app.submit('water',{date:'2026-10-28',water:600});
 await app.submit('meal',{date:'2026-10-29',name:'晚餐',foods:'蔬菜鸡蛋',calories:300});
 let html=app.exec('renderDiet()');for(const text of ['饮食日历','1 餐 · 500 kcal','饮水 600 ml','鸡肉米饭'])assert.ok(html.includes(text),text);
 const before=app.snapshot();app.context.el={dataset:{delta:'1'}};await app.exec("handleCalendarAction('calendar-month',el)");assert.equal(app.exec('selectedDate'),'2026-11-28');assert.deepEqual(app.snapshot(),before);
 app.context.el={dataset:{date:'2026-10-29'}};await app.exec("handleCalendarAction('calendar-date',el)");html=app.exec('renderDiet()');assert.ok(html.includes('10月29日 的餐食'));assert.ok(html.includes('蔬菜鸡蛋'));
});
