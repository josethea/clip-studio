// Stock results for the active storyboard scene. Provider, type, query and pages live in the
// Redux media session; this module keeps the downloaded lists and the Google job being followed.
export const STOCK_PAGE_SIZE=5;
const emptyResults=()=>({pexels:[],pexelsBatch:1,pexelsHasNext:false,storyblocks:[],storyblocksBatch:1,storyblocksTotal:0,google:[],googleJobId:null,googleRejected:0,googleDetail:'',googleStatus:''});
const pageKey={pexels:'pexelsPage',storyblocks:'storyblocksPage',google:'googlePage'};

export function createStockSearch({service,getSession,patchSession,onChange,notice,isCurrentProject,schedule=(fn,ms)=>setTimeout(fn,ms)}){
  let results=emptyResults(),generation=0,loadingPage=false;
  const list=provider=>provider==='pexels'?results.pexels:provider==='google'?results.google:results.storyblocks;
  const query=()=>{const value=String(getSession().query||'').trim();if(!value)throw Error('Escribe un término de búsqueda');return value;};

  async function searchPexels(batch){
    const run=generation,result=await service.searchPexels({query:query(),type:getSession().type,page:batch});
    if(run!==generation)return;
    results.pexels=batch===1?result.items:[...results.pexels,...result.items];results.pexelsBatch=batch;results.pexelsHasNext=result.hasNext;
    patchSession(batch===1?{searched:true,pexelsPage:0}:{searched:true});onChange();
  }
  async function searchStoryblocks(projectId,batch){
    const run=generation,result=await service.searchStoryblocks({projectId,query:query(),type:getSession().type,page:batch});
    if(run!==generation)return;
    results.storyblocks=batch===1?result.items:[...results.storyblocks,...result.items];results.storyblocksTotal=result.total;results.storyblocksBatch=batch;
    patchSession({searched:true});onChange();
  }
  async function searchGoogle(projectId,sceneIndex){
    const run=generation,queued=await service.queueGoogleSearch({projectId,query:query(),sceneIndex});
    if(run!==generation)return;
    const id=queued.id;
    Object.assign(results,{googleJobId:id,google:[],googleRejected:0,googleStatus:'queued',googleDetail:'Esperando a la extensión…'});
    patchSession({searched:true,googlePage:0});onChange();
    const followed=()=>results.googleJobId===id&&getSession().provider==='google'&&isCurrentProject(projectId);
    const poll=async()=>{
      if(!followed())return;
      try{
        const job=await service.getGoogleJob(projectId,id);
        if(results.googleJobId!==id)return;
        Object.assign(results,{google:job.items,googleRejected:job.rejected.length,googleStatus:job.status,googleDetail:job.detail||''});onChange();
        if(job.status==='error'){notice(job.detail||'La búsqueda falló',true);return;}
        if(job.status==='done'){if(!job.items.length)notice(`No hubo imágenes aptas. ${job.rejected.at(-1)||'Prueba otro término.'}`,true);return;}
        schedule(poll,1200);
      }catch(error){if(results.googleJobId!==id)return;results.googleStatus='error';results.googleDetail=error.message;onChange();notice(error.message,true);}
    };
    schedule(poll,200);
  }

  return {
    // Drops results and ignores responses from searches started before the reset.
    reset(){generation++;results=emptyResults();},
    item(provider,index){return list(provider)[index];},
    get googleJobId(){return results.googleJobId;},
    async run(projectId,sceneIndex){
      const provider=getSession().provider;
      if(provider==='storyblocks'){patchSession({storyblocksPage:0});await searchStoryblocks(projectId,1);}
      else if(provider==='google')await searchGoogle(projectId,sceneIndex);
      else await searchPexels(1);
    },
    async page(projectId,direction){
      // Page clicks while the next batch downloads would be overwritten when it arrives.
      if(loadingPage)return;
      const session=getSession(),provider=session.provider,current=session[pageKey[provider]]||0;
      if(provider==='google'){patchSession({googlePage:Math.max(0,Math.min(Math.ceil(results.google.length/STOCK_PAGE_SIZE)-1,current+direction))});onChange();return;}
      const next=current+direction;if(next<0)return;
      const run=generation;
      if(next*STOCK_PAGE_SIZE>=list(provider).length){
        loadingPage=true;
        try{if(provider==='pexels')await searchPexels(results.pexelsBatch+1);else await searchStoryblocks(projectId,results.storyblocksBatch+1);}
        finally{loadingPage=false;}
      }
      if(run!==generation)return;
      patchSession({[pageKey[provider]]:next});onChange();
    },
    // Cards for the five results on the current page, or null when nothing should be shown.
    view(project,target){
      const session=getSession(),provider=session.provider;
      if(!session.searched)return null;
      const page=session[pageKey[provider]]||0,items=list(provider);
      const cards=items.slice(page*STOCK_PAGE_SIZE,(page+1)*STOCK_PAGE_SIZE).map((item,offset)=>{
        const source=provider==='storyblocks'?`storyblocks:${item.type}:${item.id}`:item.source;
        const existing=provider==='google'||item.type==='video'?null:project?.assets.find(asset=>asset.source===source);
        const info=[item.width&&item.height?`Resolución ${item.width}×${item.height}`:'Resolución no disponible',item.duration?`${Math.round(item.duration)} s`:'',item.creator||'',provider==='google'?`Texto ${item.analysis?.textPercent??0}%`:''].filter(Boolean).join(' · ');
        return {index:page*STOCK_PAGE_SIZE+offset,name:item.name||'',preview:item.preview||'',previewVideo:item.previewVideo||'',source:item.source||'',info,existing:!!existing,assigned:!!existing&&project.scenes[target]?.assetId===existing.id};
      });
      const end=(page+1)*STOCK_PAGE_SIZE,next=provider==='pexels'?end<items.length||results.pexelsHasNext:provider==='google'?end<items.length:end<results.storyblocksTotal;
      return {searched:true,provider,items:cards,page,target,detail:results.googleDetail,status:results.googleStatus,total:results.google.length,rejected:results.googleRejected,previous:page>0,next};
    }
  };
}
