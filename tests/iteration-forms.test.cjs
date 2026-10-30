const test=require('node:test'),assert=require('node:assert/strict'),{createApp}=require('./app-harness.cjs');

test('不同模块与每次打开均隔离字段历史，新增不带出游戏内容',async()=>{
 const app=await createApp();await app.submit('game',{name:'三角洲行动',status:'在玩'});
 app.exec('openGame()');const game=app.nodes.get('#modal-root').innerHTML;
 app.exec('openProject()');const project=app.nodes.get('#modal-root').innerHTML;
 app.exec('openProject()');const reopened=app.nodes.get('#modal-root').innerHTML;
 assert.ok(!project.includes('三角洲行动'));
 assert.match(project,/autocomplete="off"/);
 const field=html=>html.match(/name="([^"]+)" data-field="name"/)[1];
 assert.notEqual(field(game),field(project));assert.notEqual(field(project),field(reopened));
});
test('隔离后的字段能正确提交和编辑，日期为完整文本加日历入口',async()=>{
 const app=await createApp();await app.submit('project',{'project__form_1__name':'测试项目','project__form_1__startDate':'2026-10-01','project__form_1__endDate':'2026-12-31'});
 const p=app.snapshot().projects[0];assert.equal(p.name,'测试项目');assert.equal(p.endDate,'2026-12-31');
 app.context.project=p;app.exec('openProject(project)');const html=app.nodes.get('#modal-root').innerHTML;
 assert.match(html,/id="field-endDate"[^>]*type="text"/);assert.match(html,/data-action="pick-date"/);assert.match(html,/value="2026-12-31"/);
 await assert.rejects(app.submit('project',{name:'错误日期',endDate:'2026-02-30'}),/有效日期/);
 assert.equal(app.snapshot().projects.length,1);
});
