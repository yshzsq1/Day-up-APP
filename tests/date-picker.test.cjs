const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../dist/scripts/pickers.js'),{harness}=require('./picker-harness.cjs'),{createApp}=require('./app-harness.cjs');
test('主题日历以周一开始，包含闰日且不会提供无效日期',()=>{
 const cells=P.calendarCells(2024,2);assert.equal(cells.length,42);assert.equal(cells[3],'2024-02-01');assert.ok(cells.includes('2024-02-29'));assert.ok(!P.calendarCells(2025,2).includes('2025-02-29'));
 for(const year of [1,99,1900,2000,2026,9999])for(let month=1;month<=12;month++)for(const day of P.calendarCells(year,month).filter(Boolean))assert.ok(P.validDate(day),day);
 for(const invalid of ['2026-02-30','2026-13-01','0000-01-01','2026-1-1','2026-04-31'])assert.equal(P.validDate(invalid),false);
 assert.deepEqual(P.shiftMonth(2026,12,1),{year:2027,month:1});assert.deepEqual(P.shiftMonth(1,1,-1),{year:1,month:1});assert.deepEqual(P.shiftMonth(9999,12,1),{year:9999,month:12});
});
test('小日历定位在视口内，底部空间不足时向上展开',()=>{
 assert.deepEqual(P.placement({left:100,top:40,bottom:72},{width:304,height:340},{width:1024,height:768}),{left:100,top:80});
 const p=P.placement({left:470,top:600,bottom:632},{width:304,height:340},{width:496,height:696});assert.equal(p.left,180);assert.equal(p.top,252);assert.ok(p.top+340<=684);
});
test('打开日期控件截获原生弹层，选中日期只触发原有字段事件并关闭',()=>{
 const h=harness();let native=0;h.doc.addEventListener('click',()=>native++);
 h.click(h.trigger);assert.equal(native,0);assert.equal(h.panel.shown,true);assert.equal(h.trigger.getAttribute('aria-expanded'),'true');assert.equal(h.doc.activeElement.dataset.date,'2026-10-29');
 h.click(h.panel.querySelector('[data-date="2026-10-31"]'));assert.equal(h.input.value,'2026-10-31');assert.equal(h.panel,undefined);assert.deepEqual(h.emitted,[{type:'input',value:'2026-10-31'},{type:'change',value:'2026-10-31'}]);assert.equal(h.doc.activeElement,h.input);
});
test('切月与跳转年份月份不提前修改字段，非法年份不能提交',()=>{
 const h=harness('2026-12-31');h.click(h.trigger);h.click(h.panel.querySelector('[data-picker="next"]'));assert.ok(h.panel.innerHTML.includes('2027年1月'));assert.equal(h.input.value,'2026-12-31');
 h.click(h.panel.querySelector('[data-picker="mode"]'));let y=h.panel.querySelector('[data-picker-year]');y.value='0';h.click(h.panel.querySelector('[data-month="2"]'));assert.equal(y.invalid,true);assert.equal(h.input.value,'2026-12-31');y.value='2028';h.click(h.panel.querySelector('[data-month="2"]'));assert.ok(h.panel.querySelector('[data-date="2028-02-29"]'));h.click(h.panel.querySelector('[data-date="2028-02-29"]'));assert.equal(h.input.value,'2028-02-29');
});
test('Escape 只关闭日历并恢复入口焦点，外点关闭与必填/可选清空正确',()=>{
 const h=harness('',true);h.click(h.trigger);assert.equal(h.panel.querySelector('[data-picker="clear"]'),null);const e=h.dispatch('keydown',h.doc.activeElement,{key:'Escape'});assert.equal(e.stopped,true);assert.equal(h.panel,undefined);assert.equal(h.doc.activeElement,h.trigger);assert.equal(h.emitted.length,0);
 const optional=harness();optional.click(optional.trigger);optional.dispatch('pointerdown',optional.input);assert.equal(optional.panel,undefined);assert.equal(optional.input.value,'2026-10-29');optional.click(optional.trigger);optional.click(optional.panel.querySelector('[data-picker="clear"]'));assert.equal(optional.input.value,'');
});
test('方向键跨月、PageDown 月末截断、Tab 焦点约束均保留未确认值',()=>{
 const h=harness('2026-01-31');h.click(h.trigger);h.dispatch('keydown',h.doc.activeElement,{key:'PageDown'});assert.equal(h.doc.activeElement.dataset.date,'2026-02-28');h.dispatch('keydown',h.doc.activeElement,{key:'ArrowRight'});assert.equal(h.doc.activeElement.dataset.date,'2026-03-01');assert.equal(h.input.value,'2026-01-31');
 const first=h.panel.querySelector('[data-picker="previous"]');first.focus();h.dispatch('keydown',first,{key:'Tab',shiftKey:true});assert.equal(h.doc.activeElement.dataset.picker,'close');
});
test('主题日历选出的闰日进入现有项目保存、编辑与备份流程',async()=>{
 const h=harness('2028-02-01');h.click(h.trigger);h.click(h.panel.querySelector('[data-date="2028-02-29"]'));const a=await createApp();await a.submit('project',{name:'日期选择验收',endDate:h.input.value});const p=a.snapshot().projects[0];assert.equal(p.endDate,'2028-02-29');const C=require('../dist/core.js');assert.equal(C.validateBackup(a.snapshot()).projects[0].endDate,'2028-02-29');
});
