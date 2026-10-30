const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
test('本地打包预览携带根目录许可证，排除个人备份及测试输出，不生成发布包',()=>{
 const root=path.resolve(__dirname,'..'),npm=process.env.npm_execpath||path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
 const before=fs.readdirSync(root).filter(f=>f.endsWith('.tgz'));
 const output=execFileSync(process.execPath,[npm,'pack','--dry-run','--ignore-scripts','--json','--cache',path.join(root,'test-results/npm-cache')],{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});
 const files=JSON.parse(output)[0].files,license=files.find(f=>f.path==='LICENSE');assert.ok(license,'分发包必须包含根许可证');assert.equal(license.size,fs.statSync(path.join(root,'LICENSE')).size);assert.ok(license.size>1000);
 assert.ok(!files.some(f=>/^(?:backups|test-results|\.git)\//.test(f.path)),'不得打包个人备份、测试输出或 Git 数据');assert.deepEqual(fs.readdirSync(root).filter(f=>f.endsWith('.tgz')),before,'预览不得创建发布包');
 assert.ok(!files.some(f=>/(?:^|\/)(?:__pycache__|node_modules|release)(?:\/|$)|\.(?:pyc|log|tmp|bak|pem|key)$|(?:^|\/)\.env(?:\.|$)/.test(f.path)),'不得打包编译缓存、环境配置或临时文件');assert.ok(!files.some(f=>f.path==='AGENTS.md'),'不打包内部协作约定');
 assert.match(fs.readFileSync(path.join(root,'LICENSE'),'utf8'),/^Copyright \(c\) \d{4} DayUp contributors$/m);
});
