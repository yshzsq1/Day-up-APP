/* Learning workspace shares the existing persistence, modal and plan flows. */
let learningSubjectId='',learningShowArchived=false;
let learningNoteId='',learningNoteDraft=null,learningQuery='',learningPreview=false,learningRevision=0,learningSavedRevision=0,learningSaveStatus='已保存',learningSaveTimer;
let learningWriteChain=Promise.resolve();
let learningImageBusy=false;
let learningDragId='',learningDragNoteId='',learningLanguageMenuId='';
let learningPage='home',learningDay='',learningMonth='',learningPlanDragId='',learningJustCompleted='';
function resetLearningHome(){learningPage='home';learningDay=today();learningMonth=today();learningSubjectId='';learningNoteId='';learningNoteDraft=null;learningQuery='';}
function learningSummary(){const s=DayUpLearning.stats(state.learning,'',today());return `<button class="summary-row" data-view="learning"><span class="summary-icon">▤</span><span><strong>学习空间</strong><small>${state.learning.subjects.length?`今日 ${s.today} 分钟 · 本周 ${s.week} 分钟 · ${s.done}/${s.units} 章节`:'添加想学习的科目'}</small></span><b>›</b></button>`;}
function learningShelfIcon(){return `<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M6 6h52v52H6zM6 31h52M6 56h52M13 12h7v19h-7zM24 15h7v16h-7zM39 11l7-2 6 20-7 2zM13 38h8v18h-8zM26 35h8v21h-8zM41 40h9v16h-9z"/></svg>`;}
function learningBreadcrumbs(subject,title=''){return `<nav class="learning-breadcrumbs" aria-label="学习空间层级"><button class="link-button" data-action="learn-home">学习首页</button><span>›</span><button class="link-button" data-action="learn-library">笔记书屋</button>${subject?`<span>›</span>${title?`<button class="link-button" data-action="learn-close-note">${esc(subject.name)}</button><span>›</span><span aria-current="page">${esc(title)}</span>`:`<span aria-current="page">${esc(subject.name)}</span>`}`:''}</nav>`;}
function renderLearningLibrary(){
 const subjects=state.learning.subjects.filter(s=>learningShowArchived?s.status==='归档':s.status!=='归档'),books=subjects.map(s=>{const count=state.learning.notes.filter(n=>n.subjectId===s.id).length;return `<button class="shelf-book" data-action="learn-open-subject" data-id="${s.id}" aria-label="打开 ${esc(s.name)} 笔记本，${count} 篇笔记"><span class="book-spine" aria-hidden="true"></span><span class="book-cover"><small>DAYUP · 学习笔记</small><strong>${esc(s.name)}</strong><span>${count} 篇笔记</span><i aria-hidden="true">▤</i></span></button>`;});
 books.push(`<button class="shelf-new-book" data-action="learn-new-subject"><span aria-hidden="true">＋</span><strong>新建笔记本</strong><small>为一个科目留一格</small></button>`);
 const shelves=[];for(let i=0;i<books.length;i+=4)shelves.push(`<div class="book-shelf">${books.slice(i,i+4).join('')}</div>`);
 return `${learningBreadcrumbs()}<section class="library-room card"><div class="section-heading"><div><p class="eyebrow">我的知识收藏</p><h2>笔记书屋</h2><p>一本笔记本，一门科目。抽出一本，接着写下去。</p></div><button class="secondary-button" data-action="learn-archives">${learningShowArchived?'返回当前书架':'查看归档书架'}</button></div>${!subjects.length?`<p class="subtle">${learningShowArchived?'还没有归档的笔记本。':'书架还是空的，为想学习的科目建一本笔记本。'}</p>`:''}<div class="book-shelves">${shelves.join('')}</div></section>`;
}
function learningKpis(s){return `<div class="learning-kpis"><div class="kpi"><strong>${s.progress}%</strong><span>章节完成 · ${s.done}/${s.units}</span></div><div class="kpi"><strong>${s.today}</strong><span>今日学习（分钟）</span></div><div class="kpi"><strong>${s.week}</strong><span>近 7 天（分钟）</span></div><div class="kpi"><strong>${s.minutes}</strong><span>累计学习（分钟）</span></div></div>`;}
function learningWeek(s){const max=Math.max(30,...s.days.map(d=>d.minutes));return `<section class="card"><div class="section-heading"><h2>近七天的投入</h2><span class="subtle">记录实际学习，不计入计划时长</span></div><div class="learning-week" role="list" aria-label="近七天学习时长">${s.days.map(d=>`<div role="listitem" aria-label="${d.date}，${d.minutes} 分钟"><strong>${d.minutes}分</strong><div class="learning-bar"><i style="height:${Math.round(d.minutes/max*100)}%"></i></div><small>${d.date.slice(5)}</small></div>`).join('')}</div></section>`;}
function renderLearning(){
 if(learningPage==='home')return renderLearningHome();
 const selected=state.learning.subjects.find(s=>s.id===learningSubjectId);
 if(selected){if(learningNoteId&&state.learning.notes.some(n=>n.id===learningNoteId&&n.subjectId===selected.id))return renderLearningNote(selected);return renderLearningSubject(selected);}
 return renderLearningLibrary();
}
function renderLearningSubject(subject){
 const s=DayUpLearning.stats(state.learning,subject.id,today()),sessions=state.learning.sessions.filter(r=>r.subjectId===subject.id).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
 return `${learningBreadcrumbs(subject)}${renderSubjectNotes(subject)}<details class="learning-progress-panel notebook-management section-gap"><summary aria-label="学习管理：学习进度、章节与学习记录">学习管理</summary><div class="row-actions learning-management-actions"><button class="secondary-button" data-action="learn-edit-subject" data-id="${subject.id}">编辑科目</button><button class="secondary-button" data-action="learn-schedule" data-id="${subject.id}">安排到计划</button><button class="primary-button" data-action="learn-new-session" data-id="${subject.id}">＋ 记录学习</button></div><section class="card section-gap"><div class="section-heading"><div><p class="eyebrow">学习科目</p><h2>${esc(subject.name)}</h2></div><span class="pill">${esc(subject.status)}</span></div><p class="preserve-lines">${esc(subject.goal||'暂未设置学习目标')}</p>${subject.resource?`<p class="subtle preserve-lines">学习资料：${esc(subject.resource)}</p>`:''}${learningKpis(s)}</section><div class="two-col section-gap"><section class="card"><div class="section-heading"><h2>章节与里程碑</h2><button class="link-button" data-action="learn-new-unit">＋ 添加章节</button></div><div class="compact-list">${subject.units.map(u=>`<div class="task-row"><button class="check ${u.done?'checked':''}" aria-label="${u.done?'标记未完成':'完成章节'} ${esc(u.title)}" data-action="learn-toggle-unit" data-id="${u.id}">${u.done?'✓':''}</button><span class="task-copy"><strong>${esc(u.title)}</strong></span><div class="row-actions"><button class="link-button" data-action="learn-edit-unit" data-id="${u.id}">编辑</button><button class="link-button danger-text" data-action="learn-delete-unit" data-id="${u.id}">删除</button></div></div>`).join('')||empty('还没有章节','把课程拆成小章节，完成一项就能看见进步。')}</div></section>${learningWeek(s)}</div><section class="card section-gap"><div class="section-heading"><h2>学习足迹</h2><span class="subtle">按日期记录实际投入</span></div><div class="compact-list">${sessions.map(r=>`<article class="list-row"><div class="task-copy"><strong>${esc(r.date)} · ${r.duration} 分钟</strong><small class="preserve-lines">${esc(r.content||'学习记录')}</small></div><div class="row-actions"><button class="link-button" data-action="learn-edit-session" data-id="${r.id}">编辑</button><button class="link-button danger-text" data-action="learn-delete-session" data-id="${r.id}">删除</button></div></article>`).join('')||empty('还没有学习记录','完成一段学习后，记下时长和收获。')}</div></section></details>`;
}
function renderSubjectNotes(subject){const notes=DayUpLearning.searchNotes(state.learning.notes,subject.id,learningQuery),count=state.learning.notes.filter(n=>n.subjectId===subject.id).length;return `<section class="card notebook-notes"><div class="section-heading"><div><h2>${esc(subject.name)}笔记本</h2><span class="subtle notebook-count">${count} 篇笔记</span></div><button class="primary-button" data-action="learn-new-note" data-id="${subject.id}">＋ 新建笔记</button></div>${count?`<input type="search" class="form-control notebook-search" data-note-search value="${esc(learningQuery)}" aria-label="搜索这本笔记（标题、标签与正文）" placeholder="搜索笔记…" autocomplete="off">`:''}<div class="note-list" id="learning-note-results">${renderLearningNoteList(notes)}</div></section>`;}
function renderLearningNoteList(notes){return notes.map(n=>`<button type="button" class="note-list-item" data-action="learn-open-note" data-id="${n.id}" aria-label="打开笔记：${esc(n.title)}"><span><strong>${esc(n.title)}</strong>${n.tags.length?`<small>${n.tags.map(t=>`#${esc(t)}`).join(' ')}</small>`:''}</span><span class="subtle note-list-date">${esc((n.updatedAt||'').slice(0,10))}</span></button>`).join('')||`<p class="notebook-empty subtle">${learningQuery?'没有找到相关笔记':'还没有笔记，写下第一个知识点吧。'}</p>`;}
function openLearningSubject(subject=null){const s=subject||{};openModal(subject?'编辑学习科目':'新建科目笔记本',modalForm('learnsubject',`${formField('科目名称','name','text',s.name||'','required maxlength="120"')}${selectField('学习状态','status',['进行中','暂停','已完成','归档'],s.status||'进行中')}${formField('学习目标','goal','textarea',s.goal||'','class="full" maxlength="5000"')}${formField('目标日期','targetDate','date',s.targetDate||'')}${formField('课程或资料说明','resource','textarea',s.resource||'','class="full" maxlength="5000"')}${s.id?`<input type="hidden" name="id" value="${s.id}">`:''}`));}
function openLearningUnit(unit=null){openModal(unit?'编辑章节':'添加章节',modalForm('learnunit',`${formField('章节名称','title','text',unit?.title||'','required maxlength="300"')}<input type="hidden" name="subjectId" value="${learningSubjectId}">${unit?`<input type="hidden" name="id" value="${unit.id}">`:''}`));}
function openLearningSession(subjectId,session=null){const s=session||{};openModal(session?'编辑学习记录':'记录一次学习',modalForm('learnsession',`${formField('日期','date','date',s.date||today(),'required')}${formField('学习时长（分钟）','duration','number',s.duration||30,'required min="1" max="1440" step="1"')}${formField('学习内容与收获','content','textarea',s.content||'','class="full" maxlength="5000"')}<input type="hidden" name="subjectId" value="${subjectId}">${s.id?`<input type="hidden" name="id" value="${s.id}">`:''}`));}
async function handleLearningForm(kind,data){
 if(kind==='learnnote')return createLearningNote(data);
 if(!['learnsubject','learnunit','learnsession'].includes(kind))return false;
 const copy=JSON.parse(JSON.stringify(state.learning)),stamp=nowIso();
 if(kind==='learnsubject'){
  const old=copy.subjects.find(s=>s.id===data.id);if(data.id&&!old)throw Error('科目不存在，请重新打开');
  const row={id:old?.id||uid('subject'),name:data.name,status:data.status,goal:data.goal||'',targetDate:data.targetDate||'',resource:data.resource||'',units:old?.units||[],createdAt:old?.createdAt||stamp,updatedAt:stamp};
  if(old)Object.assign(old,row);else copy.subjects.push(row);learningSubjectId=row.id;learningPage='subjects';
 }else{
  const subject=copy.subjects.find(s=>s.id===data.subjectId);if(!subject)throw Error('请选择有效科目');
  if(kind==='learnunit'){const old=subject.units.find(u=>u.id===data.id);if(data.id&&!old)throw Error('章节不存在');const row={id:old?.id||uid('unit'),title:data.title,done:old?.done||false};if(old)Object.assign(old,row);else subject.units.push(row);}
  else{if(!DayUpCore.validDate(data.date)||data.date>today())throw Error('实际学习日期不能晚于今天');const old=copy.sessions.find(s=>s.id===data.id&&s.subjectId===subject.id);if(data.id&&!old)throw Error('学习记录不存在');const row={id:old?.id||uid('study'),subjectId:subject.id,date:data.date,duration:Number(data.duration),content:data.content||'',createdAt:old?.createdAt||stamp,updatedAt:stamp};if(old)Object.assign(old,row);else copy.sessions.push(row);}
  subject.updatedAt=stamp;
 }
 state.learning=DayUpLearning.validate(copy);await save();closeModal();render();notify('学习内容已保存');return true;
}
async function handleLearningAction(action,el){
 if(!action?.startsWith('learn-'))return false;
 if(learningImageBusy)throw Error('正在保存截图，请稍等再操作');
 if(await handleLearningNoteAction(action,el))return true;
 if(learningNoteDirty())await flushLearningNote();
 if(await handleLearningHomeAction(action,el))return true;
 const id=el.dataset.id,subject=state.learning.subjects.find(s=>s.id===learningSubjectId);
 if(action==='learn-new-subject')openLearningSubject();
 if(action==='learn-open-subject'){learningPage='subjects';learningSubjectId=id;render();}
 if(action==='learn-list'){learningSubjectId='';render();}
 if(action==='learn-archives'){learningShowArchived=!learningShowArchived;learningSubjectId='';render();}
 if(action==='learn-edit-subject')openLearningSubject(state.learning.subjects.find(s=>s.id===id));
 if(action==='learn-new-unit')openLearningUnit();
 if(action==='learn-edit-unit')openLearningUnit(subject?.units.find(u=>u.id===id));
 if(action==='learn-toggle-unit'){const u=subject?.units.find(u=>u.id===id);if(u){u.done=!u.done;await save();render();}}
 if(action==='learn-delete-unit'&&await confirmAction('删除这个章节？学习时长和笔记会保留。')){subject.units=subject.units.filter(u=>u.id!==id);await save();render();}
 if(action==='learn-new-session')openLearningSession(id);
 if(action==='learn-edit-session'){const r=state.learning.sessions.find(r=>r.id===id);if(r)openLearningSession(r.subjectId,r);}
 if(action==='learn-delete-session'&&await confirmAction('删除这条学习记录？统计时长将相应减少。')){state.learning.sessions=state.learning.sessions.filter(s=>s.id!==id);await save();render();}
 if(action==='learn-schedule'){const s=state.learning.subjects.find(s=>s.id===id);if(s){selectedDate=today();openPlan({title:`学习 · ${s.name}`,module:'学习空间',linkedId:s.id,date:today(),time:'待安排',status:'todo',recurrence:'不重复',reminder:'不提醒',priority:'普通',notes:s.goal||''});}}
 return true;
}

