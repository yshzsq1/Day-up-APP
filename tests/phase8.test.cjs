const test=require('node:test'),assert=require('node:assert/strict'),{createApp}=require('./app-harness.cjs');
const C=require('../dist/core.js');
test('实际导出生成有日期的 JSON 文件，内容能恢复全部模块',async()=>{
 const app=await createApp();await app.submit('project',{name:'工程',status:'进行中'});
 await app.submit('client',{name:'客户',status:'跟进中'});
 await app.submit('meal',{date:'2026-10-28',name:'午餐',foods:'蔬菜',calories:'100'});
 app.exec('exportData()');assert.equal(app.downloads.length,1);
 assert.match(app.downloads[0].name,/^dayup-backup-\d{4}-\d{2}-\d{2}\.json$/);
 const backup=JSON.parse(await app.downloads[0].blob.text());C.validateBackup(backup);
 app.context.raw=JSON.stringify(backup);app.exec('state=defaultState()');await app.exec('restoreBackup(raw,false)');
 const restored=app.snapshot();delete restored.savedAt;delete backup.savedAt;assert.deepEqual(restored,backup);
});
test('保存失败时实际页面回滚到上次保存状态，并显示错误',async()=>{
 const app=await createApp();await app.submit('game',{name:'保留游戏',status:'想玩'});const previous=app.snapshot();
 app.exec("persistence.primary={get:()=>null,put:()=>{throw Error('quota')}};persistence.secondary=null");
 await assert.rejects(app.submit('game',{name:'无法保存',status:'想玩'}));assert.deepEqual(app.snapshot(),previous);
 assert.ok(app.nodes.get('#app').innerHTML.includes('保存失败'));
});
test('清空必须确认，取消保持数据，确认清空后可恢复',async()=>{
 const app=await createApp();await app.submit('project',{name:'恢复对象',status:'进行中'});const backup=app.snapshot();
 app.exec('confirmAction=async()=>false');await app.click('clear-data');assert.equal(app.snapshot().projects.length,1);
 app.exec('confirmAction=async()=>true');await app.click('clear-data');assert.equal(app.snapshot().projects.length,0);
 app.context.raw=JSON.stringify(backup);await app.exec('restoreBackup(raw,false)');assert.equal(app.snapshot().projects[0].name,'恢复对象');
});
