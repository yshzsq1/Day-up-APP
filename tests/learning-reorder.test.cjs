const test=require('node:test'),assert=require('node:assert/strict'),L=require('../dist/learning-core.js'),C=require('../dist/core.js'),{createApp}=require('./app-harness.cjs');
async function blockApp(){const a=await createApp();await a.submit('learnsubject',{name:'Python',status:'进行中'});await a.submit('learnnote',{subjectId:a.snapshot().learning.subjects[0].id,title:'排序验收',template:'问题排查'});a.exec("learningNoteDraft.blocks.push({id:'image',type:'image',name:'error.png',caption:'错误现场',src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII='});changeLearningDraft('blocks',learningNoteDraft.blocks)");await a.exec('flushLearningNote()');return a;}
const blocks=a=>JSON.parse(a.exec('JSON.stringify(learningNoteDraft.blocks)'));
function dragObjects(a,source,target,clientY){
 const data=new Map(),classes=new Set(),editor={},block={dataset:{blockId:target},getBoundingClientRect:()=>({top:100,height:200}),classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)}};
 const transfer={types:['application/x-dayup-block'],files:[],setData:(k,v)=>data.set(k,v),getData:k=>data.get(k)||''};
 a.context.startEvent={target:{closest:s=>s==='[data-note-drag]'?{dataset:{noteDrag:source},closest:()=>block}:null},dataTransfer:transfer,preventDefault(){this.prevented=true;}};
 a.context.overEvent={target:{closest:s=>s==='#learning-editor'?editor:s==='[data-block-id]'?block:null},clientY,dataTransfer:transfer,preventDefault(){this.prevented=true;}};
 return {classes,data,transfer};
}
test('任意类型块可以向前或向后排序，内容、编号及输入顺序不被改变',()=>{
 const before=[{id:'text',type:'text',content:'解释'},{id:'code',type:'code',content:'    print(1)'},{id:'image',type:'image',src:'original'}],original=structuredClone(before);let next=L.reorderBlocks(before,'image','text','before');assert.deepEqual(next.map(b=>b.id),['image','text','code']);next=L.reorderBlocks(next,'image','code','after');assert.deepEqual(next,original);assert.deepEqual(before,original);assert.deepEqual(L.reorderBlocks(before,'code','code','before'),before);assert.throws(()=>L.reorderBlocks(before,'missing','code','before'));assert.throws(()=>L.reorderBlocks(before,'code','image','invalid'));
});
test('拖动把手、前后位置提示、释放与紧随的 dragend 完成实际排序并持久化',async()=>{
 const a=await blockApp(),before=blocks(a),fake=dragObjects(a,'image',before[0].id,110);a.exec('startLearningDrag(startEvent);handleLearningDragOver(overEvent)');assert.equal(fake.transfer.effectAllowed,'move');assert.equal(fake.transfer.dropEffect,'move');assert.equal(a.context.overEvent.prevented,true);assert.ok(fake.classes.has('note-drop-before'));
 const pending=a.exec('handleLearningDrop(overEvent)');a.exec('clearLearningDrag()');await pending;assert.deepEqual(blocks(a).map(b=>b.id),['image',before[0].id,before[1].id]);assert.deepEqual(a.snapshot().learning.notes[0].blocks,[before[2],before[0],before[1]]);assert.equal(a.exec('learningNoteDirty()'),false);
 const reload=await createApp(C.validateBackup(JSON.parse(a.memory.get('dayup-local-v1'))));assert.deepEqual(reload.snapshot().learning.notes[0].blocks,a.snapshot().learning.notes[0].blocks);
});
test('下半区显示后插提示，拖到自身、外部伪造拖放与取消不会误改内容',async()=>{
 const a=await blockApp(),before=blocks(a);let f=dragObjects(a,before[0].id,'image',290);a.exec('startLearningDrag(startEvent);handleLearningDragOver(overEvent)');assert.ok(f.classes.has('note-drop-after'));a.exec('clearLearningDrag()');await a.exec('handleLearningDrop(overEvent)');assert.deepEqual(blocks(a),before);
 f=dragObjects(a,before[0].id,before[0].id,110);a.exec('startLearningDrag(startEvent)');await a.exec('handleLearningDrop(overEvent)');assert.deepEqual(blocks(a),before);
 f=dragObjects(a,'image',before[0].id,110);a.exec('startLearningDrag(startEvent)');f.data.set('application/x-dayup-block','foreign');await a.exec('handleLearningDrop(overEvent)');assert.deepEqual(blocks(a),before);
});
test('上移和下移与拖动一致，边界按钮不可用，键盘点击后立即保存并保持内容',async()=>{
 const a=await blockApp(),before=blocks(a);assert.match(a.exec('renderLearningBlock(learningNoteDraft.blocks[0],0)'),/aria-label="上移内容块 1" disabled/);await a.click('learn-block-up','image');assert.deepEqual(blocks(a),[before[0],before[2],before[1]]);await a.click('learn-block-down','image');assert.deepEqual(blocks(a),before);await a.click('learn-block-down','image');assert.deepEqual(blocks(a),before);assert.deepEqual(a.snapshot().learning.notes[0].blocks,before);assert.equal(a.exec('learningNoteDirty()'),false);
});
test('卡片之外不能启动排序，阅读模式和截图导入中不可移动',async()=>{
 const a=await blockApp(),before=blocks(a);dragObjects(a,'image',before[0].id,110);a.context.startEvent.target.closest=()=>null;a.exec('startLearningDrag(startEvent)');await a.exec('handleLearningDrop(overEvent)');assert.deepEqual(blocks(a),before);
 a.exec('learningPreview=true');assert.equal(await a.exec(`moveLearningBlock('image','${before[0].id}','before')`),false);a.exec('learningPreview=false;learningImageBusy=true');assert.equal(await a.exec(`moveLearningBlock('image','${before[0].id}','before')`),false);assert.deepEqual(blocks(a),before);
});
test('卡片背景、标题和截图都能开始拖动，输入区与操作按钮不会误启动排序',async()=>{
 const a=await blockApp(),before=blocks(a),data=new Map(),card={dataset:{blockId:'image'},classList:{add(){}},getBoundingClientRect:()=>({top:100,height:100})};
 for(const region of ['background','heading','image']){a.context.cardStart={target:{closest:s=>s==='[data-block-id]'?card:null},dataTransfer:{setData:(k,v)=>data.set(k,v)},preventDefault(){this.prevented=true;}};a.exec('startLearningDrag(cardStart)');assert.equal(data.get('application/x-dayup-block'),'image',region);assert.equal(a.exec('learningDragId'),'image');a.exec('clearLearningDrag()');}
 for(const control of ['textarea','input','select','button']){a.context.cardStart.target.closest=s=>s==='[data-block-id]'?card:s==='input,textarea,select,button,a,[contenteditable="true"]'?{tagName:control}:null;a.exec('startLearningDrag(cardStart)');assert.equal(a.context.cardStart.prevented,true);assert.equal(a.exec('learningDragId'),'');}
 assert.deepEqual(blocks(a),before);
 dragObjects(a,'image',before[0].id,110);a.context.startEvent.target.closest=s=>s==='[data-block-id]'?card:null;a.exec('startLearningDrag(startEvent)');await a.exec('handleLearningDrop(overEvent)');assert.deepEqual(a.snapshot().learning.notes[0].blocks,[before[2],before[0],before[1]]);
});
test('从输入区按下鼠标时关闭父卡片拖拽，放开后恢复，保留编辑文字选择',async()=>{
 const a=await blockApp(),card={draggable:true};const event={target:{closest:s=>s==='.note-block'?card:s==='input,textarea,select,button,a,[contenteditable="true"]'?{}:null}};await a.events.pointerdown[0](event);assert.equal(card.draggable,false);
 a.context.document.querySelectorAll=selector=>selector==='.note-block'?[card]:[];await a.events.pointerup[0]();assert.equal(card.draggable,true);
});
test('排序保存失败保留新顺序草稿和旧存储，重试后恢复一致',async()=>{
 const a=await blockApp(),before=blocks(a);a.exec('persistence.primary.put=()=>{throw Error("quota")}');await assert.rejects(a.exec(`moveLearningBlock('image','${before[0].id}','before')`),/保存失败/);assert.deepEqual(blocks(a),[before[2],before[0],before[1]]);assert.deepEqual(a.snapshot().learning.notes[0].blocks,before);assert.equal(a.exec('learningNoteDirty()'),true);a.context.put=(k,v)=>a.memory.set(k,v);a.exec('persistence.primary.put=put');await a.exec('flushLearningNote()');assert.deepEqual(a.snapshot().learning.notes[0].blocks,blocks(a));
});
