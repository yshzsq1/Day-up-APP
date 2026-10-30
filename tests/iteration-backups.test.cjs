const test=require('node:test'),assert=require('node:assert/strict');
const {createClient}=require('../dist/backup.js'),{createApp}=require('./app-harness.cjs');
test('备份客户端执行文件夹列表、保存、读取、打开和选中删除，并向页面报告错误',async()=>{
 const calls=[];const client=createClient(async(path,options)=>{calls.push({path,options});return {ok:true,json:async()=>({files:[],name:'test.json'})}});
 await client.create({plans:[]});await client.list();await client.read('a b.json');await client.open();await client.remove(['test.json']);
 assert.equal(calls[0].path,'/api/backups');assert.equal(JSON.parse(calls[0].options.body).data.plans.length,0);
 assert.equal(calls[0].options.headers['X-DayUp-Request'],'1');assert.equal(calls[2].path,'/api/backups/a%20b.json');
 assert.deepEqual(JSON.parse(calls[4].options.body),{names:['test.json']});
 await assert.rejects(createClient(async()=>({ok:false,status:400,json:async()=>({error:'写入失败'})})).create({}),/写入失败/);
});
test('文件夹导入先校验后覆盖，错误备份不影响现有项目',async()=>{
 const app=await createApp();await app.submit('project',{name:'保留项目'});const before=app.snapshot();
 app.context.DayUpBackups={};
 await assert.rejects(app.exec("restoreBackup('{\"version\":1}',false)"));assert.deepEqual(app.snapshot(),before);
 const html=app.exec('renderSettings()');for(const action of ['view-backups','delete-backups','import-data'])assert.ok(html.includes(action));
});
test('真实备份表单：保存到文件夹，选中恢复和删除确认在提交中仍可点击',async()=>{
 const folder=require('node:path').join(require('node:os').tmpdir(),'dayup-test-backups');
 const Core=require('../dist/core.js');const disk=new Map();let counter=0;
 const fetch=async(path,options)=>{
  let result={};const body=options?.body?JSON.parse(options.body):null;
  if(path==='/api/backups'&&body){const name=`backup-${++counter}.json`;disk.set(name,body.data);result={name};}
  else if(path==='/api/backups')result={folder,files:[...disk.keys()].map(name=>({name,size:100}))};
  else if(path==='/api/backups/delete'){body.names.forEach(name=>disk.delete(name));result={deleted:body.names.length};}
  else result=disk.get(decodeURIComponent(path.split('/').pop()));
  return {ok:true,json:async()=>result};
 };
 const app=await createApp(null,{fetch,location:{protocol:'http:'},DayUpBackups:require('../dist/backup.js')});
 await app.submit('project',{name:'文件夹中的项目'});await app.exec('exportData()');assert.equal(disk.size,1);assert.equal(app.downloads.length,0);
 await app.exec("showBackups('view')");const folderView=app.nodes.get('#modal-root').innerHTML;assert.ok(folderView.includes(folder));assert.ok(folderView.includes('backup-1.json'));assert.ok(!folderView.includes('type="radio"'));
 app.exec('state=DayUpCore.baseState()');await app.exec("showBackups('import')");assert.ok(app.nodes.get('#modal-root').innerHTML.includes('backup-1.json'));
 app.context.backupForm={dataset:{form:'backup-import'},values:[['backupNames','backup-1.json']]};
 app.exec('busy=true');const restoring=app.exec('handleBackupForm(backupForm)');await new Promise(r=>setImmediate(r));
 await app.click('confirm-yes');await restoring;app.exec('busy=false');assert.equal(app.snapshot().projects[0].name,'文件夹中的项目');
 app.context.backupForm={dataset:{form:'backup-delete'},values:[['backupNames','backup-1.json']]};
 app.exec('busy=true');const deleting=app.exec('handleBackupForm(backupForm)');await new Promise(r=>setImmediate(r));
 await app.click('confirm-yes');await deleting;app.exec('busy=false');assert.equal(disk.size,0);assert.equal(app.snapshot().projects[0].name,'文件夹中的项目');
 Core.validateBackup(app.snapshot());
});
