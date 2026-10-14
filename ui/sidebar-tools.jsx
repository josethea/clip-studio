import React,{useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {promptList} from '../studio-core.mjs';
import {getCredentials,setCredential,subscribeCredentials} from '../credential-session.mjs';

const useCredentials=()=>useSyncExternalStore(subscribeCredentials,getCredentials,getCredentials);

export function GeminiPanel({actions}){
  const credentials=useCredentials(),[question,setQuestion]=useState(''),[pending,setPending]=useState(false);
  const [messages,setMessages]=useState([{role:'bot',text:'¿En qué te ayudo con este video?'}]);
  const chatRef=useRef(null);
  useEffect(()=>{if(chatRef.current)chatRef.current.scrollTop=chatRef.current.scrollHeight;},[messages]);
  async function ask(){
    const text=question.trim();if(!text)return actions.error('Escribe una pregunta');
    setQuestion('');setPending(true);setMessages(previous=>[...previous,{role:'user',text}]);
    try{const answer=await actions.askGemini({apiKey:credentials.gemini,question:text});setMessages(previous=>[...previous,{role:'bot',text:answer||'Sin respuesta'}]);}
    catch(error){setMessages(previous=>[...previous,{role:'bot',text:`Error: ${error.message}`}]);actions.error(error.message);}
    finally{setPending(false);}
  }
  return <div className="assistant-body"><p className="studio-help">Consulta ideas visuales, estructura o términos de búsqueda. Tus cambios en el proyecto siguen bajo tu control.</p>
    <label>Clave API<input id="gemini-key" type="password" autoComplete="off" placeholder="Clave para esta sesión" value={credentials.gemini} onChange={event=>setCredential('gemini',event.target.value)}/></label>
    <div ref={chatRef} className="assistant-chat" role="log" aria-live="polite">{messages.map((message,index)=><div key={index} className={`chat-bubble ${message.role}`}>{message.text}</div>)}</div>
    <label>Mensaje<textarea id="gemini-question" rows="3" placeholder="Pregunta sobre tu guion o montaje..." value={question} onChange={event=>setQuestion(event.target.value)}/></label>
    <button className="primary" onClick={ask} disabled={pending}>{pending?'Consultando…':'Enviar a Gemini ↗'}</button>
  </div>;
}

export function KeysPanel({origin}){
  const credentials=useCredentials();
  return <div className="assistant-body"><h2>CLAVES DE MEDIOS</h2><p className="studio-help">Se usan durante esta sesión para buscar y descargar medios.</p>
    <label>API key de Pexels<input id="pexels-key" type="password" autoComplete="off" placeholder="Clave de Pexels" value={credentials.pexels} onChange={event=>setCredential('pexels',event.target.value)}/></label>
    <label>Clave pública de Storyblocks<input id="storyblocks-public" type="password" autoComplete="off" placeholder="APIKEY" value={credentials.storyblocksPublic} onChange={event=>setCredential('storyblocksPublic',event.target.value)}/></label>
    <label>Clave secreta de Storyblocks<input id="storyblocks-secret" type="password" autoComplete="off" placeholder="Secret key" value={credentials.storyblocksSecret} onChange={event=>setCredential('storyblocksSecret',event.target.value)}/></label>
    <h2>GOOGLE IMAGES</h2><p className="studio-help">Instala la extensión incluida con Clip Studio, abre «Conectar con Clip Studio» y escribe la dirección de esta app. La revisión de texto se hace en Clip Studio y no requiere la clave de Gemini.</p>
    <p className="studio-help">Dirección de esta app: <code>{origin}</code></p>
  </div>;
}

export function PromptsPanel({actions}){
  const [raw,setRaw]=useState(''),[field,setField]=useState('prompt'),[output,setOutput]=useState(''),[dragging,setDragging]=useState(false);
  const fields=useMemo(()=>{try{const parsed=JSON.parse(raw),rows=Array.isArray(parsed)?parsed:Array.isArray(parsed?.beats)?parsed.beats:Array.isArray(parsed?.items)?parsed.items:[];return [...new Set(rows.flatMap(row=>Object.keys(row||{})))].filter(key=>key!=='id');}catch{return [];}},[raw]);
  const selectedField=fields.includes(field)?field:fields.includes('prompt')?'prompt':fields[0]||'prompt';
  async function readFile(file){if(!file)return;try{setRaw(await file.text());setOutput('');}catch(error){actions.error(error.message);}}
  function format(){try{setOutput(promptList(raw,selectedField));actions.notice('Prompts formateados');}catch(error){actions.error(error.message);}}
  async function copy(){try{await actions.copy(output);actions.notice('Copiado');}catch(error){actions.error(error.message);}}
  function download(){try{actions.download(output,'prompts.txt');}catch(error){actions.error(error.message);}}
  return <article className="panel"><h2>BEATS JSON → PROMPTS</h2><div className="studio-grid two"><div>
    <label className={`drop-zone ${dragging?'dragging':''}`} onDragOver={event=>{event.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);void readFile(event.dataTransfer.files[0]);}}><span className="drop-icon">{'{ }'}</span><strong>Beats JSON</strong><small>Arrastra o elige el archivo</small><input id="prompts-file" type="file" accept=".json" onChange={event=>{void readFile(event.target.files[0]);event.target.value='';}}/></label>
    <label>JSON de beats<textarea id="prompts-input" rows="7" placeholder='[{"id":1,"prompt":"..."}]' value={raw} onChange={event=>setRaw(event.target.value)}/></label></div><div>
    <label>Campo del JSON<select id="prompts-field" value={selectedField} onChange={event=>setField(event.target.value)}>{(fields.length?fields:['prompt']).map(key=><option key={key} value={key}>{key}</option>)}</select></label>
    <button className="primary" onClick={format}>Formatear prompts</button>
    <label>Lista separada por línea en blanco<textarea id="prompts-output" rows="8" readOnly value={output}/></label>
    <div className="studio-actions"><button className="secondary" onClick={copy}>Copiar</button><button className="secondary" onClick={download}>Descargar</button></div>
  </div></div></article>;
}
