const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const init=fs.readFileSync('dist/scripts/theme-init.js','utf8'),controller=fs.readFileSync('dist/scripts/theme.js','utf8');
function environment({saved=null,dark=false,denyRead=false,denyWrite=false}={}){
 const rootAttrs={'data-theme':'soda'},writes=[],attrs=[],listeners={},business={draft:'未保存的项目名称',focus:'title',selectedDate:'2026-11-04',scroll:123,children:[{}]};
 const root={setAttribute(k,v){assert.equal(k,'data-theme');attrs.push([k,v]);rootAttrs[k]=v;},getAttribute(k){return rootAttrs[k];}};
 const storage=new Map([['app-theme',saved],['dayup-data','existing data']]);
 const context=vm.createContext({document:{documentElement:root,addEventListener(type,fn){(listeners[type]??=[]).push(fn);}},window:{matchMedia(q){assert.equal(q,'(prefers-color-scheme: dark)');return {matches:dark};}},localStorage:{getItem(k){assert.equal(k,'app-theme');if(denyRead)throw Error('denied');return storage.get(k);},setItem(k,v){assert.equal(k,'app-theme');writes.push([k,v]);if(denyWrite)throw Error('quota');storage.set(k,v);}}});
 const run=source=>vm.runInContext(source,context);
 const click=theme=>(listeners.click||[]).forEach(fn=>fn({target:{closest(selector){assert.equal(selector,'[data-theme-choice]');return theme===null?null:{dataset:{themeChoice:theme}};}}}));
 const key=(overrides={})=>{let prevented=false;const event={key:'T',ctrlKey:true,metaKey:false,shiftKey:true,altKey:false,repeat:false,preventDefault(){prevented=true;},...overrides};(listeners.keydown||[]).forEach(fn=>fn(event));return prevented;};
 return {run,click,key,business,writes,attrs,listeners,storage,get theme(){return rootAttrs['data-theme'];}};
}
test('首次外观跟随系统，已保存的每一种有效选择优先',()=>{
 for(const dark of [false,true]){const e=environment({dark});e.run(init);assert.equal(e.theme,dark?'prism':'soda');assert.equal(e.writes.length,0);}
 for(const saved of ['soda','prism','brut']){const e=environment({saved,dark:true});e.run(init);assert.equal(e.theme,saved);}
});
test('无效外观不会写入根节点，存储读取失败安静回退浅色',()=>{
 const invalid=environment({saved:'<script>',dark:true});invalid.run(init);assert.equal(invalid.theme,'prism');
 const denied=environment({saved:'brut',dark:true,denyRead:true});assert.doesNotThrow(()=>denied.run(init));assert.equal(denied.theme,'soda');
});
test('点击与快捷键切换只修改外观属性和独立偏好，不读取或重建业务 DOM',()=>{
 const e=environment(),before=structuredClone(e.business),child=e.business.children[0];e.run(init);e.run(controller);
 for(let i=0;i<12;i++)e.click(['soda','prism','brut'][i%3]);
 assert.equal(e.theme,'brut');assert.equal(e.writes.length,12);assert.ok(e.key());assert.equal(e.theme,'soda');
 assert.deepEqual(e.business,before);assert.equal(e.business.children[0],child);assert.equal(e.storage.get('dayup-data'),'existing data');
 assert.equal(e.listeners.click.length,1);assert.equal(e.listeners.keydown.length,1);
 const refreshed=environment({saved:e.storage.get('app-theme'),dark:true});refreshed.run(init);assert.equal(refreshed.theme,'soda');
});
test('普通点击、无效主题、输入按键和持续按住快捷键不触发外观切换',()=>{
 const e=environment();e.run(controller);e.click(null);e.click('invalid');
 for(const change of [{shiftKey:false},{ctrlKey:false},{repeat:true},{altKey:true},{key:'a'}])assert.equal(e.key(change),false);
 assert.equal(e.writes.length,0);assert.equal(e.attrs.length,0);
 assert.ok(e.key({ctrlKey:false,metaKey:true}));assert.equal(e.theme,'prism');
});
test('存储写入失败仍可切换外观，不影响后续按钮和快捷键',()=>{
 const e=environment({denyWrite:true});e.run(controller);assert.doesNotThrow(()=>e.click('brut'));assert.equal(e.theme,'brut');assert.doesNotThrow(()=>e.key());assert.equal(e.theme,'soda');
});
test('初始化脚本在样式前执行，主题入口不复用业务操作属性',()=>{
 const html=fs.readFileSync('dist/index.html','utf8');
 assert.ok(html.indexOf('scripts/theme-init.js')<html.indexOf('rel="stylesheet"'));
 for(const [,button]of html.matchAll(/(<button[^>]*data-theme-choice[^>]*>)/g)){assert.match(button,/type="button"/);assert.match(button,/aria-label=/);assert.doesNotMatch(button,/data-action=|data-view=/);}
 assert.equal((html.match(/src="\.\/scripts\/theme.js"/g)||[]).length,1);
 assert.doesNotMatch(controller,/innerHTML|outerHTML|createElement|\.focus\(|fetch\(|indexedDB/);
});
