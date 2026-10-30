const test=require('node:test'),assert=require('node:assert/strict'),{createApp}=require('./app-harness.cjs');
test('数学和 Python 笔记本使用自己的科目名称，通用文案并保留各自的历史笔记',async()=>{
 const a=await createApp();await a.submit('learnsubject',{name:'数学',status:'进行中'});const math=a.snapshot().learning.subjects[0].id;await a.submit('learnnote',{subjectId:math,title:'二次函数',template:'知识点'});
 await a.submit('learnsubject',{name:'Python',status:'进行中'});const python=a.snapshot().learning.subjects[1].id;await a.submit('learnnote',{subjectId:python,title:'列表推导式',template:'代码练习'});
 for(const [id,name,own,other] of [[math,'数学','二次函数','列表推导式'],[python,'Python','列表推导式','二次函数']]){await a.click('learn-close-note');await a.click('learn-open-subject',id);const html=a.exec('renderLearning()');assert.match(html,new RegExp(`<h2>${name}笔记本</h2>`));assert.doesNotMatch(html,/编程笔记本|让解释、代码和问题|例如：列表、异常、class/);assert.ok(html.includes(own));assert.ok(!html.includes(other));const note=a.snapshot().learning.notes.find(n=>n.subjectId===id);await a.click('learn-open-note',note.id);assert.equal(a.exec('learningNoteDraft.subjectId'),id);assert.equal(a.exec('learningNoteDraft.title'),own);}
});
test('科目改名后笔记本标题同步，名称安全显示，刷新后原笔记归属和内容保留',async()=>{
 const a=await createApp();await a.submit('learnsubject',{name:'数学',status:'进行中'});const id=a.snapshot().learning.subjects[0].id;await a.submit('learnnote',{subjectId:id,title:'极限',template:'知识点'});const note=a.snapshot().learning.notes[0];await a.click('learn-close-note');await a.submit('learnsubject',{id,name:'高等数学 <基础>',status:'进行中'});
 const html=a.exec('renderLearning()');assert.match(html,/<h2>高等数学 &lt;基础&gt;笔记本<\/h2>/);assert.doesNotMatch(html,/<基础>/);assert.deepEqual(a.snapshot().learning.notes[0],note);const re=await createApp(JSON.parse(a.memory.get('dayup-local-v1')));await re.click('learn-open-subject',id);assert.match(re.exec('renderLearning()'),/高等数学 &lt;基础&gt;笔记本/);assert.deepEqual(re.snapshot().learning.notes[0],note);
});
