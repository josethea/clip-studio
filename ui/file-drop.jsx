import React, {useState} from 'react';

export function FileDrop({id,icon,title,detail,accept,onFile}){
  const [dragging,setDragging]=useState(false);
  return <label className={`drop-zone ${dragging?'dragging':''}`} onDragOver={event=>{event.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);onFile(id,[...event.dataTransfer.files]);}}>
    <span className="drop-icon">{icon}</span><strong>{title}</strong><small>{detail}</small>
    <input type="file" accept={accept} onChange={event=>{onFile(id,[...event.target.files]);event.target.value='';}}/>
  </label>;
}