function learningNoteDirty(){return !!learningNoteDraft&&learningRevision>learningSavedRevision;}
function noteStatus(){const status=document.querySelector('#note-save-state');if(status)status.textContent=learningSaveStatus;}
function changeLearningDraft(field,value,blockId){
 if(!learningNoteDraft)return;
 if(blockId){const b=learningNoteDraft.blocks.find(b=>b.id===blockId);if(!b)return;b[field]=value;}
 else if(field==='tags')learningNoteDraft.tags=[...new Set(value.split(/[,，]/).map(t=>t.trim()).filter(Boolean))];
 else learningNoteDraft[field]=value;
 learningRevision++;learningSaveStatus='未保存';noteStatus();clearTimeout(learningSaveTimer);learningSaveTimer=setTimeout(()=>flushLearningNote().catch(()=>{}),650);
}
function flushLearningNote(){
 clearTimeout(learningSaveTimer);if(!learningNoteDirty())return learningWriteChain;
 const snapshot=JSON.parse(JSON.stringify(learningNoteDraft)),revision=learningRevision;
 const operation=learningWriteChain.then(async()=>{
  learningSaveStatus='保存中…';noteStatus();
  try{
   DayUpLearning.validateNote(snapshot,state.learning.subjects);
   const index=state.learning.notes.findIndex(n=>n.id===snapshot.id);if(index<0)throw Error('原笔记已不存在，请保留内容并重新打开');
   state.learning.notes[index]={...snapshot,updatedAt:nowIso()};await save();
   if(learningNoteDraft?.id===snapshot.id){learningSavedRevision=Math.max(learningSavedRevision,revision);learningSaveStatus=learningNoteDirty()?'未保存':'已保存';noteStatus();}
   return true;
  }catch(error){learningSaveStatus=`未保存：${error.message}。内容仍在编辑器中，请重试保存。`;noteStatus();throw error;}
 });
 learningWriteChain=operation.catch(()=>{});return operation;
}
function selectLearningNote(id){learningPage='subjects';const note=state.learning.notes.find(n=>n.id===id);if(!note)return;learningSubjectId=note.subjectId;learningNoteId=id;learningNoteDraft=JSON.parse(JSON.stringify(note));learningRevision=0;learningSavedRevision=0;learningSaveStatus='已保存';learningPreview=false;render();}
function newLearningNote(subjectId){openModal('新建学习笔记',modalForm('learnnote',`${formField('笔记标题','title','text','','required maxlength="160"')}${formField('标签（逗号分隔）','tags','text','','maxlength="800"')}${selectField('起始模板','template',['知识点','代码练习','问题排查'],'知识点')}<input type="hidden" name="subjectId" value="${subjectId}">`));}
async function createLearningNote(data){
 const stamp=nowIso(),blocks=[{id:uid('block'),type:'text',content:data.template==='问题排查'?'问题现象：\n复现步骤：\n原因与解决：\n':data.template==='代码练习'?'练习目标：\n思路与收获：\n':''}];
 if(data.template!=='知识点')blocks.push({id:uid('block'),type:'code',language:state.learning.subjects.find(s=>s.id===data.subjectId)?.name.toLowerCase().includes('java')?'java':'python',content:''});
 const note={id:uid('note'),subjectId:data.subjectId,title:data.title,tags:(data.tags||'').split(/[,，]/).map(s=>s.trim()).filter(Boolean),blocks,createdAt:stamp,updatedAt:stamp};
 DayUpLearning.validateNote(note,state.learning.subjects);state.learning.notes.push(note);await save();closeModal();selectLearningNote(note.id);notify('笔记已创建');return true;
}
function renderLearningNote(subject){
 if(!learningNoteDirty()&&learningNoteDraft?.id===learningNoteId){const persisted=state.learning.notes.find(n=>n.id===learningNoteId);if(persisted)learningNoteDraft=JSON.parse(JSON.stringify(persisted));}
 const n=learningNoteDraft?.id===learningNoteId?learningNoteDraft:state.learning.notes.find(n=>n.id===learningNoteId);
 if(!n)return renderLearningSubject(subject);
 return `${learningBreadcrumbs(subject,n.title)}<div class="page-toolbar"><button class="secondary-button" data-action="learn-close-note">‹ ${esc(subject.name)} 的笔记本</button><div class="row-actions"><span id="note-save-state" class="subtle" role="status">${esc(learningSaveStatus)}</span><button class="secondary-button" data-action="learn-preview-note">${learningPreview?'继续编辑':'阅读预览'}</button><button class="primary-button" data-action="learn-save-note">保存笔记</button></div></div><section class="card learning-editor" id="learning-editor"><div class="note-meta">${learningPreview?`<h2>${esc(n.title)}</h2><p class="subtle">${n.tags.map(t=>`#${esc(t)}`).join(' ')}</p>`:`<label>笔记标题<input class="form-control note-title" data-note-field="title" maxlength="160" value="${esc(n.title)}"></label><label>标签（逗号分隔）<input class="form-control" data-note-field="tags" value="${esc(n.tags.join(', '))}" maxlength="800"></label>`}</div>${learningPreview?'':'<p class="subtle" id="note-reorder-status" role="status">拖动卡片背景、标题或截图整理内容，也可用把手或上移 / 下移按钮。可排成“报错截图 → 原因说明 → 修复代码”。</p>'}<div id="note-blocks" class="note-blocks">${n.blocks.map((b,i)=>renderLearningBlock(b,i)).join('')||empty('笔记还是空白的','添加一段解释或一个代码示例。')}</div>${learningPreview?'':`<div class="note-add-bar"><button class="secondary-button" data-action="learn-add-text">＋ 文字</button><button class="secondary-button" data-action="learn-add-code">＋ 代码</button><button class="secondary-button" data-action="learn-attach-image">＋ 截图</button><input type="file" id="learning-images" accept="image/png,image/jpeg,image/webp" multiple hidden><span class="subtle">自动保存 · 保留代码缩进</span></div><p id="note-image-hint" class="note-drop-hint" role="status">截图可拖入此处，也可点击笔记内按 Ctrl + V 粘贴截图。PNG / JPEG / WebP，单张最多 5MB。</p>`}</section><div class="note-bottom"><span class="subtle">代码只作文本保存与展示 · 截图随笔记一同备份</span><button class="link-button danger-text" data-action="learn-delete-note" data-id="${n.id}">删除这篇笔记</button></div>`;
}
function renderLearningBlock(b,index){
 if(b.type==='image')return `<article class="note-block" data-block-id="${b.id}" draggable="${!learningPreview}"><div class="note-block-toolbar"><div class="note-block-heading">${learningBlockMoves(b,index)}<strong>${index+1}. 截图</strong></div><div class="row-actions"><button class="link-button" data-action="learn-view-image" data-id="${b.id}">查看大图</button>${learningPreview?'':`<button class="link-button danger-text" data-action="learn-remove-block" data-id="${b.id}">移除</button>`}</div></div><figure class="note-image"><img draggable="false" src="${esc(b.src)}" alt="${esc(b.caption||b.name)}" loading="lazy">${learningPreview?`<figcaption>${esc(b.caption||b.name)}</figcaption>`:`<label>截图说明<input class="form-control" data-note-field="caption" data-note-block="${b.id}" value="${esc(b.caption)}" maxlength="5000" placeholder="这张截图记录了什么？"></label>`}</figure></article>`;
 return `<article class="note-block" data-block-id="${b.id}" draggable="${!learningPreview}"><div class="note-block-toolbar"><div class="note-block-heading">${learningBlockMoves(b,index)}<strong>${index+1}. ${b.type==='code'?'代码':'文字'}</strong></div><div class="row-actions">${b.type==='code'?`<button class="link-button" data-action="learn-copy-code" data-id="${b.id}">复制代码</button><button class="link-button" data-action="learn-download-code" data-id="${b.id}">下载代码</button>`:''}${learningPreview?'':`<button class="link-button danger-text" data-action="learn-remove-block" data-id="${b.id}">移除</button>`}</div></div>${b.type==='code'?`${learningPreview?`<span class="pill">${esc(b.language)}</span>`:`${renderLearningLanguageControl(b,index)}`}${learningPreview?`<pre class="code-preview" tabindex="0" aria-label="${esc(b.language)} 代码"><code>${DayUpLearning.highlight(b.content,b.language)}</code></pre>`:`<textarea class="form-control code-input" data-note-field="content" data-note-block="${b.id}" aria-label="代码内容 ${index+1}" spellcheck="false" autocomplete="off" maxlength="200000" placeholder="在这里粘贴或输入代码，保留原始缩进">${esc(b.content)}</textarea>`}`:learningPreview?`<div class="note-prose">${esc(b.content)}</div>`:`<textarea class="form-control note-text" data-note-field="content" data-note-block="${b.id}" aria-label="文字内容 ${index+1}" maxlength="200000" placeholder="写下你的理解、问题或结论…">${esc(b.content)}</textarea>`}</article>`;
}
async function handleLearningNoteAction(action,el){
 const id=el.dataset.id;
 if(action==='learn-language-toggle'){if(!learningNoteDraft?.blocks.some(b=>b.id===id&&b.type==='code'))return true;learningLanguageMenuId=learningLanguageMenuId===id?'':id;render();document.querySelector(`[data-language-toggle="${id}"]`)?.focus();return true;}
 if(action==='learn-language-select'){await selectLearningLanguage(id,el.dataset.language);return true;}
 if(action==='learn-block-up'||action==='learn-block-down'){const i=learningNoteDraft?.blocks.findIndex(b=>b.id===id),delta=action==='learn-block-up'?-1:1,target=learningNoteDraft?.blocks[i+delta];if(target)await moveLearningBlock(id,target.id,delta<0?'before':'after');return true;}
 if(action==='learn-attach-image'){document.querySelector('#learning-images').click();return true;}
 if(action==='learn-view-image'){const b=learningNoteDraft?.blocks.find(b=>b.id===id&&b.type==='image');if(b)openModal('截图预览',`<figure class="note-image note-image-full"><img draggable="false" src="${esc(b.src)}" alt="${esc(b.caption||b.name)}"><figcaption>${esc(b.caption||b.name)}</figcaption></figure><div class="form-actions"><button class="secondary-button" data-action="close-modal">关闭</button></div>`);return true;}
 if(action==='learn-new-note'){if(learningNoteDirty())await flushLearningNote();newLearningNote(id);return true;}
 if(action==='learn-open-note'){if(learningNoteDirty())await flushLearningNote();selectLearningNote(id);return true;}
 if(action==='learn-save-note'){await flushLearningNote();notify('笔记已保存');return true;}
 if(action==='learn-close-note'){await flushLearningNote();learningNoteId='';learningNoteDraft=null;render();return true;}
 if(action==='learn-preview-note'){await flushLearningNote();learningPreview=!learningPreview;render();return true;}
 if(action==='learn-add-text'||action==='learn-add-code'){
  const b={id:uid('block'),type:action==='learn-add-code'?'code':'text',content:''};if(b.type==='code')b.language='python';
  if(learningNoteDraft.blocks.length>=100)throw Error('每篇笔记最多 100 个内容块');learningNoteDraft.blocks.push(b);changeLearningDraft('blocks',learningNoteDraft.blocks);render();return true;
 }
 if(action==='learn-remove-block'){
  const b=learningNoteDraft.blocks.find(b=>b.id===id);if(b&&(b.type!=='image'&&b.content.trim()===''||await confirmAction('移除这个内容块？其他内容保留。'))){learningNoteDraft.blocks=learningNoteDraft.blocks.filter(b=>b.id!==id);changeLearningDraft('blocks',learningNoteDraft.blocks);render();}return true;
 }
 if(action==='learn-delete-note'){
  await flushLearningNote();if(await confirmAction('确定删除整篇笔记及其中内容吗？建议先导出备份。')){state.learning.notes=state.learning.notes.filter(n=>n.id!==id);await save();learningNoteId='';learningNoteDraft=null;render();}return true;
 }
 if(action==='learn-copy-code'||action==='learn-download-code'){
  const b=learningNoteDraft?.blocks.find(b=>b.id===id);if(!b||b.type!=='code')return true;
  if(action==='learn-copy-code'){if(typeof navigator!=='undefined'&&navigator.clipboard){await navigator.clipboard.writeText(b.content);notify('代码已复制');}else openModal('复制代码',`<div class="confirmation-message"><label>请选择并复制<textarea class="form-control code-input" readonly>${esc(b.content)}</textarea></label></div><div class="form-actions"><button class="secondary-button" data-action="close-modal">关闭</button></div>`);}
  else{const ext={python:'py',java:'java',javascript:'js',typescript:'ts',sql:'sql',json:'json',html:'html',css:'css',bash:'sh',text:'txt'}[b.language];const url=URL.createObjectURL(new Blob([b.content],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=`${learningNoteDraft.title.replace(/[<>:"/\\|?*]/g,'_')}.${ext}`;link.click();URL.revokeObjectURL(url);}
  return true;
 }
 return false;
}
document.addEventListener('input',event=>{
 const el=event.target;if(el.matches('input[data-note-field],textarea[data-note-field]'))changeLearningDraft(el.dataset.noteField,el.value,el.dataset.noteBlock);
 if(el.matches('[data-note-search]')){learningQuery=el.value;document.querySelector('#learning-note-results').innerHTML=renderLearningNoteList(DayUpLearning.searchNotes(state.learning.notes,learningSubjectId,learningQuery));}
});
document.addEventListener('change',async event=>{const el=event.target;if(el.matches('select[data-note-field]'))changeLearningDraft(el.dataset.noteField,el.value,el.dataset.noteBlock);if(el.id==='learning-images'){try{await addLearningImages(Array.from(el.files||[]));}catch(e){notify(e.message);}finally{el.value='';}}});
document.addEventListener('click',async event=>{
 if(!learningNoteDirty()&&!learningImageBusy)return;const nav=event.target.closest('[data-view],#quick-add');if(!nav?.dataset.view&&nav?.id!=='quick-add')return;
 if(learningImageBusy){event.preventDefault();event.stopImmediatePropagation();notify('请等待截图保存完成再离开');return;}
 event.preventDefault();event.stopImmediatePropagation();try{await flushLearningNote();nav.click();}catch{notify('请先重试保存笔记，当前草稿已保留');}
},true);
if(typeof window!=='undefined')window.addEventListener?.('beforeunload',event=>{if(learningNoteDirty()||learningImageBusy){event.preventDefault();event.returnValue='';}});

function readLearningImage(file){return new Promise((resolve,reject)=>{
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))return reject(Error('截图仅支持 PNG、JPEG、WebP 图片'));
 if(file.size>DayUpLearning.maxImageBytes)return reject(Error('单张截图最多 5MB，请选择较小的图片'));
 const reader=new FileReader();reader.onerror=()=>reject(Error('截图读取失败，请重试'));
 reader.onload=()=>{const b={id:uid('block'),type:'image',name:(file.name||'剪贴板截图').slice(0,300),caption:'',src:String(reader.result)};try{DayUpLearning.validateImage(b);}catch(e){return reject(e);}const image=new Image();image.onload=()=>{if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>40000000)return reject(Error('截图尺寸无效或超过 4000 万像素'));resolve(b);};image.onerror=()=>reject(Error('图片已损坏，无法读取'));image.src=b.src;};reader.readAsDataURL(file);
});}
async function addLearningImages(files,afterId=''){
 if(!files.length)return;if(!learningNoteDraft||learningPreview)throw Error('请先打开笔记编辑页');if(learningImageBusy)throw Error('正在导入截图，请稍等');
 if(learningNoteDraft.blocks.length+files.length>100)throw Error('每篇笔记最多 100 个内容块');
 const noteId=learningNoteId;learningImageBusy=true;const hint=document.querySelector('#note-image-hint');if(hint)hint.textContent='正在读取并保存截图，请稍等…';
 try{const images=[];for(const file of files)images.push(await readLearningImage(file));if(learningNoteId!==noteId)throw Error('笔记已切换，请重新添加截图');const index=learningNoteDraft.blocks.findIndex(b=>b.id===afterId);learningNoteDraft.blocks.splice(index<0?learningNoteDraft.blocks.length:index+1,0,...images);changeLearningDraft('blocks',learningNoteDraft.blocks);render();await flushLearningNote();notify(`已保存 ${images.length} 张截图`);}
 finally{learningImageBusy=false;const el=document.querySelector('#note-image-hint');if(el)el.textContent='截图可拖入笔记，或按 Ctrl + V 粘贴。PNG / JPEG / WebP，单张最多 5MB。';}
}
async function handleLearningPaste(event){if(!event.target.closest('#learning-editor')||learningPreview)return;const files=Array.from(event.clipboardData?.items||[]).filter(i=>i.kind==='file').map(i=>i.getAsFile()).filter(Boolean);if(!files.length)return;event.preventDefault();try{await addLearningImages(files,event.target.closest('[data-block-id]')?.dataset.blockId);}catch(e){notify(e.message);}}
function handleLearningFileDrag(event){const editor=event.target.closest('#learning-editor');if(!editor||learningPreview||!Array.from(event.dataTransfer?.types||[]).includes('Files'))return false;event.preventDefault();editor.classList.add('note-file-hover');event.dataTransfer.dropEffect='copy';return true;}
async function handleLearningFileDrop(event){const editor=event.target.closest('#learning-editor');if(!editor||learningPreview||!event.dataTransfer?.files?.length)return false;event.preventDefault();editor.classList.remove('note-file-hover');try{await addLearningImages(Array.from(event.dataTransfer.files),event.target.closest('[data-block-id]')?.dataset.blockId);}catch(e){notify(e.message);}return true;}
document.addEventListener('paste',handleLearningPaste);
document.addEventListener('dragstart',startLearningDrag);
document.addEventListener('dragover',handleLearningDragOver);
document.addEventListener('dragleave',event=>{const editor=event.target.closest('#learning-editor');if(editor&&!editor.contains(event.relatedTarget))editor.classList.remove('note-file-hover');});
document.addEventListener('drop',handleLearningDrop);
document.addEventListener('dragend',clearLearningDrag);

