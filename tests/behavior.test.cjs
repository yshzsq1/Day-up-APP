const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../dist/core.js');
const fixture=()=>JSON.parse(require('node:fs').readFileSync('tests/fixtures/sample-backup.json'));

test('本地凌晨使用本地日期，不回退到 UTC 前一天',()=>{
  assert.equal(C.localDate(new Date(2026,9,28,0,5)),'2026-10-28');
  assert.equal(C.addDays('2026-12-31',1),'2027-01-01');
});
test('每月重复保留原始日期，月底和闰年正确',()=>{
  assert.equal(C.addMonths('2026-01-31',1),'2026-02-28');
  assert.equal(C.addMonths('2026-01-31',2),'2026-03-31');
  assert.equal(C.addMonths('2024-01-31',1),'2024-02-29');
  assert.equal(C.occursOn({startDate:'2026-01-31',recurrence:'每月'},'2026-03-31'),true);
  assert.equal(C.occursOn({startDate:'2026-01-31',recurrence:'每月'},'2026-03-30'),false);
});
test('重复计划多年后仍可生成，重复查看不会产生副本',()=>{
  const data=C.baseState();
  data.series.push({id:'s',startDate:'2026-01-01',recurrence:'每天',template:{title:'运动'},excluded:[]});
  C.ensureOccurrence(data,'2036-02-01'); C.ensureOccurrence(data,'2036-02-01');
  assert.equal(data.plans.length,1); assert.equal(data.plans[0].date,'2036-02-01');
});
test('完成单次、推迟单次、删除单次不会污染整个系列或重新出现',()=>{
  const data=C.baseState();
  data.series.push({id:'s',startDate:'2026-01-01',recurrence:'每天',template:{title:'运动'},excluded:[]});
  C.ensureOccurrence(data,'2026-01-01'); C.ensureOccurrence(data,'2026-01-02');
  data.plans[0].status='done'; data.plans[0].date='2026-01-03';
  C.ensureOccurrence(data,'2026-01-01'); assert.equal(data.plans.length,2);
  assert.equal(data.plans[1].status,'todo');
  C.deleteOccurrence(data,data.plans[1].id); C.ensureOccurrence(data,'2026-01-02');
  assert.equal(data.plans.length,1);
});
test('完整备份可以往返恢复，所有模块内容保留',()=>{
  const original=C.validateBackup(fixture());
  original.projects.push({id:'p',name:'工程',status:'进行中',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'});
  const restored=C.validateBackup(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(restored,original);
  assert.equal(restored.plans[0].title,'导入验收计划');
});
test('错误类型、缺少模块、重复 ID、非法日期和未知版本全部拒绝',()=>{
  for(const mutate of [v=>v.projects={},v=>delete v.clients,v=>v.plans.push({...v.plans[0]}),v=>v.plans[0].date='2026-02-30',v=>v.version=999]){
    const v=fixture();mutate(v);assert.throws(()=>C.validateBackup(v));
  }
});
test('负数、超限进度、空内容和无客户沟通被拒绝',()=>{
  for(const [kind,row] of [['water',{water:-1}],['game',{name:'g',progress:101}],['plan',{title:'   '}],['consultlog',{summary:'hello',clientId:'missing'}]]) assert.throws(()=>C.assertForm(kind,row,C.baseState()));
});
test('旧版本重复记录迁移保留完成状态和关联',()=>{
  const old=fixture();old.plans[0].seriesId='old';old.plans[0].recurrence='每周';old.plans[0].status='done';
  const migrated=C.normalise(old);assert.equal(migrated.series.length,1);assert.equal(migrated.plans[0].status,'done');
  C.ensureOccurrence(migrated,'2026-11-04');assert.equal(migrated.plans[1].status,'todo');
});
