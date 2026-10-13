import React, {useEffect, useState} from 'react';
import {cancelRender, continueRender, delayRender} from 'remotion';

const faces=[
  ['Anton',400,'anton.ttf'],
  ['Courier Prime',400,'courier-prime-regular.ttf'],
  ['Courier Prime',700,'courier-prime-bold.ttf'],
  ['IBM Plex Mono',400,'ibm-plex-mono-regular.ttf'],
  ['IBM Plex Mono',700,'ibm-plex-mono-bold.ttf'],
  ['Inter',400,'inter-regular.ttf'],
  ['Inter',700,'inter-bold.ttf'],
  ['Inter',900,'inter-black.ttf']
];

export function FontFaces({base,fonts}) {
  const [handle]=useState(()=>delayRender('Cargando fuentes del proyecto'));
  const css=faces.map(([family,weight,file])=>`@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:block;src:url("${base}/${file}") format("truetype")}`).join('\n');
  const selected=Array.from(new Set(fonts.filter(font=>faces.some(([family])=>family===font))));

  useEffect(()=>{
    let cancelled=false;
    Promise.all(selected.map(font=>document.fonts.load(`${font==='Anton'?400:font==='Inter'?900:700} 48px "${font}"`)))
      .then(()=>{if(!cancelled)continueRender(handle);})
      .catch(error=>{if(!cancelled)cancelRender(error);});
    return ()=>{cancelled=true;continueRender(handle);};
  },[base,selected.join('|'),handle]);

  return <style>{css}</style>;
}
