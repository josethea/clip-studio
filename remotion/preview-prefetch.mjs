export function createPreviewPrefetch({request,prefetch,delay=150}){
  const active=new Map();
  let timer=null,generation=0;

  function clear(){
    generation++;
    if(timer!==null)clearTimeout(timer);
    timer=null;
    for(const entry of active.values()){entry.cancelled=true;entry.free?.();}
    active.clear();
  }

  function warm(project,frame){
    if(!project?.preview||!project.scenes?.length)return;
    if(timer!==null)clearTimeout(timer);
    const run=generation;
    timer=setTimeout(()=>{
      timer=null;
      if(run!==generation)return;
      const index=Math.max(0,project.scenes.findLastIndex(scene=>scene.start<=frame/30));
      const assets=new Map((project.assets||[]).map(asset=>[asset.id,asset]));
      const urls=new Set(project.scenes.slice(Math.max(0,index-1),index+2).map(scene=>assets.get(scene.assetId)).filter(asset=>asset?.type==='video').map(asset=>asset.url));
      for(const [url,entry] of active)if(!urls.has(url)){entry.cancelled=true;entry.free?.();active.delete(url);}
      for(const url of urls){
        if(active.has(url))continue;
        const entry={cancelled:false,free:null};active.set(url,entry);
        Promise.resolve().then(()=>request(url,{method:'HEAD'})).then(response=>{
          if(entry.cancelled||!response.ok||response.headers.get('x-clip-studio-preview')!=='optimized'){if(active.get(url)===entry)active.delete(url);return;}
          const cached=prefetch(url,{method:'blob-url'});
          entry.free=cached.free;
          return cached.waitUntilDone().catch(()=>{entry.free?.();if(active.get(url)===entry)active.delete(url);});
        }).catch(()=>{if(active.get(url)===entry)active.delete(url);});
      }
    },delay);
  }
  return {warm,clear,get size(){return active.size;}};
}
