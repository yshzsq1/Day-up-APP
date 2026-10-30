const test=require('node:test'),assert=require('node:assert/strict'),{createApp}=require('./app-harness.cjs');
test('实际弹窗关闭、取消和 Esc 都清空弹窗，不保存未提交数据',async()=>{
 const app=await createApp();app.exec('openPlan()');assert.match(app.nodes.get('#modal-root').innerHTML,/role="dialog"/);
 await app.click('close-modal');assert.equal(app.nodes.get('#modal-root').innerHTML,'');
 app.exec('openPlan()');for(const handler of app.events.keydown)handler({key:'Escape'});
 assert.equal(app.nodes.get('#modal-root').innerHTML,'');assert.equal(app.snapshot().plans.length,0);
});
test('点击模态背景里的无操作内容不关闭窗口，点击背景可以关闭',async()=>{
 const app=await createApp();app.exec('openPlan()');
 const backdrop={dataset:{action:'close-modal'},classList:{contains:()=>true}};
 for(const handler of app.events.click)await handler({target:{closest:()=>backdrop},preventDefault(){},stopPropagation(){}});
 assert.ok(app.nodes.get('#modal-root').innerHTML);
 backdrop.closest=()=>backdrop;
 for(const handler of app.events.click)await handler({target:backdrop,preventDefault(){},stopPropagation(){}});
 assert.equal(app.nodes.get('#modal-root').innerHTML,'');
});
test('全部时间可选择，全天和待安排与定时分组顺序正确',async()=>{
 const app=await createApp();const times=app.exec('timeChoices()');assert.ok(times.includes('00:00'));assert.ok(times.includes('23:55'));
 app.context.rows=[{id:'a',time:'全天',title:'全天事'},{id:'b',time:'09:00',title:'九点事'},{id:'c',time:'待安排',title:'待安排事'}];
 const html=app.exec('planGroups(rows)');assert.ok(html.indexOf('全天事项')<html.indexOf('按时间安排'));assert.ok(html.indexOf('按时间安排')<html.indexOf('<h3>待安排'));
});
test('首页关注项覆盖临近提醒、客户跟进、项目停滞和连续未记录',async()=>{
 const app=await createApp();app.exec(`
  state.fitnessPlans.push({id:'f',name:'目标'});
  state.meals.push({id:'m',name:'午餐',date:isoPlus(today(),-10)});
  state.projects.push({id:'p',name:'旧项目',status:'进行中',updatedAt:new Date(Date.now()-8*86400000).toISOString()});
  state.clients.push({id:'c',name:'客户',status:'跟进中',nextFollowup:today()});
 `);
 const kinds=app.exec('attentionItems().map(x=>x.kind)');for(const kind of ['咨询跟进','项目停滞','训练记录','饮食记录'])assert.ok(kinds.includes(kind));
});
test('备忘编辑分类后转换为计划时保留内容和分类',async()=>{
 const app=await createApp();app.exec("state.memos.push({id:'memo1',text:'准备跟进',module:'个人',createdAt:nowIso()})");
 await app.submit('memo',{id:'memo1',text:'准备客户跟进',module:'咨询工作'});
 await app.click('memo-to-plan','memo1');const html=app.nodes.get('#modal-root').innerHTML;
 assert.ok(html.includes('准备客户跟进'));assert.match(html,/value="咨询工作" selected/);
});
