export const emptyEditorInteraction=()=>({selection:null,multiSelection:[],selectedScene:null});

export function selectEditorItem(current,type,index,append=false){
  let selection,multiSelection;
  if(append){
    const list=current.multiSelection.length?[...current.multiSelection]:current.selection&&current.selection.type!=='multi'?[current.selection]:[];
    const at=list.findIndex(item=>item.type===type&&item.index===index);
    if(at>=0)list.splice(at,1);else list.push({type,index});
    multiSelection=list.length>1?list:[];
    selection=list.length>1?{type:'multi',index:-1}:list[0]||null;
  }else{selection={type,index};multiSelection=[];}
  return {selection,multiSelection,selectedScene:selection?.type==='scene'?selection.index:null};
}

export function restoreEditorInteraction({sceneCount,textCount},current){
  const selection=current.selection;
  const valid=selection?.type==='text'?selection.index>=0&&selection.index<textCount:selection?.type==='scene'?selection.index>=0&&selection.index<sceneCount:true;
  const next=valid?selection:null;
  return {...current,selection:next,selectedScene:next?.type==='scene'?next.index:null};
}
