// Requests shared by the manual media picker and the automatic storyboard flow.
// Credentials stay in the current browser session and are only sent when needed.
export function createMediaService(api,getCredential){
  const post=(path,body)=>api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  return {
    searchPexels({query,type,page=1}){
      return post('/pexels',{apiKey:getCredential('pexels'),query,type,page});
    },
    searchStoryblocks({projectId,query,type,page=1}){
      return post('/storyblocks',{publicKey:getCredential('storyblocksPublic'),secretKey:getCredential('storyblocksSecret'),query,type,projectId,page});
    },
    queueGoogleSearch({projectId,query,sceneIndex}){
      return post(`/projects/${projectId}/google-search`,{query,sceneIndex});
    },
    getGoogleJob(projectId,jobId){
      return api(`/projects/${projectId}/google-jobs/${jobId}`);
    },
    importGoogle({projectId,jobId,candidateId,sceneIndex}){
      return post(`/projects/${projectId}/google-import`,{jobId,candidateId,sceneIndex});
    },
    importStock({projectId,provider,item,sceneIndex}){
      if(provider==='pexels')return post(`/projects/${projectId}/pexels-import`,{...item,sceneIndex});
      if(provider==='storyblocks')return post(`/projects/${projectId}/storyblocks-import`,{
        stockId:item.id,name:item.name,type:item.type,sceneIndex,duration:item.duration,
        publicKey:getCredential('storyblocksPublic'),secretKey:getCredential('storyblocksSecret')
      });
      throw Error('Fuente de medios desconocida');
    },
    startAutofill({projectId,startIndex,sequence}){
      return post(`/projects/${projectId}/autofill-sequence`,{
        startIndex,sequence,pexelsKey:getCredential('pexels'),
        storyblocksPublic:getCredential('storyblocksPublic'),storyblocksSecret:getCredential('storyblocksSecret')
      });
    },
    getTask(projectId,taskId){return api(`/projects/${projectId}/tasks/${taskId}`);},
    getProject(projectId){return api(`/projects/${projectId}`);}
  };
}
