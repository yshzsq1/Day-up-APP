const vm=require('node:vm'),fs=require('node:fs');
const Core=require('../dist/core.js'),Storage=require('../dist/storage.js');
async function createApp(raw=null,extras={}){
 const nodes=new Map(),events={},downloads=[];
 const node=key=>{if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',value:'',disabled:false,dataset:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},focus(){},setAttribute(){}});return nodes.get(key)};
 const memory=new Map();if(raw)memory.set('dayup-local-v1',JSON.stringify(raw));
 const localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const primary={get:localStorage.getItem,put:localStorage.setItem};
 const context=vm.createContext({console,Date,Intl,Math,JSON,Set,Map,Promise,Blob,URL:{createObjectURL:blob=>{downloads.push({blob});return 'blob:test'},revokeObjectURL(){}},
  window:{localStorage},DayUpCore:Core,DayUpStorage:{...Storage,browserAdapters:()=>({primary,secondary:null})},
  document:{querySelector:node,querySelectorAll:()=>[],body:{classList:{add(){},remove(){}}},addEventListener:(type,fn)=>{(events[type]??=[]).push(fn)},createElement:()=>({click(){if(downloads.length)downloads[downloads.length-1].name=this.download},remove(){}})},
  setInterval(){},setTimeout(){},clearTimeout(){},
  FormData:class{constructor(form){this.data=form.values}entries(){return Array.isArray(this.data)?this.data:Object.entries(this.data)}},
  ...extras,
 });
 vm.runInContext(fs.readFileSync('dist/features.js','utf8'),context,{filename:'features.js'});
  context.DayUpLearning=require('../dist/learning-core.js');
  vm.runInContext(fs.readFileSync('dist/learning.js','utf8'),context,{filename:'learning.js'});
 vm.runInContext(fs.readFileSync('dist/app.js','utf8'),context,{filename:'app.js'});
 await new Promise(resolve=>setImmediate(resolve));
 const exec=code=>vm.runInContext(code,context);
 const snapshot=()=>JSON.parse(exec('JSON.stringify(state)'));
 const submit=async(kind,values)=>{context.testForm={dataset:{form:kind},values,querySelector:()=>({disabled:false})};await exec('handleForm(testForm)')};
 const click=async(action,id)=>{
  const el={dataset:{action,id},classList:{contains:()=>false}};
  for(const handler of events.click||[])await handler({target:{closest:()=>el},preventDefault(){},stopPropagation(){}});
 };
 return {exec,snapshot,submit,click,nodes,memory,context,events,downloads};
}
module.exports={createApp};
