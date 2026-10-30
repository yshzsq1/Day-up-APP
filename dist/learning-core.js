(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DayUpLearning=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const empty=()=>({subjects:[],sessions:[],notes:[]});
 const idOK=id=>typeof id==='string'&&/^[\w-]+$/.test(id);
 const text=(v,max=10000)=>typeof v==='string'&&v.length<=max;
 const dateOK=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(new Date(v+'T12:00:00').getTime())&&new Date(v+'T12:00:00').toISOString().slice(0,10)===v;
 function rows(value,label){if(!Array.isArray(value))throw Error(`${label}列表格式无效`);const ids=new Set();for(const r of value){if(!r||!idOK(r.id)||ids.has(r.id))throw Error(`${label}编号无效或重复`);ids.add(r.id);}return value;}
 function validate(value){
  if(value===undefined)return empty();
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('学习数据格式无效');
  const result=JSON.parse(JSON.stringify(value));
  rows(result.subjects,'科目');rows(result.sessions,'学习记录');rows(result.notes,'笔记');
  for(const s of result.subjects){if(!text(s.name,120)||!s.name.trim()||!['进行中','暂停','已完成','归档'].includes(s.status)||s.targetDate&&!dateOK(s.targetDate))throw Error('科目名称、状态或日期无效');rows(s.units,'章节');for(const u of s.units)if(!text(u.title,300)||!u.title.trim()||typeof u.done!=='boolean')throw Error('章节名称或完成状态无效');}
  for(const s of result.sessions)if(!result.subjects.some(x=>x.id===s.subjectId)||!dateOK(s.date)||!Number.isInteger(Number(s.duration))||Number(s.duration)<=0||Number(s.duration)>1440||!text(s.content,5000))throw Error('学习记录的科目、日期、时长或内容无效');
  for(const n of result.notes)validateNote(n,result.subjects);
  return result;
 }
 function stats(data,subjectId,date){
  const subjects=data.subjects.filter(s=>!subjectId||s.id===subjectId),sessions=data.sessions.filter(s=>(!subjectId||s.subjectId===subjectId)&&s.date<=date);
  const units=subjects.flatMap(s=>s.units),done=units.filter(u=>u.done).length;
  const days=Array.from({length:7},(_,i)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()-6+i);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;return {date:key,minutes:sessions.filter(s=>s.date===key).reduce((n,s)=>n+Number(s.duration),0)};});
  return {units:units.length,done,progress:units.length?Math.round(done/units.length*100):0,minutes:sessions.reduce((n,s)=>n+Number(s.duration),0),today:days[6].minutes,week:days.reduce((n,d)=>n+d.minutes,0),days};
 }
 const languages=['python','java','javascript','typescript','sql','json','html','css','bash','text'];
 function validateNote(n,subjects){
  if(!subjects.some(s=>s.id===n.subjectId)||!text(n.title,160)||!n.title.trim()||!Array.isArray(n.tags)||n.tags.length>20||n.tags.some(t=>!text(t,40)))throw Error('笔记科目、标题或标签无效');
  rows(n.blocks,'笔记内容块');if(n.blocks.length>100)throw Error('每篇笔记最多 100 个内容块');
  for(const b of n.blocks){if(b.type==='image'){validateImage(b);continue;}if(!['text','code'].includes(b.type)||!text(b.content,200000)||b.type==='code'&&!languages.includes(b.language))throw Error('笔记内容块或代码语言无效');}
 }
 const maxImageBytes=5*1024*1024;
 function validateImage(b){
  if(!text(b.name,300)||!text(b.caption,5000)||typeof b.src!=='string'||b.src.length>Math.ceil(maxImageBytes/3)*4+50)throw Error('截图名称、说明或大小无效（单张最多 5MB）');
  const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(b.src);if(!match||match[2].length%4)throw Error('截图仅支持 PNG、JPEG、WebP 本地图片');
  const payload=match[2],size=payload.length/4*3-(payload.endsWith('==')?2:payload.endsWith('=')?1:0);if(size>maxImageBytes)throw Error('单张截图最多 5MB');
  const head=typeof atob==='function'?atob(payload.slice(0,48)):Buffer.from(payload.slice(0,48),'base64').toString('binary');
  const png=head.startsWith('\x89PNG\r\n\x1a\n')&&head.slice(12,16)==='IHDR',jpeg=head.startsWith('\xff\xd8\xff'),webp=head.startsWith('RIFF')&&head.slice(8,12)==='WEBP';
  if(!({png,jpeg,webp}[match[1]]))throw Error('截图内容与图片格式不符');return size;
 }
 function escape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 function highlight(code,language){
  if(language==='text')return escape(code);
  const pattern=/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|#[^\n]*|\b(?:def|class|return|if|else|elif|for|while|in|import|from|as|try|except|with|print|True|False|None|public|private|static|void|int|String|new|extends|implements|throw|throws|boolean|final|package|const|let|function|async|await|select|SELECT|FROM|WHERE)\b|\b\d+(?:\.\d+)?\b)/g;
  return code.split(pattern).map((part,i)=>{if(i%2===0)return escape(part);const kind=/^(#|\/\/)/.test(part)?'comment':/^["']/.test(part)?'string':/^\d/.test(part)?'number':'keyword';return `<span class="syntax-${kind}">${escape(part)}</span>`;}).join('');
 }
 function searchNotes(notes,subjectId,query){const q=String(query||'').trim().toLocaleLowerCase();return notes.filter(n=>n.subjectId===subjectId&&(!q||[n.title,...n.tags,...n.blocks.map(b=>b.content||b.caption||'')].join('\n').toLocaleLowerCase().includes(q))).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));}
 function reorderBlocks(blocks,source,target,side){
  if(!['before','after'].includes(side))throw Error('无效的插入位置');
  const moving=blocks.find(b=>b.id===source);if(!moving||!blocks.some(b=>b.id===target))throw Error('内容块不存在');if(source===target)return blocks.slice();
  const next=blocks.filter(b=>b.id!==source),index=next.findIndex(b=>b.id===target);next.splice(index+(side==='after'?1:0),0,moving);return next;
 }
 return {empty,validate,stats,rows,dateOK,text,languages,validateNote,validateImage,maxImageBytes,highlight,searchNotes,reorderBlocks};
});
