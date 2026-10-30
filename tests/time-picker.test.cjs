const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../dist/scripts/pickers.js'),{harness}=require('./picker-harness.cjs'),{createApp}=require('./app-harness.cjs');
function timeHarness(value='全天',special=true){
 const h=harness(),select=h.doc.createElement('select'),label=h.doc.createElement('label');
 select.id='field-time';select.setAttribute('data-field','time');select.setAttribute('name','plan__unique__time');label.setAttribute('for',select.id);h.modal.appendChild(label);h.modal.appendChild(select);
 for(const v of [...special?['全天','待安排']:[],...Array.from({length:288},(_,i)=>`${String(Math.floor(i/12)).padStart(2,'0')}:${String(i%12*5).padStart(2,'0')}`),...P.validTime(value)?[value]:[]]){const o=h.doc.createElement('option');o.value=v;select.appendChild(o);}
 select.value=value;h.mutate();
 return {...h,select,label,timeTrigger:h.doc.getElementById('field-time-trigger'),get panel(){return h.panel;}};
}
test('时间长列表被单一可访问按钮替代，原字段名称和值保持，不重复装饰',()=>{
 const h=timeHarness();assert.equal(h.select.hidden,true);assert.equal(h.select.getAttribute('name'),'plan__unique__time');assert.equal(h.select.value,'全天');assert.equal(h.timeTrigger.type,'button');assert.equal(h.timeTrigger.textContent,'全天');assert.equal(h.label.getAttribute('for'),h.timeTrigger.id);for(let i=0;i<10;i++)h.mutate();assert.equal(h.doc.querySelectorAll('[data-time-for]').length,1);
});
test('紧凑面板只展示24小时和12分钟项，确认前不修改字段，23:55正确回填',()=>{
 const h=timeHarness();h.click(h.timeTrigger);assert.equal(h.panel.querySelectorAll('[data-picker="hour"]').length,24);assert.equal(h.panel.querySelectorAll('[data-picker="minute"]').length,12);
 h.click(h.panel.querySelector('[data-hour="23"]'));h.click(h.panel.querySelector('[data-minute="55"]'));assert.equal(h.select.value,'全天');assert.equal(h.emitted.length,0);h.click(h.panel.querySelector('[data-picker="apply"]'));assert.equal(h.select.value,'23:55');assert.equal(h.timeTrigger.textContent,'23:55');assert.equal(h.panel,undefined);assert.equal(h.doc.activeElement,h.timeTrigger);assert.deepEqual(h.emitted,[{type:'input',value:'23:55'},{type:'change',value:'23:55'}]);
});
test('取消、Escape与外点均丢弃未确认时间，不关闭原编辑弹窗',()=>{
 for(const method of ['cancel','escape','outside']){const h=timeHarness('12:30');h.click(h.timeTrigger);h.click(h.panel.querySelector('[data-hour="18"]'));if(method==='cancel')h.click(h.panel.querySelector('[data-picker="close"]'));if(method==='escape')assert.equal(h.dispatch('keydown',h.doc.activeElement,{key:'Escape'}).stopped,true);if(method==='outside')h.dispatch('pointerdown',h.input);assert.equal(h.panel,undefined);assert.equal(h.select.value,'12:30');assert.equal(h.emitted.length,0);assert.ok(h.modal.isConnected);}
});
test('全天与待安排保留，餐食控件只允许具体时间',()=>{
 for(const special of ['全天','待安排']){const h=timeHarness('09:00');h.click(h.timeTrigger);h.click(h.panel.querySelector(`[data-value="${special}"]`));assert.equal(h.select.value,special);}
 const meal=timeHarness('08:00',false);meal.click(meal.timeTrigger);assert.equal(meal.panel.querySelectorAll('[data-picker="special"]').length,0);meal.click(meal.panel.querySelector('[data-hour="0"]'));meal.click(meal.panel.querySelector('[data-minute="0"]'));meal.click(meal.panel.querySelector('[data-picker="apply"]'));assert.equal(meal.select.value,'00:00');
});
test('全天初始高亮不与具体时分混淆，直接确认保留全天，选择时分后更新高亮',()=>{
 const h=timeHarness();h.click(h.timeTrigger);assert.equal(h.panel.querySelectorAll('[aria-pressed="true"]').length,1);assert.equal(h.panel.querySelector('[aria-pressed="true"]').dataset.value,'全天');h.click(h.panel.querySelector('[data-picker="apply"]'));assert.equal(h.select.value,'全天');h.click(h.timeTrigger);h.click(h.panel.querySelector('[data-hour="18"]'));assert.equal(h.panel.querySelector('[data-value="全天"]').getAttribute('aria-pressed'),'false');assert.equal(h.panel.querySelector('[data-hour="18"]').getAttribute('aria-pressed'),'true');assert.equal(h.panel.querySelector('[data-minute="0"]').getAttribute('aria-pressed'),'true');
});
test('编辑旧备份的非五分钟时间不会丢失；选择其他小时仍保留分钟',()=>{
 const h=timeHarness('13:17');h.click(h.timeTrigger);assert.ok(h.panel.querySelector('[data-minute="17"]'));h.click(h.panel.querySelector('[data-picker="apply"]'));assert.equal(h.select.value,'13:17');h.click(h.timeTrigger);h.click(h.panel.querySelector('[data-hour="7"]'));h.click(h.panel.querySelector('[data-picker="apply"]'));assert.equal(h.select.value,'07:17');assert.ok(h.select.options.some(o=>o.value==='07:17'));
});
test('小时和分钟支持方向键、Home/End；Tab约束与Escape恢复按钮焦点',()=>{
 const h=timeHarness('09:00');h.click(h.timeTrigger);h.dispatch('keydown',h.doc.activeElement,{key:'ArrowDown'});assert.equal(h.doc.activeElement.dataset.hour,'13');h.dispatch('keydown',h.doc.activeElement,{key:'End'});assert.equal(h.doc.activeElement.dataset.hour,'23');h.click(h.panel.querySelector('[data-minute="0"]'));h.dispatch('keydown',h.doc.activeElement,{key:'ArrowRight'});assert.equal(h.doc.activeElement.dataset.minute,'5');
 const first=h.panel.querySelector('[data-picker="close"]');first.focus();h.dispatch('keydown',first,{key:'Tab',shiftKey:true});assert.equal(h.doc.activeElement.dataset.picker,'apply');h.dispatch('keydown',h.doc.activeElement,{key:'Escape'});assert.equal(h.doc.activeElement,h.timeTrigger);assert.equal(h.select.value,'09:00');
});
test('选择日期后再选时间只保留一个面板，取消时间不丢失其他字段',()=>{
 const h=timeHarness();h.click(h.trigger);h.click(h.panel.querySelector('[data-date="2026-10-31"]'));h.click(h.timeTrigger);assert.equal(h.doc.querySelectorAll('.picker-panel').length,1);h.click(h.panel.querySelector('[data-picker="close"]'));assert.equal(h.input.value,'2026-10-31');assert.equal(h.select.value,'全天');
});
test('控件确认的时间按原有逻辑进入计划、提醒和餐食保存与备份',async()=>{
 const h=timeHarness('全天');h.click(h.timeTrigger);h.click(h.panel.querySelector('[data-hour="18"]'));h.click(h.panel.querySelector('[data-minute="30"]'));h.click(h.panel.querySelector('[data-picker="apply"]'));
 const a=await createApp();await a.submit('plan',{title:'时间控件验收',date:'2026-10-31',time:h.select.value,module:'个人',recurrence:'不重复',reminder:'15',priority:'普通',status:'待处理',isTop:'否'});await a.submit('meal',{date:'2026-10-31',name:'晚餐',foods:'验收餐食',time:h.select.value});const C=require('../dist/core.js'),saved=C.validateBackup(a.snapshot());assert.equal(saved.plans[0].time,'18:30');assert.equal(saved.plans[0].reminder,'15');assert.equal(saved.meals[0].time,'18:30');const reopened=await createApp(saved);assert.equal(reopened.snapshot().plans[0].time,'18:30');
});
