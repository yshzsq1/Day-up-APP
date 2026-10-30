const test=require('node:test'),assert=require('node:assert/strict'),C=require('../dist/core.js'),L=require('../dist/learning-core.js'),{createApp}=require('./app-harness.cjs');
async function noteApp(){const a=await createApp();await a.submit('learnsubject',{name:'Python',status:'进行中'});await a.submit('learnnote',{subjectId:a.snapshot().learning.subjects[0].id,title:'循环练习',tags:'基础,练习',template:'代码练习'});return a;}
const draft=a=>JSON.parse(a.exec('JSON.stringify(learningNoteDraft)'));
function edit(a,field,value,id){a.context.editValue=value;a.context.editId=id;a.context.editField=field;a.exec('changeLearningDraft(editField,editValue,editId)');}
test('编程笔记模板、标题标签与代码原始缩进经过保存、刷新和备份恢复不变',async()=>{
 const a=await noteApp(),note=draft(a),b=note.blocks[1],code='def greet(name):\n    print("你好", name)\n\n\tgreet("DayUp")\n';
 assert.equal(b.language,'python');edit(a,'content',code,b.id);edit(a,'title','函数与循环');edit(a,'tags','Python，函数,Python');assert.equal(a.exec('learningNoteDirty()'),true);await a.exec('flushLearningNote()');
 assert.equal(a.exec('learningNoteDirty()'),false);assert.equal(a.snapshot().learning.notes[0].blocks[1].content,code);assert.deepEqual(a.snapshot().learning.notes[0].tags,['Python','函数']);
 const reload=await createApp(C.validateBackup(JSON.parse(a.memory.get('dayup-local-v1'))));assert.deepEqual(reload.snapshot().learning.notes,a.snapshot().learning.notes);
 await a.click('learn-add-text');assert.equal(draft(a).blocks.length,3);await a.exec('flushLearningNote()');assert.equal(a.snapshot().learning.notes[0].blocks.length,3);
});
test('搜索覆盖标题、标签和代码正文，严格区分所属科目',async()=>{
 const a=await noteApp(),first=a.snapshot().learning.subjects[0].id,b=draft(a).blocks[1];edit(a,'content','for value in range(10):\n    print(value)',b.id);await a.exec('flushLearningNote()');await a.submit('learnsubject',{name:'Java',status:'进行中'});const second=a.snapshot().learning.subjects[1].id;await a.submit('learnnote',{subjectId:second,title:'Java range',tags:'练习',template:'代码练习'});
 for(const q of ['循环','基础','range'])assert.equal(L.searchNotes(a.snapshot().learning.notes,first,q).length,1);
 assert.equal(L.searchNotes(a.snapshot().learning.notes,first,'不存在').length,0);assert.equal(L.searchNotes(a.snapshot().learning.notes,second,'range')[0].blocks[1].language,'java');assert.equal(L.searchNotes(a.snapshot().learning.notes,first,'JAVA').length,0);
});
test('阅读预览转义 HTML 而保留代码与文字，下载和复制得到原文',async()=>{
 let copied;const a=await noteApp();a.context.navigator={clipboard:{writeText:async v=>{copied=v}}};const note=draft(a),code='<script>alert("test")</script>\n    print(1)\n';edit(a,'content',code,note.blocks[1].id);edit(a,'content','<img src=x onerror=alert(1)>',note.blocks[0].id);await a.click('learn-preview-note');
 const html=a.exec('renderLearning()');assert.doesNotMatch(html,/<script>|<img src=x/);assert.match(html,/&lt;script&gt;/);assert.match(html,/syntax-keyword/);assert.match(html,/&lt;img src=x/);
 await a.click('learn-copy-code',note.blocks[1].id);assert.equal(copied,code);await a.click('learn-download-code',note.blocks[1].id);assert.equal(await a.downloads[0].blob.text(),code);assert.equal(a.downloads[0].name,'循环练习.py');
});
test('保存排队时继续输入，最终保存最新版本而不覆盖较新的草稿',async()=>{
 const a=await noteApp(),id=draft(a).blocks[1].id;let release,started;const gate=new Promise(r=>release=r),entered=new Promise(r=>started=r);let first=true;
 a.context.slowPut=async(k,v)=>{if(first){first=false;started();await gate;}a.memory.set(k,v);};a.exec('persistence.primary.put=slowPut');
 edit(a,'content','first',id);const one=a.exec('flushLearningNote()');await entered;edit(a,'content','second\n    indent',id);const two=a.exec('flushLearningNote()');release();await Promise.all([one,two]);assert.equal(a.snapshot().learning.notes[0].blocks[1].content,'second\n    indent');assert.equal(a.exec('learningNoteDirty()'),false);
});
test('存储失败保留编辑器草稿与旧记录，提示未保存并可重试成功',async()=>{
 const a=await noteApp(),id=draft(a).blocks[1].id,before=a.snapshot().learning.notes[0];edit(a,'content','不可丢失的代码',id);a.exec("persistence.primary.put=()=>{throw Error('quota')}");await assert.rejects(a.exec('flushLearningNote()'),/保存失败/);
 assert.equal(draft(a).blocks[1].content,'不可丢失的代码');assert.deepEqual(a.snapshot().learning.notes[0],before);assert.equal(a.exec('learningNoteDirty()'),true);assert.match(a.nodes.get('#note-save-state').textContent,/未保存/);assert.match(a.exec('renderLearning()'),/不可丢失的代码/);
 a.context.repairPut=(k,v)=>a.memory.set(k,v);a.exec('persistence.primary.put=repairPut');await a.exec('flushLearningNote()');assert.equal(a.snapshot().learning.notes[0].blocks[1].content,'不可丢失的代码');assert.equal(a.exec('learningNoteDirty()'),false);
});
test('有内容的块和整篇笔记删除需确认，取消保留，确认只删除目标',async()=>{
 const a=await noteApp(),n=draft(a);edit(a,'content','保留说明',n.blocks[0].id);await a.exec('flushLearningNote()');a.exec('confirmAction=async()=>false');await a.click('learn-remove-block',n.blocks[0].id);assert.equal(draft(a).blocks.length,2);a.exec('confirmAction=async()=>true');await a.click('learn-remove-block',n.blocks[1].id);await a.exec('flushLearningNote()');assert.deepEqual(a.snapshot().learning.notes[0].blocks.map(b=>b.content),['保留说明']);await a.click('learn-delete-note',n.id);assert.equal(a.snapshot().learning.notes.length,0);assert.equal(a.snapshot().learning.subjects.length,1);
});
test('损坏笔记备份被拒绝，跨科目、重复块编号与非法代码语言不能进入存储',async()=>{
 const a=await noteApp(),good=a.snapshot();for(const alter of [n=>n.subjectId='missing',n=>n.blocks.push({...n.blocks[0]}),n=>n.blocks[1].language='<script>',n=>n.title='']){const bad=structuredClone(good);alter(bad.learning.notes[0]);assert.throws(()=>C.validateBackup(bad));}assert.deepEqual(a.snapshot(),good);
});
test('离开编辑前保存最新内容，失败时不执行页面导航',async()=>{
 const a=await noteApp(),id=draft(a).blocks[0].id;let clicks=0,prevented=0;const event={target:{closest:()=>({dataset:{view:'overview'},click(){clicks++;}})},preventDefault(){prevented++;},stopImmediatePropagation(){}};
 edit(a,'content','离开前保存',id);await a.events.click[0](event);assert.equal(clicks,1);assert.equal(prevented,1);assert.equal(a.snapshot().learning.notes[0].blocks[0].content,'离开前保存');
 edit(a,'content','失败草稿',id);a.exec('persistence.primary.put=()=>{throw Error("quota")}');await a.events.click[0](event);assert.equal(clicks,1);assert.equal(draft(a).blocks[0].content,'失败草稿');
});