function learningBlockMoves(b,index){return learningPreview?'':`<div class="note-block-moves"><button type="button" class="block-drag-handle" draggable="true" data-note-drag="${b.id}" aria-label="拖动内容块 ${index+1}" title="拖动排序">⋮⋮</button><button type="button" class="link-button" data-action="learn-block-up" data-id="${b.id}" aria-label="上移内容块 ${index+1}" ${index===0?'disabled':''}>↑</button><button type="button" class="link-button" data-action="learn-block-down" data-id="${b.id}" aria-label="下移内容块 ${index+1}" ${index===learningNoteDraft.blocks.length-1?'disabled':''}>↓</button></div>`;}
function renderLearningLanguageControl(b,index){return `<div class="code-language"><span id="language-label-${b.id}">代码语言</span><div class="language-picker" data-language-picker="${b.id}"><button type="button" class="form-control language-toggle" data-action="learn-language-toggle" data-id="${b.id}" data-language-toggle="${b.id}" aria-label="代码语言 ${index+1}" aria-haspopup="listbox" aria-controls="language-list-${b.id}" aria-expanded="${learningLanguageMenuId===b.id}">${esc(b.language)} <span aria-hidden="true">⌄</span></button>${learningLanguageMenuId===b.id?`<div class="language-options" role="listbox" id="language-list-${b.id}" aria-labelledby="language-label-${b.id}">${DayUpLearning.languages.map(l=>`<button type="button" role="option" tabindex="-1" class="language-option" data-action="learn-language-select" data-id="${b.id}" data-language="${l}" data-language-option="${l}" aria-selected="${l===b.language}"><span>${l}</span><span aria-hidden="true">${l===b.language?'✓':''}</span></button>`).join('')}</div>`:''}</div></div>`;}
async function selectLearningLanguage(id,language){
 if(!DayUpLearning.languages.includes(language))throw Error('请选择有效的代码语言');const block=learningNoteDraft?.blocks.find(b=>b.id===id&&b.type==='code');if(!block)throw Error('代码块不存在');
 changeLearningDraft('language',language,id);learningLanguageMenuId='';render();document.querySelector(`[data-language-toggle="${id}"]`)?.focus();await flushLearningNote();
}
function closeLearningLanguagePicker(focus=false){const id=learningLanguageMenuId;learningLanguageMenuId='';document.querySelector('.language-options')?.remove?.();const toggle=document.querySelector(`[data-language-toggle="${id}"]`);toggle?.setAttribute('aria-expanded','false');if(focus)toggle?.focus();}
function handleLearningLanguageKey(event){
 const picker=event.target?.closest?.('[data-language-picker]');if(!picker)return;const id=picker.dataset.languagePicker,b=learningNoteDraft?.blocks.find(b=>b.id===id&&b.type==='code');if(!b)return;
 if(event.key==='Escape'){event.preventDefault();closeLearningLanguagePicker(true);return;}
 if(event.key==='Tab'){closeLearningLanguagePicker(true);return;}
 if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();
 const wasOpen=learningLanguageMenuId===id,current=event.target.dataset.languageOption||b.language,index=DayUpLearning.languages.indexOf(current);
 const next=event.key==='Home'?0:event.key==='End'?DayUpLearning.languages.length-1:wasOpen?(index+(event.key==='ArrowDown'?1:-1)+DayUpLearning.languages.length)%DayUpLearning.languages.length:index;
 if(!wasOpen){learningLanguageMenuId=id;render();}document.querySelector(`[data-language-option="${DayUpLearning.languages[next]}"]`)?.focus();
}
document.addEventListener('keydown',handleLearningLanguageKey);
document.addEventListener('click',event=>{if(learningLanguageMenuId&&!event.target.closest('[data-language-picker]')&&!event.target.closest('[data-action="learn-language-toggle"]'))closeLearningLanguagePicker();});
async function moveLearningBlock(id,targetId,side){
 if(!learningNoteDraft||learningPreview||learningImageBusy)return false;
 const blocks=learningNoteDraft.blocks,next=DayUpLearning.reorderBlocks(blocks,id,targetId,side);if(next.every((b,i)=>b.id===blocks[i].id))return false;
 changeLearningDraft('blocks',next);render();document.querySelector(`[data-note-drag="${id}"]`)?.focus();await flushLearningNote();const status=document.querySelector('#note-reorder-status');if(status)status.textContent=`已移动到第 ${next.findIndex(b=>b.id===id)+1} 个位置并保存`;return true;
}
function clearLearningIndicators(){document.querySelectorAll('.note-drop-before,.note-drop-after').forEach(el=>el.classList.remove('note-drop-before','note-drop-after'));}
function clearLearningDrag(){learningDragId='';learningDragNoteId='';clearLearningIndicators();document.querySelectorAll('.is-dragging').forEach(el=>el.classList.remove('is-dragging'));}
function startLearningDrag(event){
 const handle=event.target.closest('[data-note-drag]'),card=handle?.closest('[data-block-id]')||event.target.closest('[data-block-id]');if(!card)return;
 const id=handle?.dataset.noteDrag||card.dataset.blockId;
 if(learningPreview||learningImageBusy||!learningNoteDraft?.blocks.some(b=>b.id===id)||!handle&&event.target.closest('input,textarea,select,button,a,[contenteditable="true"]')){event.preventDefault();return;}
 learningDragId=id;learningDragNoteId=learningNoteId;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-dayup-block',learningDragId);card.classList.add('is-dragging');
}
document.addEventListener('pointerdown',event=>{const card=event.target.closest('.note-block');if(card)card.draggable=!learningPreview&&!event.target.closest('input,textarea,select,button,a,[contenteditable="true"]')||!!event.target.closest('[data-note-drag]');});
document.addEventListener('pointerup',()=>{document.querySelectorAll('.note-block').forEach(card=>card.draggable=!learningPreview);});
function learningDragTarget(event){
 if(!learningDragId||learningDragNoteId!==learningNoteId||learningPreview||learningImageBusy||!event.target.closest('#learning-editor'))return null;
 const block=event.target.closest('[data-block-id]');if(!block||block.dataset.blockId===learningDragId)return null;
 const rect=block.getBoundingClientRect();return {block,id:block.dataset.blockId,side:event.clientY<rect.top+rect.height/2?'before':'after'};
}
function handleLearningDragOver(event){
 if(handleLearningFileDrag(event))return;const target=learningDragTarget(event);clearLearningIndicators();if(!target)return;
 event.preventDefault();event.dataTransfer.dropEffect='move';target.block.classList.add(target.side==='before'?'note-drop-before':'note-drop-after');
}

