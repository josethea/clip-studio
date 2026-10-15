import React, {useState} from 'react';

export async function filesFromDrop(transfer){
  const files=[...transfer.files],entries=[...transfer.items].map(item=>item.webkitGetAsEntry?.()).filter(Boolean);
  if(!entries.some(entry=>entry.isDirectory))return files;
  const visit=entry=>new Promise(resolve=>{
    if(entry.isFile)entry.file(file=>resolve([file]),()=>resolve([]));
    else if(entry.isDirectory){const reader=entry.createReader(),found=[];const next=()=>reader.readEntries(async batch=>{if(!batch.length)return resolve(found);for(const child of batch)found.push(...await visit(child));next();},()=>resolve(found));next();}
    else resolve([]);
  });
  return (await Promise.all(entries.map(visit))).flat();
}

export function FileDrop({id,icon,title,detail,accept,onFile,multiple=false,directory=false}){
  const [dragging,setDragging]=useState(false);
  return <label className={`drop-zone ${dragging?'dragging':''}`} onDragOver={event=>{event.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);void filesFromDrop(event.dataTransfer).then(files=>onFile(id,files));}}>
    <span className="drop-icon">{icon}</span><strong>{title}</strong><small>{detail}</small>
    <input id={id} type="file" accept={accept} multiple={multiple||directory} webkitdirectory={directory?'':undefined} onChange={event=>{onFile(id,[...event.target.files]);event.target.value='';}}/>
  </label>;
}
