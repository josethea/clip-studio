export function createPreviewSession({getProject,isEditorActive,player,prepare,origin,onComposition=()=>{},onTransport=()=>{},getScale=()=>1,getScroll=()=>null,onResize=()=>{},waitReady=()=>new Promise(resolve=>setTimeout(resolve,80))}){
  let time=0,playing=false,rendered=false,snapshot=null,generation=0;
  const duration=project=>project?.scenes?.at(-1)?.end||0;
  const frame=()=>Math.round(time*30);
  const compositionSnapshot=project=>JSON.stringify({scenes:project.scenes,assets:project.assets,cues:project.cues,subtitleCues:project.subtitleCues,textLayers:project.textLayers,words:project.wordsJson?.words,narrationId:project.narrationId,musicId:project.musicId,settings:project.settings});

  function refresh(force=false){
    const project=getProject();if(!project)return;
    if(project.scenes.length&&isEditorActive()&&(force||!rendered)){
      const next=compositionSnapshot(project);
      if(next!==snapshot){
        const composition=prepare(project,origin());
        if(!rendered)player.mount(composition,frame(),false);
        else player.update(composition);
        snapshot=next;rendered=true;onComposition();
      }
    }
    time=Math.max(0,Math.min(duration(project),time));
    const scroll=getScroll(),cursor=64+time*(getScale()||1);
    if(scroll&&playing&&cursor>scroll.scrollLeft+scroll.clientWidth-50)scroll.scrollLeft=Math.max(0,cursor-scroll.clientWidth*.35);
    onTransport({time,duration:duration(project),playing});
    onResize();
  }

  function seek(value){
    const project=getProject();if(!project)return;
    time=Math.max(0,Math.min(duration(project),Number(value)||0));
    if(rendered)player.seek(frame());
    refresh();
  }

  async function play(value){
    if(!value){player.pause();playing=false;generation++;refresh();return;}
    const project=getProject();if(!project)throw Error('Crea o abre un proyecto en la pestaña Proyecto');
    if(!project.scenes?.length)throw Error('Crea el storyboard antes de reproducir');
    const current=++generation;
    refresh();if(time>=duration(project))seek(0);
    if(!player.ready())await waitReady();
    if(current!==generation||getProject()!==project)return;
    player.seek(frame());player.play();playing=true;refresh();
  }

  function tick(){
    if(!playing||!rendered)return;
    time=player.frame()/30;
    if(!player.playing())playing=false;
    refresh();
  }

  function reset(){
    generation++;player.pause();player.unmount();
    time=0;playing=false;rendered=false;snapshot=null;
  }

  return {refresh,seek,play,tick,reset,invalidate:()=>{snapshot=null;},get time(){return time;},get playing(){return playing;},get rendered(){return rendered;}};
}
