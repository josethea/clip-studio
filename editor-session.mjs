const EDITABLE_KEYS=['scenes','textLayers','subtitleCues','subtitleSources','subtitleSource','settings','narrationId','musicId'];

export function editableSnapshot(project){
  return JSON.stringify(Object.fromEntries(EDITABLE_KEYS.map(key=>[key,project[key]])));
}

export function createEditorSession({getProject,write,onHistory=()=>{},onStatus=()=>{},onRestore=()=>{},delay=1200,maxHistory=80}){
  let undo=[],redo=[],timer=null,inFlight=null,revision=0,savedRevision=0,epoch=0,dirty=false;
  const history=()=>({canUndo:undo.length>0,canRedo:redo.length>0});
  const publishHistory=()=>onHistory(history());
  const clearTimer=()=>{if(timer!==null){clearTimeout(timer);timer=null;}};
  const schedule=ms=>{clearTimer();timer=setTimeout(()=>{timer=null;void flush().catch(()=>{});},ms);};

  async function flush(force=false){
    clearTimer();
    if(inFlight){try{await inFlight;}catch{}return flush(force);}
    const project=getProject();
    if(!project||!force&&!dirty)return null;
    const currentEpoch=epoch,currentRevision=revision,wasDirty=dirty,id=project.id,payload=JSON.parse(JSON.stringify(project));
    inFlight=write(id,payload);
    try{
      const result=await inFlight;
      if(epoch===currentEpoch&&getProject()?.id===id){
        savedRevision=currentRevision;
        if(revision===currentRevision){dirty=false;if(wasDirty)onStatus('Cambios guardados');}
        else schedule(300);
      }
      return result;
    }catch(error){
      if(epoch===currentEpoch&&getProject()?.id===id)onStatus('Error al guardar · '+error.message);
      throw error;
    }finally{inFlight=null;}
  }

  function markDirty(){
    if(!getProject())return;
    revision++;dirty=true;onStatus('Cambios pendientes…');schedule(delay);
  }
  function remember(){
    const project=getProject();if(!project)return;
    undo.push(editableSnapshot(project));if(undo.length>maxHistory)undo.shift();redo=[];
    markDirty();publishHistory();
  }
  function travel(from,to){
    const project=getProject();if(!project||!from.length)return false;
    to.push(editableSnapshot(project));if(to.length>maxHistory)to.shift();
    Object.assign(project,JSON.parse(from.pop()));onRestore(project);markDirty();publishHistory();return true;
  }
  function reset(){epoch++;clearTimer();undo=[];redo=[];revision=0;savedRevision=0;dirty=false;publishHistory();}
  return {remember,markDirty,undo:()=>travel(undo,redo),redo:()=>travel(redo,undo),reset,flush,history,
    get pending(){return dirty||revision>savedRevision;}};
}
