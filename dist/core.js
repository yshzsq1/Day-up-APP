/* Pure business rules shared by the browser and Node's behavioral tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DayUpCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const Learning=typeof module==='object'&&module.exports?require('./learning-core.js'):globalThis.DayUpLearning;
  const collections = ['plans','memos','projects','devLogs','clients','consultLogs','fitnessPlans','workouts','meals','games','gameSessions'];
  const localDate = (value = new Date()) => `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00`);
    return !Number.isNaN(date.getTime()) && localDate(date) === value;
  }
  function addDays(value, count) { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate()+count); return localDate(date); }
  function addMonths(value, count) {
    const date = new Date(`${value}T12:00:00`), anchor = date.getDate();
    date.setDate(1); date.setMonth(date.getMonth()+count);
    date.setDate(Math.min(anchor, new Date(date.getFullYear(),date.getMonth()+1,0).getDate()));
    return localDate(date);
  }
  function occursOn(series, date) {
    if (date < series.startDate || series.endDate && date > series.endDate) return false;
    if (series.recurrence === '每天') return true;
    if (series.recurrence === '每周') return new Date(`${date}T12:00:00`).getDay() === new Date(`${series.startDate}T12:00:00`).getDay();
    if (series.recurrence === '每月') {
      const a = new Date(`${series.startDate}T12:00:00`), b = new Date(`${date}T12:00:00`);
      return addMonths(series.startDate, (b.getFullYear()-a.getFullYear())*12+b.getMonth()-a.getMonth()) === date;
    }
    return false;
  }
  function baseState() {
    return { version:1, plans:[], memos:[], projects:[], devLogs:[], clients:[], consultLogs:[], fitnessPlans:[], workouts:[], meals:[], games:[], gameSessions:[], series:[], notified:[], settings:{reminders:true}, learning:Learning.empty() };
  }
  function normalise(value) {
    const result = {...baseState(), ...value, settings:{...baseState().settings,...value?.settings}};
    result.learning=Learning.validate(value?.learning);
    for (const key of [...collections,'series','notified']) if (!Array.isArray(result[key])) result[key] = [];
    const stamp = new Date().toISOString();
    for (const key of collections) result[key] = result[key].map(row=>({...row,createdAt:row.createdAt||stamp,updatedAt:row.updatedAt||row.createdAt||stamp}));
    // Older builds stored only repeated occurrences; recover a rule without discarding history.
    for (const row of result.plans) {
      if (row.seriesId && !result.series.some(series=>series.id===row.seriesId)) {
        const group=result.plans.filter(item=>item.seriesId===row.seriesId).sort((a,b)=>a.date.localeCompare(b.date));
        const first=group[0];
        result.series.push({id:row.seriesId,startDate:first.date,recurrence:first.recurrence,template:{...first,isTop:false,status:'todo'},excluded:[]});
      }
      if (row.seriesId) row.originalDate=row.originalDate||row.date;
    }
    return result;
  }
  function ensureOccurrence(data, date) {
    for (const series of data.series) {
      if (!occursOn(series,date) || series.excluded.includes(date)) continue;
      if (data.plans.some(p=>p.seriesId===series.id && (p.originalDate||p.date)===date)) continue;
      const stamp=new Date().toISOString();
      data.plans.push({...series.template,id:`${series.id}_${date}`,seriesId:series.id,originalDate:date,date,isTop:false,status:'todo',createdAt:stamp,updatedAt:stamp});
    }
  }
  function deleteOccurrence(data, id) {
    const plan=data.plans.find(p=>p.id===id);
    if (plan?.seriesId) {
      const series=data.series.find(s=>s.id===plan.seriesId);
      if (series && !series.excluded.includes(plan.originalDate||plan.date)) series.excluded.push(plan.originalDate||plan.date);
    }
    data.plans=data.plans.filter(p=>p.id!==id);
  }
  function validateBackup(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('备份应为 JSON 对象');
    if (value.version != null && value.version !== 1) throw Error('备份版本不受支持');
    const titles={plans:'title',memos:'text',projects:'name',clients:'name',fitnessPlans:'name',games:'name'};
    for (const key of collections) {
      if (!Array.isArray(value[key])) throw Error(`备份缺少 ${key} 数据列表`);
      const ids=new Set();
      for (const row of value[key]) {
        if (!row || typeof row !== 'object' || typeof row.id!=='string' || !/^[\w-]+$/.test(row.id) || ids.has(row.id)) throw Error(`${key} 中有无效或重复的记录编号`);
        ids.add(row.id);
        if (titles[key] && (typeof row[titles[key]]!=='string' || !row[titles[key]].trim())) throw Error(`${key} 中缺少名称或内容`);
        for (const field of ['date','startDate','endDate','nextFollowup','lastPlayed']) if (row[field] && !validDate(row[field])) throw Error(`${key} 的日期无效`);
        if(key==='projects'&&row.items!==undefined)validateProjectItems(row.items);
        if(key==='workouts'&&row.exercises!==undefined)validateExercises(row.exercises);
        for (const field of ['duration','water','calories','protein','progress','rating']) if (row[field]!==undefined && row[field]!=='' && (!Number.isFinite(Number(row[field])) || Number(row[field])<0)) throw Error(`${key} 的数值无效`);
        if (row.progress!=null && Number(row.progress)>100 || row.rating!=null && Number(row.rating)>10) throw Error(`${key} 的进度或评分超出范围`);
        if (key==='plans') {
          if (!validDate(row.date) || !['todo','doing','done','cancelled'].includes(row.status)) throw Error('计划日期或状态无效');
          if (row.time && !['全天','待安排'].includes(row.time) && !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time)) throw Error('计划时间无效');
          if (row.recurrence && !['不重复','每天','每周','每月'].includes(row.recurrence)) throw Error('计划重复规则无效');
        }
      }
    }
    if (!value.settings || typeof value.settings!=='object' || typeof value.settings.reminders!=='boolean') throw Error('提醒设置无效');
    if (value.series!==undefined) {
      if (!Array.isArray(value.series)) throw Error('重复规则格式无效');
      const ids=new Set();
      for (const series of value.series) {
        if (!series || typeof series.id!=='string' || !/^[\w-]+$/.test(series.id) || ids.has(series.id) || !validDate(series.startDate) || !['每天','每周','每月'].includes(series.recurrence) || !series.template || !Array.isArray(series.excluded) || series.excluded.some(date=>!validDate(date))) throw Error('重复规则无效');
        ids.add(series.id);
      }
    }
    const copy=normalise(JSON.parse(JSON.stringify(value)));
    for (const date of new Set(copy.plans.map(p=>p.date))) {
      if (copy.plans.filter(p=>p.date===date && p.isTop).length>3) throw Error('同一天重点事项不能超过三件');
    }
    if (!Array.isArray(copy.notified) || copy.notified.some(key=>typeof key!=='string')) throw Error('提醒历史无效');
    return copy;
  }
  function assertForm(kind, row, data) {
    const required={plan:'title',project:'name',devlog:'content',client:'name',consultlog:'summary',workout:'detail',fitnessplan:'name',meal:'foods',game:'name'};
    if (required[kind] && !String(row[required[kind]]||'').trim()) throw Error('请填写必要的名称或内容');
    for (const field of ['date','startDate','endDate','nextFollowup']) if (row[field] && !validDate(row[field])) throw Error('请选择有效日期');
    if (kind==='project' && row.startDate && row.endDate && row.endDate<row.startDate) throw Error('截止日期不能早于开始日期');
    for (const field of ['duration','water','calories','protein','progress','rating']) {
      if (row[field]!==undefined && row[field]!=='' && (!Number.isFinite(Number(row[field])) || Number(row[field])<0)) throw Error('数值不能为负数');
    }
    if (Number(row.progress)>100 || Number(row.rating)>10) throw Error('进度应在 0–100，评分应在 0–10');
    if (kind==='water' && !(Number(row.water)>0)) throw Error('饮水量应大于 0');
    if (kind==='consultlog' && !data.clients.some(c=>c.id===row.clientId)) throw Error('请先添加并选择客户');
    if (kind==='session' && !data.games.some(g=>g.id===row.gameId)) throw Error('请选择游戏');
    if(kind==='devitem'){
      if(!data.projects.some(p=>p.id===row.projectId))throw Error('请选择有效项目');
      validateProjectItems([{...row,id:row.id||'new'}]);
    }
    if(kind==='workout'&&row.exercises!==undefined)validateExercises(row.exercises);
  }
  function validateProjectItems(items){
    if(!Array.isArray(items))throw Error('项目事项格式无效');
    const ids=new Set();
    for(const item of items){
      if(!item||typeof item.id!=='string'||!/^[\w-]+$/.test(item.id)||ids.has(item.id)||!String(item.title||'').trim()||!['task','issue','milestone'].includes(item.kind)||!['待处理','进行中','阻塞','已完成'].includes(item.status))throw Error('项目事项名称、类型或状态无效');
      ids.add(item.id);
      if(item.dueDate&&!validDate(item.dueDate))throw Error('项目事项截止日期无效');
      if(item.estimate!==undefined&&item.estimate!==''&&(!Number.isFinite(Number(item.estimate))||Number(item.estimate)<0))throw Error('预计耗时不能为负数');
    }
  }
  function validateExercises(exercises){
    if(!Array.isArray(exercises))throw Error('训练动作格式无效');
    for(const row of exercises){
      if(!row||!String(row.name||'').trim()||!String(row.bodyPart||'').trim())throw Error('请填写每个动作的部位和名称');
      for(const key of ['sets','reps'])if(!Number.isInteger(Number(row[key]))||Number(row[key])<=0)throw Error('动作组数和每组次数必须为正整数');
      if(row.weight!==undefined&&row.weight!==''&&(!Number.isFinite(Number(row.weight))||Number(row.weight)<0))throw Error('训练重量不能为负数');
    }
  }
  function monthGrid(date){
    if(!validDate(date))throw Error('无效月份');
    const first=date.slice(0,7)+'-01',weekday=(new Date(`${first}T12:00:00`).getDay()+6)%7;
    const last=addDays(addMonths(first,1),-1),length=Number(last.slice(-2));
    return Array.from({length:Math.ceil((weekday+length)/7)*7},(_,i)=>addDays(first,i-weekday));
  }
  function dueReminders(data,now=new Date()) {
    if (!data.settings.reminders) return [];
    return data.plans.filter(plan=>{
      if(['done','cancelled'].includes(plan.status)||!plan.time||['全天','待安排'].includes(plan.time)||!plan.reminder||plan.reminder==='不提醒')return false;
      const target=new Date(`${plan.date}T${plan.time}:00`).getTime()-Number(plan.reminder)*60000;
      const key=`${plan.id}:${target}`;
      return now.getTime()>=target && now.getTime()-target<5*60000 && !data.notified.includes(key);
    });
  }
  return {collections,localDate,validDate,addDays,addMonths,occursOn,baseState,normalise,ensureOccurrence,deleteOccurrence,validateBackup,assertForm,dueReminders,validateProjectItems,validateExercises,monthGrid};
});
