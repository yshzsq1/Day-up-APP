// Minimal DOM/event adapter for exercising the real picker controller without browser packages.
const {install}=require('../dist/scripts/pickers.js');
function harness(value='2026-10-29',required=false){
 const handlers={},windowHandlers={},emitted=[],observers=[];
 const doc={activeElement:null,addEventListener(type,fn,capture=false){(handlers[type]??=[]).push({fn,capture});},createElement:tag=>new Element(tag),getElementById:id=>all(doc.body).find(e=>e.id===id),querySelectorAll:s=>doc.body.querySelectorAll(s),querySelector:s=>doc.body.querySelector(s),body:null};
 const all=node=>node.children.flatMap(e=>[e,...all(e)]);
 class Element{
  constructor(tag,attrs={}){this.tagName=tag;this.children=[];this.attrs={};this.style={};this.value='';this.isConnected=true;Object.entries(attrs).forEach(([k,v])=>this.setAttribute(k,v));}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='value')this.value=String(v);}
  getAttribute(k){return this.attrs[k]??null;} removeAttribute(k){delete this.attrs[k];}
  get id(){return this.attrs.id;}set id(v){this.setAttribute('id',v);}get className(){return this.attrs.class||'';}set className(v){this.setAttribute('class',v);}
  get required(){return 'required'in this.attrs;}get dataset(){return Object.fromEntries(Object.entries(this.attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,a)=>a.toUpperCase()),v]));}
  appendChild(e){this.children.push(e);e.parentElement=this;return e;}
  after(e){const p=this.parentElement;p.children.splice(p.children.indexOf(this)+1,0,e);e.parentElement=p;}
  get options(){return this.children.filter(e=>e.tagName==='option');}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(e=>e!==this);this.isConnected=false;}
  contains(e){return this===e||this.children.some(c=>c.contains(e));}
  matches(selector){return selector.split(',').some(part=>{let s=part.trim();const not=/\:not\(([^)]+)\)/.exec(s);if(not){if(this.matches(not[1]))return false;s=s.replace(not[0],'');}const tag=/^[a-z]+/.exec(s);if(tag&&tag[0]!==this.tagName)return false;for(const [,cls]of s.matchAll(/\.([\w-]+)/g))if(!this.className.split(' ').includes(cls))return false;for(const [,key,v]of s.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g))if(!(key in this.attrs)||(v!==undefined&&this.attrs[key]!==v))return false;return true;});}
  closest(s){return this.matches(s)?this:this.parentElement?.closest(s)||null;}
  querySelectorAll(s){return all(this).filter(e=>e.matches(s));}querySelector(s){return this.querySelectorAll(s)[0]||null;}
  set innerHTML(html){this.html=html;this.children=[];for(const [,tag,raw]of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/g)){const attrs={};for(const [,key,v]of raw.matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[key]=v??'';this.appendChild(new Element(tag,attrs));}}
  get innerHTML(){return this.html||'';}
  focus(){doc.activeElement=this;}showPopover(){this.shown=true;}reportValidity(){this.invalid=true;}
  getBoundingClientRect(){return this.className==='picker-panel'?{width:304,height:340,left:0,top:0,bottom:340}:{left:100,top:120,bottom:152,width:32,height:32};}
  dispatchEvent(event){emitted.push({type:event.type,value:this.value});dispatch(event.type,this,event);return true;}
 }
 doc.body=new Element('body');const modal=doc.body.appendChild(new Element('div',{class:'modal'}));
 const input=modal.appendChild(new Element('input',{id:'field-date',value,...required?{required:''}:{}}));
 const trigger=modal.appendChild(new Element('button',{'data-action':'pick-date','data-target':'field-date'}));
 const win={innerWidth:1024,innerHeight:768,Event:class{constructor(type,options){this.type=type;Object.assign(this,options);}},MutationObserver:class{constructor(fn){this.fn=fn;}observe(){observers.push(this.fn);}},addEventListener(type,fn){windowHandlers[type]=fn;}};
 function dispatch(type,target,extra={}){const e={target,key:'',preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};for(const h of [...handlers[type]||[]].sort((a,b)=>Number(b.capture)-Number(a.capture))){h.fn(e);if(e.stopped)break;}return e;}
 const api=install(doc,win);
 return {doc,win,api,modal,input,trigger,emitted,dispatch,handlers,mutate:()=>observers.forEach(fn=>fn()),click:node=>dispatch('click',node),get panel(){return doc.getElementById('field-picker');}};
}
module.exports={harness};
