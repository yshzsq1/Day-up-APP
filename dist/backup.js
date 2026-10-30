(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DayUpBackups=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function createClient(fetcher){
  const request=async(path,body)=>{
   const response=await fetcher(path,body===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json','X-DayUp-Request':'1'},body:JSON.stringify(body)});
   let result;try{result=await response.json()}catch{throw Error('本地备份服务尚未更新，请关闭旧服务后重新启动 DayUp');}
   if(!response.ok)throw Error(result.error||`备份操作失败（${response.status}）`);
   return result;
  };
  return {list:()=>request('/api/backups'),create:data=>request('/api/backups',{data}),read:name=>request(`/api/backups/${encodeURIComponent(name)}`),remove:names=>request('/api/backups/delete',{names}),open:()=>request('/api/backups/open',{})};
 }
 return {createClient};
});
