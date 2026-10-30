import {spawnSync} from 'node:child_process';
import {readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
mkdirSync('test-results',{recursive:true});
const run=(command,args)=>{
  const result=spawnSync(command,args,{encoding:'utf8',windowsHide:true});
  return {passed:result.status===0,output:(result.stdout||'')+(result.stderr||'')+(result.error?.message||'')};
};
const syntax=['app','core','storage','backup','features','learning-core','learning'].map(name=>({file:`dist/${name}.js`,...run(process.execPath,['--check',`dist/${name}.js`])}));
for(const name of ['theme-init','theme','pickers'])syntax.push({file:`dist/scripts/${name}.js`,...run(process.execPath,['--check',`dist/scripts/${name}.js`])});
const files=readdirSync('tests').filter(file=>/\.test\.(?:mjs|cjs)$/.test(file)).map(file=>`tests/${file}`);
const node=run(process.execPath,['--test','--test-reporter=tap',...files]);
writeFileSync('test-results/node-tests.tap',node.output);
const python=run('python',['-m','unittest','discover','-s','tests','-p','test_*.py','-v']);
writeFileSync('test-results/python-tests.log',python.output);
const number=label=>Number(node.output.match(new RegExp(`^# ${label} (\\d+)`,'m'))?.[1]||0);
const summary={completedAt:new Date().toISOString(),syntax:syntax.map(({file,passed})=>({file,passed})),node:{passed:node.passed,tests:number('tests'),pass:number('pass'),fail:number('fail'),skipped:number('skipped'),todo:number('todo')},python:{passed:python.passed,tests:Number(python.output.match(/Ran (\d+) tests/)?.[1]||0)}};
summary.passed=syntax.every(result=>result.passed)&&node.passed&&python.passed&&summary.node.skipped===0&&summary.node.todo===0;
writeFileSync('test-results/summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
if(!summary.passed){for(const result of [...syntax,node,python])if(!result.passed)console.error(result.output);process.exitCode=1;}
