const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
test('已审查的业务、存储、备份与接口代码与验收快照一致',()=>{
 const hashes=require('./visual-protected.json');
 for(const [file,expected] of Object.entries(hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),expected,file);
});
test('业务样式没有裸颜色，三个主题只更改语义变量且不改变边框布局',()=>{
 for(const file of ['dist/styles.css',...fs.readdirSync('dist/styles').filter(f=>!['tokens.css','themes.css'].includes(f)).map(f=>'dist/styles/'+f)]){
  const css=fs.readFileSync(file,'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.doesNotMatch(css,/#(?:[\da-f]{3}){1,2}\b|rgba?\(/i,file);
  if(file.endsWith('styles.css'))assert.doesNotMatch(css,/!important/);
 }
 const themes=fs.readFileSync('dist/styles/themes.css','utf8');
 for(const skin of ['soda','prism','brut'])assert.ok((fs.readFileSync('dist/styles/tokens.css','utf8')+themes).includes(`[data-theme="${skin}"]`));
 for(const rule of themes.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/\{([^{}]*)\}/g))for(const declaration of rule[1].split(';').filter(x=>x.trim()))assert.match(declaration.trim(),/^(?:--[\w-]+|color-scheme)\s*:/);
 assert.match(themes,/@supports not/);
});
test('所有原导航与交互挂载点保留，样式资源可离线加载',()=>{
 const html=fs.readFileSync('dist/index.html','utf8');
 for(const id of ['app','page-title','header-date','quick-add','modal-root','toast'])assert.ok(html.includes(`id="${id}"`));
 for(const view of ['overview','plans','development','consulting','fitness','diet','games','settings'])assert.ok(html.includes(`data-view="${view}"`));
 for(const [,href]of html.matchAll(/<link[^>]+href="\.\/([^"]+)"/g))assert.ok(fs.existsSync('dist/'+href));
 assert.doesNotMatch(html,/https?:\/\/|@import/);
});
test('三套主题正文、次要文字、按钮和状态标签达到可读对比度',()=>{
 const source=['tokens','themes'].map(f=>fs.readFileSync(`dist/styles/${f}.css`,'utf8')).join('\n').replace(/\/\*[\s\S]*?\*\//g,'');
 function palette(skin){const vars={};for(const [,selectors,body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g))if(selectors.includes(':root')||selectors.includes(`[data-theme="${skin}"]`))for(const [,key,value]of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g))vars[key]=value.trim();return vars;}
 function rgb(v){if(v[0]==='#')return [...v.slice(1).matchAll(/../g)].map(x=>parseInt(x[0],16)).concat(1);return v.match(/[\d.]+/g).map(Number);}
 function over(f,b){const a=f[3]??1;return f.slice(0,3).map((n,i)=>n*a+b[i]*(1-a)).concat(1);}
 function lum(c){return c.slice(0,3).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);}
 function ratio(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
 for(const skin of ['soda','prism','brut']){const p=palette(skin),canvas=rgb(p['--bg-canvas']);
  const c=k=>over(rgb(p[k]),canvas);
  for(const bg of ['--bg-canvas','--bg-surface','--bg-surface-2','--bg-elevated','--sidebar-bg','--nav-active'])for(const fg of ['--text-primary','--text-secondary','--text-muted'])assert.ok(ratio(c(fg),c(bg))>=4.5,`${skin} ${fg}/${bg}: ${ratio(c(fg),c(bg)).toFixed(2)}`);
  for(const bg of ['--accent','--accent-hover'])assert.ok(ratio(c('--on-accent'),c(bg))>=4.5,`${skin} button ${bg}`);
  for(const s of ['success','warning','danger','info'])assert.ok(ratio(c(`--state-${s}`),over(rgb(p[`--state-${s}-soft`]),c('--bg-elevated')))>=4.5,`${skin} ${s}`);
 }
});
test('原有换行规则保留，样式转换没有产生无效属性名',()=>{
 const css=fs.readFileSync('dist/styles.css','utf8');
 assert.doesNotMatch(css,/var\(--[^)]*\)-[a-z]+\s*:/);
 assert.match(css,/\.preserve-lines\s*\{white-space:pre-wrap\}/);
 assert.match(css,/\.task-copy strong\{[^}]*white-space:nowrap/);
});
