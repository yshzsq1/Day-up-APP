(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DayUpStorage=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  class LocalStore {
    constructor(primary,secondary,key='dayup-local-v1'){this.primary=primary;this.secondary=secondary;this.key=key;this.queue=Promise.resolve();this.sequence=0;this.mode='尚未保存'}
    async load(){
      const values=[], errors=[];
      for(const adapter of [this.primary,this.secondary]){
        if(!adapter)continue;
        try{const raw=await adapter.get(this.key);if(raw){const value=JSON.parse(raw);values.push(value)}}catch(error){errors.push(error)}
      }
      if(!values.length && errors.length)throw Error('本地数据暂时无法读取。请保留当前浏览器数据，重试或导入备份。');
      values.sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));
      this.sequence=values[0]?.savedAt||0;
      return values[0]||null;
    }
    write(value){
      const snapshot=JSON.parse(JSON.stringify(value));
      const operation=async()=>{
        for(const adapter of [this.primary,this.secondary]){
          try{if(adapter){const raw=await adapter.get(this.key);if(raw)this.sequence=Math.max(this.sequence,JSON.parse(raw).savedAt||0)}}catch{}
        }
        snapshot.savedAt=Math.max(Date.now(),this.sequence+1);this.sequence=snapshot.savedAt;
        const raw=JSON.stringify(snapshot);
        for(const [adapter,mode] of [[this.primary,'浏览器本地存储'],[this.secondary,'浏览器本地数据库']]){
          if(!adapter)continue;
          try{await adapter.put(this.key,raw);this.mode=mode;return snapshot}catch{}
        }
        throw Error('保存失败：本地存储不可用或空间不足。请导出当前数据备份。');
      };
      const pending=this.queue.then(operation);this.queue=pending.catch(()=>{});return pending;
    }
  }
  function browserAdapters(){
    let primary=null;
    try{const s=window.localStorage;primary={get:key=>s.getItem(key),put:(key,value)=>s.setItem(key,value)}}catch{}
    let connection;
    const open=()=>connection||(connection=new Promise((resolve,reject)=>{
      if(!window.indexedDB)return reject(Error('数据库不可用'));
      const request=window.indexedDB.open('dayup-fallback',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('state');
      request.onerror=()=>{connection=null;reject(request.error)};
      request.onblocked=()=>{connection=null;reject(Error('数据库被其他页面占用'))};
      request.onsuccess=()=>resolve(request.result);
    }));
    const secondary={get:async key=>{const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('state');const request=tx.objectStore('state').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})},put:async(key,value)=>{const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}};
    return {primary,secondary};
  }
  return {LocalStore,browserAdapters};
});
