import {useCallback,useEffect,useRef} from 'react';

const storageKey='clip-studio-editor-layout-v1';
const clamp=(value,min,max)=>Math.max(min,Math.min(Math.max(min,max),value));
function savedLayout(){try{return JSON.parse(localStorage.getItem(storageKey)||'{}')||{};}catch{return {};}}

export function useEditorLayout(active,onPreviewResize){
  const layout=useRef(savedLayout());
  const apply=useCallback(()=>{
    const main=document.getElementById('editor-main-grid');
    if(!active||!main?.clientWidth||matchMedia('(max-width:900px)').matches)return;
    const inspector=clamp(Number(layout.current.inspector)||265,180,Math.min(460,main.clientWidth-270));
    main.style.setProperty('--inspector-width',`${inspector}px`);
    const top=clamp(Number(layout.current.top)||Math.round(main.clientHeight*.58),260,main.clientHeight-190);
    main.style.setProperty('--top-height',`${top}px`);
    requestAnimationFrame(onPreviewResize);
  },[active,onPreviewResize]);
  const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(layout.current));}catch{}};
  useEffect(()=>{
    if(!active)return;
    apply();
    window.addEventListener('resize',apply);
    return ()=>window.removeEventListener('resize',apply);
  },[active,apply]);
  function currentSize(kind){
    const top=document.getElementById('editor-top-grid');
    return kind==='inspector'?top.querySelector('.editor-inspector').getBoundingClientRect().width:top.getBoundingClientRect().height;
  }
  function pointerDown(kind,event){
    if(event.button!==0||matchMedia('(max-width:900px)').matches)return;
    event.preventDefault();
    const handle=event.currentTarget,startX=event.clientX,startY=event.clientY,start=currentSize(kind),field=kind==='timeline'?'top':kind;
    handle.setPointerCapture(event.pointerId);
    handle.classList.add('dragging');
    document.body.classList.add('editor-resizing');
    document.body.dataset.resizeAxis=kind==='timeline'?'vertical':'horizontal';
    const move=next=>{
      const change=kind==='timeline'?next.clientY-startY:startX-next.clientX;
      layout.current[field]=start+change;
      apply();
    };
    const finish=()=>{
      handle.removeEventListener('pointermove',move);
      handle.removeEventListener('pointerup',finish);
      handle.removeEventListener('pointercancel',finish);
      handle.classList.remove('dragging');
      document.body.classList.remove('editor-resizing');
      delete document.body.dataset.resizeAxis;
      save();
    };
    handle.addEventListener('pointermove',move);
    handle.addEventListener('pointerup',finish);
    handle.addEventListener('pointercancel',finish);
  }
  function keyDown(kind,event){
    const step=event.shiftKey?30:10;
    const delta=kind==='timeline'?(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0):(event.key==='ArrowLeft'?step:event.key==='ArrowRight'?-step:0);
    if(!delta)return;
    event.preventDefault();event.stopPropagation();
    layout.current[kind==='timeline'?'top':kind]=currentSize(kind)+delta;
    apply();save();
  }
  function reset(kind){delete layout.current[kind==='timeline'?'top':kind];apply();save();}
  return {pointerDown,keyDown,reset};
}
