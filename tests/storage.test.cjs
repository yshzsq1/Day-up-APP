const test=require('node:test'), assert=require('node:assert/strict');
const {LocalStore}=require('../dist/storage.js');
const adapter=()=>{const data=new Map();return {get:k=>data.get(k),put:(k,v)=>data.set(k,v)}};
test('重建存储实例模拟重新启动，数据仍然存在',async()=>{
 const disk=adapter();await new LocalStore(disk,null).write({plans:[{title:'保留'}]});
 assert.equal((await new LocalStore(disk,null).load()).plans[0].title,'保留');
});
test('主存储写入失败后等待备用事务提交，并在重启后读取较新的版本',async()=>{
 const primary=adapter(), secondary=adapter();await new LocalStore(primary,secondary).write({name:'旧数据'});
 const failing={get:primary.get,put:()=>{throw Error('quota')}};
 await new LocalStore(failing,secondary).write({name:'新数据'});
 assert.equal((await new LocalStore(primary,secondary).load()).name,'新数据');
});
test('两个存储都失败必须报错，不能显示保存成功',async()=>{
 const broken={get:()=>null,put:()=>{throw Error('denied')}};
 await assert.rejects(new LocalStore(broken,broken).write({plans:[]}));
});
test('连续异步写入按顺序提交，最后一次数据不会被旧写入覆盖',async()=>{
 const disk=adapter();const store=new LocalStore(null,{get:disk.get,put:async(k,v)=>{await new Promise(r=>setTimeout(r,3));disk.put(k,v)}});
 await Promise.all([store.write({value:1}),store.write({value:2}),store.write({value:3})]);
 assert.equal((await store.load()).value,3);
});
test('损坏的存储数据明确报错，不默默重置为空',async()=>{
 const disk={get:()=>'{broken',put:()=>{}};
 await assert.rejects(new LocalStore(disk,null).load());
});
