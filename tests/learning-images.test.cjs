const test=require('node:test'),assert=require('node:assert/strict'),L=require('../dist/learning-core.js'),C=require('../dist/core.js'),{LocalStore}=require('../dist/storage.js'),{createApp}=require('./app-harness.cjs');
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=';
const file=(patch={})=>({name:'error.png',type:'image/png',size:68,base64:png,...patch});
class Reader{readAsDataURL(f){queueMicrotask(()=>{this.result=`data:${f.type};base64,${f.base64}`;this.onload();});}}
class ImageDecoder{set src(v){queueMicrotask(()=>{this.naturalWidth=1;this.naturalHeight=1;this.onload();});}}
async function imageApp(){const a=await createApp(null,{FileReader:Reader,Image:ImageDecoder});await a.submit('learnsubject',{name:'Python',status:'进行中'});await a.submit('learnnote',{subjectId:a.snapshot().learning.subjects[0].id,title:'报错截图',template:'问题排查'});return a;}
const draft=a=>JSON.parse(a.exec('JSON.stringify(learningNoteDraft)'));
async function add(a,files,after=''){a.context.images=files;a.context.afterImage=after;return a.exec('addLearningImages(images,afterImage)');}
test('截图上传后保留字节、说明和位置，可刷新和完整备份恢复',async()=>{
 const a=await imageApp(),first=draft(a).blocks[0].id;await add(a,[file()],first);let n=a.snapshot().learning.notes[0];assert.deepEqual(n.blocks.map(b=>b.type),['text','image','code']);assert.equal(n.blocks[1].src,`data:image/png;base64,${png}`);
 a.context.imageId=n.blocks[1].id;a.exec('changeLearningDraft("caption","ValueError 报错定位",imageId)');await a.exec('flushLearningNote()');const reopened=await createApp(C.validateBackup(JSON.parse(a.memory.get('dayup-local-v1'))));assert.deepEqual(reopened.snapshot().learning.notes,a.snapshot().learning.notes);assert.equal(L.searchNotes(a.snapshot().learning.notes,n.subjectId,'ValueError').length,1);
 await a.click('learn-view-image',n.blocks[1].id);assert.match(a.nodes.get('#modal-root').innerHTML,/data:image\/png;base64,/);assert.match(a.nodes.get('#modal-root').innerHTML,/ValueError 报错定位/);
});
test('剪贴板截图和文件拖入走同一保存流程，普通文字粘贴保持原行为',async()=>{
 const a=await imageApp();let prevented=0;const editor={classList:{remove(){},add(){}}},target={closest:s=>s==='#learning-editor'?editor:null};
 a.context.pasteEvent={target,clipboardData:{items:[{kind:'file',getAsFile:()=>file()}]},preventDefault(){prevented++;}};await a.exec('handleLearningPaste(pasteEvent)');assert.equal(a.snapshot().learning.notes[0].blocks.filter(b=>b.type==='image').length,1);assert.equal(prevented,1);
 a.context.pasteEvent.clipboardData.items=[{kind:'string'}];await a.exec('handleLearningPaste(pasteEvent)');assert.equal(prevented,1);
 a.context.dropEvent={target,dataTransfer:{files:[file()],types:['Files']},preventDefault(){prevented++;}};assert.equal(await a.exec('handleLearningFileDrop(dropEvent)'),true);assert.equal(a.snapshot().learning.notes[0].blocks.filter(b=>b.type==='image').length,2);
});
test('图片类型、伪装格式、超限、损坏解码与批次失败不能留下部分图片',async()=>{
 const a=await imageApp(),before=a.snapshot();for(const f of [file({type:'image/svg+xml'}),file({size:L.maxImageBytes+1}),file({base64:Buffer.from('<script>bad</script>').toString('base64')})])await assert.rejects(add(a,[f]));
 await assert.rejects(add(a,[file(),file({type:'image/gif'})]));assert.deepEqual(a.snapshot(),before);assert.equal(a.exec('learningImageBusy'),false);assert.equal(draft(a).blocks.length,2);
 a.context.Image=class{set src(v){queueMicrotask(()=>this.onerror());}};await assert.rejects(add(a,[file()]),/损坏/);assert.deepEqual(a.snapshot(),before);
});
test('导入图片时阻止离开、切换笔记和重复导入，完成后才允许操作',async()=>{
 const a=await imageApp();let release;const gate=new Promise(r=>release=r);a.context.FileReader=class{readAsDataURL(f){gate.then(()=>{this.result=`data:image/png;base64,${png}`;this.onload();});}};
 const pending=add(a,[file()]);await new Promise(r=>setImmediate(r));assert.equal(a.exec('learningImageBusy'),true);await a.click('learn-close-note');assert.notEqual(a.exec('learningNoteDraft'),null);assert.match(a.nodes.get('#toast').textContent,/正在保存截图/);await assert.rejects(add(a,[file()]),/正在导入/);let nav=0,prevented=0;await a.events.click[0]({target:{closest:()=>({dataset:{view:'overview'},click(){nav++;}})},preventDefault(){prevented++;},stopImmediatePropagation(){}});assert.equal(nav,0);assert.equal(prevented,1);release();await pending;await a.click('learn-close-note');assert.equal(a.exec('learningNoteDraft'),null);
});
test('存储空间不足时图片草稿保留，恢复存储后可重新保存完整图片',async()=>{
 const a=await imageApp();a.exec('persistence.primary.put=()=>{throw Error("quota")}');await assert.rejects(add(a,[file()]),/保存失败/);assert.equal(draft(a).blocks[2].src,`data:image/png;base64,${png}`);assert.equal(a.snapshot().learning.notes[0].blocks.length,2);assert.equal(a.exec('learningNoteDirty()'),true);
 a.context.put=(k,v)=>a.memory.set(k,v);a.exec('persistence.primary.put=put');await a.exec('flushLearningNote()');assert.equal(a.snapshot().learning.notes[0].blocks.length,3);
});
test('图片占满主存储时自动进入备用数据库，重启仍读取最新截图',async()=>{
 const a=await imageApp();await add(a,[file()]);const old=new Map(),secondary=new Map();const primary={get:k=>old.get(k),put:()=>{throw Error('quota')}},fallback={get:k=>secondary.get(k),put:(k,v)=>secondary.set(k,v)};const store=new LocalStore(primary,fallback);await store.write(a.snapshot());assert.equal(store.mode,'浏览器本地数据库');const restored=await new LocalStore(primary,fallback).load();assert.equal(restored.learning.notes[0].blocks[2].src,`data:image/png;base64,${png}`);
});
test('备份拒绝外链、SVG、格式伪装和超大内联图片，正常 PNG 可恢复',async()=>{
 const a=await imageApp();await add(a,[file()]);const good=a.snapshot();for(const src of ['https://example.com/private.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,'+png,'data:image/png;base64,'+'A'.repeat(Math.ceil((L.maxImageBytes+1)/3)*4)]){const bad=structuredClone(good);bad.learning.notes[0].blocks[2].src=src;assert.throws(()=>C.validateBackup(bad));}assert.equal(C.validateBackup(good).learning.notes[0].blocks[2].src,good.learning.notes[0].blocks[2].src);
});
