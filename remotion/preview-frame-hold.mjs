// Preview-only: retain the last decoded frame while a newly mounted video seeks.
// The canvas lives outside the Remotion tree so scene changes cannot unmount it.
export function createPreviewFrameHold(stage,canvas){
  const context=canvas?.getContext('2d',{alpha:false});
  let hasFrame=false,held=false,pendingFrame=null,releaseId=0,releaseRunning=false,lastCapture=0;

  function visible(media){
    for(let node=media;node&&node!==stage;node=node.parentElement){
      const style=getComputedStyle(node);
      if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)<.02)return false;
    }
    const box=media.getBoundingClientRect(),bounds=stage.getBoundingClientRect();
    return box.width>0&&box.height>0&&box.right>bounds.left&&box.left<bounds.right&&box.bottom>bounds.top&&box.top<bounds.bottom;
  }

  function activeMedia(){
    return [...stage.querySelectorAll('[data-scene-id] video, [data-scene-id] img')].filter(visible);
  }

  function decoded(media){
    return media instanceof HTMLVideoElement
      ?media.readyState>=HTMLMediaElement.HAVE_CURRENT_DATA&&!media.seeking&&media.videoWidth>0
      :media.complete&&media.naturalWidth>0;
  }

  function draw(media,bounds){
    const rect=media.getBoundingClientRect();
    const x=rect.left-bounds.left,y=rect.top-bounds.top,w=rect.width,h=rect.height;
    const sourceWidth=media instanceof HTMLVideoElement?media.videoWidth:media.naturalWidth;
    const sourceHeight=media instanceof HTMLVideoElement?media.videoHeight:media.naturalHeight;
    const fit=getComputedStyle(media).objectFit;
    const scale=fit==='cover'?Math.max(w/sourceWidth,h/sourceHeight):Math.min(w/sourceWidth,h/sourceHeight);
    const dw=sourceWidth*scale,dh=sourceHeight*scale;
    context.save();
    context.beginPath();context.rect(x,y,w,h);context.clip();
    context.filter=getComputedStyle(media).filter||'none';
    context.drawImage(media,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
    context.restore();
  }

  function capture(force=false){
    if(!context||held||(!force&&performance.now()-lastCapture<140))return false;
    const media=activeMedia();
    if(!media.length||media.some(item=>!decoded(item)))return false;
    const bounds=stage.getBoundingClientRect();
    if(!bounds.width||!bounds.height)return false;
    const ratio=Math.min(1,1280/bounds.width,720/bounds.height);
    canvas.width=Math.max(1,Math.round(bounds.width*ratio));
    canvas.height=Math.max(1,Math.round(bounds.height*ratio));
    context.setTransform(ratio,0,0,ratio,0,0);
    context.fillStyle='#08080a';context.fillRect(0,0,bounds.width,bounds.height);
    try{media.forEach(item=>draw(item,bounds));}
    catch{return false;}
    hasFrame=true;lastCapture=performance.now();return true;
  }

  function show(){
    if(!hasFrame)return;
    held=true;canvas.hidden=false;
  }

  function ready(frame){
    const composition=stage.querySelector('[data-preview-frame]');
    if(!composition||frame!==null&&Number(composition.dataset.previewFrame)<frame)return false;
    const media=activeMedia();
    return media.length>0&&media.every(decoded);
  }

  function releaseWhenReady(frame=null,force=false){
    if(releaseRunning&&!force)return;
    releaseRunning=true;
    const id=++releaseId,start=performance.now();
    let stable=0;
    const check=()=>{
      if(id!==releaseId||!held)return;
      if(ready(frame)&&performance.now()-start>=100){
        if(++stable>=2){canvas.hidden=true;held=false;releaseRunning=false;capture(true);return;}
      }else stable=0;
      // A missing asset must not leave an unrelated frame over the preview forever.
      if(performance.now()-start>10000){canvas.hidden=true;held=false;releaseRunning=false;return;}
      pendingFrame=requestAnimationFrame(check);
    };
    if(pendingFrame!==null)cancelAnimationFrame(pendingFrame);
    pendingFrame=requestAnimationFrame(check);
  }

  return {
    capture,
    seek(frame){capture(true);show();if(held)releaseWhenReady(frame,true);},
    waiting(){if(!ready(null)){show();if(held)releaseWhenReady(null);}},
    resume(){if(held)releaseWhenReady(null);else capture(true);},
    reset(){releaseId++;if(pendingFrame!==null)cancelAnimationFrame(pendingFrame);pendingFrame=null;held=false;releaseRunning=false;hasFrame=false;if(canvas)canvas.hidden=true;}
  };
}