function learningPlans(date){return dayPlans(date).filter(p=>p.module==='学习空间'&&p.status!=='cancelled');}
function learningTaskCard(p){const done=p.status==='done';return `<article class="learning-task ${done?'completed':''} ${learningJustCompleted===p.id?'just-completed':''}" draggable="true" data-learning-plan="${p.id}"><button class="check ${done?'checked':''}" data-action="learn-toggle-plan" data-id="${p.id}" aria-label="${done?'标记未完成':'完成学习任务'} ${esc(p.title)}" aria-pressed="${done}">${done?'✓':''}</button><div class="learning-task-copy"><span class="learning-task-title">${esc(p.title)}<svg class="pencil-line" viewBox="0 0 600 16" preserveAspectRatio="none" aria-hidden="true"><path d="M2 9 Q130 4 270 9 T598 7" pathLength="600"/></svg></span><small>${esc(p.time||'待安排')}${done?' · 已完成':''}</small></div><button class="link-button" data-action="learn-edit-plan" data-id="${p.id}" aria-label="修改日期或编辑 ${esc(p.title)}">编辑</button></article>`;}
function learningTaskSection(date,title){const plans=learningPlans(date);return `<section class="card learning-day-tasks" data-learning-drop="${date}"><div class="section-heading"><div><p class="eyebrow">${esc(date)}</p><h2>${title}</h2></div><button class="primary-button" data-action="learn-new-plan" data-date="${date}">＋ 学习任务</button></div><div class="learning-task-grid">${plans.map(learningTaskCard).join('')||empty('这一天还没有学习安排','添加任务和计划时间，也可把日历里的任务拖到这里。')}</div></section>`;}
function renderLearningCalendarDay(date,month){
 const plans=learningPlans(date),done=plans.filter(p=>p.status==='done').length;
 return `<div class="calendar-day learning-calendar-cell ${date.startsWith(month)?'':'outside-month'} ${date===learningDay?'selected':''} ${date===today()?'is-today':''}" data-learning-drop="${date}" data-action="learn-day" data-date="${date}"><button type="button" class="learning-date-select" data-action="learn-day" data-date="${date}" aria-label="${date}，${plans.length} 项学习任务，已完成 ${done} 项" aria-pressed="${date===learningDay}"><span class="day-number">${Number(date.slice(-2))}${date===today()?'<i>今</i>':''}</span>${plans.length?`<span class="calendar-summary primary">${done}/${plans.length} 完成</span>`:''}</button><div class="learning-calendar-tasks">${plans.map(p=>`<button type="button" class="learning-calendar-task ${p.status==='done'?'completed':''}" draggable="true" data-learning-plan="${p.id}" data-action="learn-day" data-date="${date}" title="${esc(p.time||'待安排')} ${esc(p.title)}" aria-label="查看或拖动学习任务：${esc(p.title)}"><small>${esc(p.time||'待安排')}</small><span>${esc(p.title)}</span></button>`).join('')}</div></div>`;
}
function renderLearningHome(){
 learningDay=learningDay||today();learningMonth=learningMonth||learningDay;
 const grid=DayUpCore.monthGrid(learningMonth),month=learningMonth.slice(0,7);for(const d of grid)DayUpCore.ensureOccurrence(state,d);
 return `<div class="page-toolbar"><p class="subtle">今天学一点，知识就多一页。</p><span class="pill">学习首页</span></div>${learningTaskSection(today(),'今日学习计划')}<section class="card section-gap learning-calendar"><div class="section-heading"><div><h2>学习日历</h2><p>任务可在日期之间拖动，也可拖回今日计划。重复任务仅移动本次。</p></div><div class="calendar-navigation"><button class="secondary-button" data-action="learn-month" data-delta="-1" aria-label="学习日历上个月">‹</button><strong>${month.replace('-',' 年 ')} 月</strong><button class="secondary-button" data-action="learn-month" data-delta="1" aria-label="学习日历下个月">›</button><button class="secondary-button" data-action="learn-today" data-learning-drop="${today()}">今天</button></div></div><div class="calendar-grid" role="group" aria-label="学习月历">${['一','二','三','四','五','六','日'].map(d=>`<div class="weekday">${d}</div>`).join('')}${grid.map(d=>renderLearningCalendarDay(d,month)).join('')}</div><div class="learning-calendar-footer"><p id="learning-calendar-status" class="subtle" role="status">选中 ${learningDay} · 也可通过卡片的“编辑”修改日期</p><button type="button" class="secondary-button learning-return-today" data-action="learn-today" data-learning-drop="${today()}" title="把任务拖到这里，安排回今天">↩ 拖回今日计划</button></div></section>${learningDay!==today()?`<div class="section-gap">${learningTaskSection(learningDay,`${esc(learningDay)} 的学习计划`)}</div>`:''}<button class="learning-library-entry card section-gap" data-action="learn-library"><span class="library-icon" aria-hidden="true">${learningShelfIcon()}</span><span><strong>进入笔记书屋</strong><small>打开科目笔记本，让知识一页页积累</small></span><span aria-hidden="true">→</span></button>`;
}
async function handleLearningHomeAction(action,el){
 const d=el.dataset.date;
 if(action==='learn-home'){resetLearningHome();render();return true;}
 if(action==='learn-library'){learningPage='subjects';learningSubjectId='';learningNoteId='';learningNoteDraft=null;render();return true;}
 if(action==='learn-day'){if(DayUpCore.validDate(d)){learningDay=d;render();}return true;}
 if(action==='learn-month'){learningMonth=DayUpCore.addMonths(learningMonth||today(),Number(el.dataset.delta));render();return true;}
 if(action==='learn-today'){learningMonth=learningDay=today();render();return true;}
 if(action==='learn-new-plan'){selectedDate=DayUpCore.validDate(d)?d:today();openPlan({date:selectedDate,module:'学习空间',time:'待安排',status:'todo',recurrence:'不重复',reminder:'不提醒',priority:'普通'});return true;}
 const p=state.plans.find(p=>p.id===el.dataset.id&&p.module==='学习空间');
 if(action==='learn-edit-plan'){if(p)openPlan(p);return true;}
 if(action==='learn-toggle-plan'){if(p){p.status=p.status==='done'?'todo':'done';p.updatedAt=nowIso();learningJustCompleted=p.status==='done'?p.id:'';await save();render();learningJustCompleted='';}return true;}
 return false;
}
async function moveLearningPlan(id,date){
 if(!DayUpCore.validDate(date))throw Error('请选择有效日期');const p=state.plans.find(p=>p.id===id&&p.module==='学习空间'&&p.status!=='cancelled');if(!p)throw Error('学习任务不存在');if(p.date===date)return false;
 p.date=date;p.isTop=false;p.updatedAt=nowIso();await save();learningDay=date;learningMonth=date;render();const status=document.querySelector('#learning-calendar-status');if(status)status.textContent=`已移到 ${date}${p.seriesId?'，仅移动本次安排':''}`;return true;
}
document.addEventListener('dragstart',event=>{const card=event.target.closest('[data-learning-plan]');if(!card)return;const control=event.target.closest('button,input,textarea,select');if(control&&control!==card){event.preventDefault();return;}const plan=state.plans.find(p=>p.id===card.dataset.learningPlan&&p.module==='学习空间'&&p.status!=='cancelled');if(!plan)return;learningPlanDragId=plan.id;event.dataTransfer.setData('application/x-dayup-learning-plan',learningPlanDragId);event.dataTransfer.effectAllowed='move';card.classList?.add('learning-plan-dragging');const status=document.querySelector('#learning-calendar-status');if(status)status.textContent=`正在拖动「${plan.title}」，放到日期或今日计划区域后保存`;});
function handleLearningPlanDragOver(event){const day=event.target.closest('[data-learning-drop]');if(!day||!learningPlanDragId)return;event.preventDefault();event.dataTransfer.dropEffect='move';document.querySelectorAll('.learning-date-over').forEach(e=>e.classList.remove('learning-date-over'));day.classList.add('learning-date-over');const status=document.querySelector('#learning-calendar-status');if(status)status.textContent=`放开后移到 ${day.dataset.learningDrop}`;}
document.addEventListener('dragenter',handleLearningPlanDragOver);
document.addEventListener('dragover',handleLearningPlanDragOver);
document.addEventListener('drop',async event=>{const day=event.target.closest('[data-learning-drop]'),id=learningPlanDragId;if(!day||!id)return;event.preventDefault();learningPlanDragId='';try{if(event.dataTransfer.getData('application/x-dayup-learning-plan')!==id)return;await moveLearningPlan(id,day.dataset.learningDrop);}catch(e){notify(e.message);}finally{document.querySelectorAll('.learning-date-over').forEach(e=>e.classList.remove('learning-date-over'));}});
document.addEventListener('dragend',()=>{if(learningPlanDragId){const status=document.querySelector('#learning-calendar-status');if(status)status.textContent='已取消移动，原安排保留';}learningPlanDragId='';document.querySelectorAll('.learning-date-over').forEach(e=>e.classList.remove('learning-date-over'));document.querySelectorAll('.learning-plan-dragging').forEach(e=>e.classList.remove('learning-plan-dragging'));});
async function handleLearningDrop(event){
 if(event.dataTransfer?.files?.length){await handleLearningFileDrop(event);return;}const target=learningDragTarget(event);if(!target)return clearLearningDrag();event.preventDefault();
 try{if(event.dataTransfer.getData('application/x-dayup-block')!==learningDragId)return;await moveLearningBlock(learningDragId,target.id,target.side);}catch(e){notify(e.message);}finally{clearLearningDrag();}
}
