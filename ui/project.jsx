import React, {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';
import {FileDrop} from './file-drop.jsx';

export function ProjectApp({actions}){
  const info=useSelector(state=>state.studioUi.project);
  const projects=useSelector(state=>state.studioUi.projects);
  const [title,setTitle]=useState('');
  const [script,setScript]=useState('');
  useEffect(()=>{setTitle(info?.title||'');},[info?.id,info?.title]);
  useEffect(()=>{setScript(info?.script||'');},[info?.id,info?.script]);
  const file=(id,files)=>actions.file(id,files,id==='script-file'?setScript:undefined);
  return <>
    <div className="section-heading"><span className="eyebrow">01 · ENTRADAS</span><h1>Prepara el material base</h1><p>Carga una sola vez el guion, los tiempos y la voz. El resto de los módulos usa estos archivos del proyecto.</p></div>
    <div className="input-overview"><div><b>01</b><span>Proyecto</span></div><div><b>02</b><span>Guion y tiempos</span></div><div><b>03</b><span>Audio original</span></div><div><b>04</b><span>Medios y montaje</span></div></div>
    <div className="studio-grid two">
      <article className="panel"><h2><b className="step">1</b> PROYECTO</h2><label>Nombre del proyecto<input placeholder="Mi video" value={title} onChange={event=>setTitle(event.target.value)}/></label>
        <div className="studio-actions"><button className="primary" onClick={()=>actions.create(title)}>Crear proyecto</button>
          <select aria-label="Abrir un proyecto anterior" value={info?.id||''} onChange={event=>actions.open(event.target.value)}><option value="">Abrir un proyecto anterior…</option>{projects.map(project=><option key={project.id} value={project.id}>{project.title} · {project.scenes} escenas</option>)}</select>
          <button className="secondary danger" disabled={!info} onClick={actions.remove}>Eliminar proyecto</button></div>
        <p className="studio-help">{info?`${info.cues} bloques de trabajo · ${info.chapters} capítulos · ${info.scenes} escenas · ${info.assets} medios`:'Crea o abre un proyecto para empezar.'}</p>
      </article>
      <article className="panel"><h2><b className="step">2</b> GUION</h2>
        <FileDrop id="script-file" icon="↥" title="Suelta aquí el guion .txt o .md" detail="También puedes hacer clic para buscarlo" accept=".txt,.md" onFile={file}/>
        <label>Guion del proyecto<textarea rows="7" placeholder="O pega aquí el guion completo..." value={script} onChange={event=>setScript(event.target.value)}/></label>
        <button className="secondary" onClick={()=>actions.saveScript(title,script)}>Guardar guion</button>
      </article>
    </div>
    <article className="panel"><h2><b className="step">3</b> TRANSCRIPT Y NARRACIÓN</h2><p className="studio-help">Puedes usar un SRT existente o un JSON de palabras. El SRT original se conserva para los subtítulos; el SRT de trabajo se puede transformar en Transcript.</p>
      <div className="studio-grid three">
        <FileDrop id="input-srt-file" icon="▤" title="Transcript .srt" detail={info?.sourceCues?`${info.sourceCues} bloques SRT guardados`:'Arrastra o elige un archivo'} accept=".srt" onFile={file}/>
        <FileDrop id="input-words-file" icon="{ }" title="Words JSON" detail={info?.words?`${info.words} palabras guardadas`:'Arrastra o elige un archivo'} accept=".json" onFile={file}/>
        <FileDrop id="input-audio-file" icon="♫" title="Audio original" detail={info?.voiceName||'WAV, MP3, M4A o AAC'} accept="audio/*,.wav,.mp3,.m4a,.aac" onFile={file}/>
      </div>
      <div className="input-status">{info?<>{[['Guion',!!info.script],['SRT',!!info.sourceCues],['Words JSON',!!info.words],['Audio',!!info.voiceName],['Capítulos',!!info.rawChapters],['Search terms',!!info.rawSearchTerms]].map(([label,present])=><strong key={label}>{present?'✓':'○'} {label}</strong>)}</>:'Crea un proyecto para guardar las entradas.'}</div>
    </article>
  </>;
}
