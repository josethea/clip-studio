import React, {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';
import {FileDrop} from './file-drop.jsx';

function TranscriptResult({value,name,onUse,onCopy,onDownload}){
  return <><label>Resultado<textarea rows="12" readOnly value={value}/></label><div className="studio-actions">
    <button className="secondary" onClick={()=>onCopy(value)}>Copiar</button>
    <button className="secondary" onClick={()=>onDownload(value,name)}>Descargar</button>
    <button className="secondary" onClick={()=>onUse(value)}>Usar en proyecto</button>
  </div></>;
}

export function TranscriptApp({actions}){
  const info=useSelector(state=>state.studioUi.transcript);
  const [mergeMax,setMergeMax]=useState('5');
  const [wordsMax,setWordsMax]=useState('5');
  const [wordsSilence,setWordsSilence]=useState('1');
  const [mergeOutput,setMergeOutput]=useState('');
  const [wordsOutput,setWordsOutput]=useState('');
  useEffect(()=>{setMergeOutput('');setWordsOutput('');},[info?.id]);
  return <>
    <div className="section-heading"><span className="eyebrow">02 · TRANSCRIPT</span><h1>Da forma a los subtítulos</h1><p>Usa los archivos cargados en Entradas. Compara el resultado y decide cuál SRT de trabajo guardar.</p></div>
    <div className="source-summary">{info?`Entrada: ${info.sourceCues} bloques SRT · ${info.words} palabras JSON · Trabajo: ${info.cues} bloques. Los subtítulos conservan el texto de la entrada original hasta aplicar un ajuste de tiempos.`:'Primero carga un SRT o Words JSON en Entradas.'}</div>
    <div className="studio-grid two">
      <article className="panel"><h2>COMBINAR SRT</h2><p className="studio-help">Agrupa bloques del SRT de entrada sin volver a cargarlo.</p>
        <label>Duración máxima por bloque (s)<input type="number" value={mergeMax} min="0.1" step="0.1" onChange={event=>setMergeMax(event.target.value)}/></label>
        <button className="primary" onClick={()=>actions.merge(mergeMax,setMergeOutput)}>Calcular SRT combinado</button>
        <TranscriptResult value={mergeOutput} name="transcript-combinado.srt" onUse={value=>actions.use('merge',value)} onCopy={actions.copy} onDownload={actions.download}/>
      </article>
      <article className="panel"><h2>GENERAR DESDE WORDS JSON</h2><p className="studio-help">Corta en coma, punto y demás signos, en silencios largos o al llegar al máximo por bloque.</p>
        <div className="studio-grid two"><label>Máximo por bloque (s)<input type="number" value={wordsMax} min="0.1" step="0.1" onChange={event=>setWordsMax(event.target.value)}/></label><label>Cortar silencios mayores a (s)<input type="number" value={wordsSilence} min="0" step="0.1" onChange={event=>setWordsSilence(event.target.value)}/></label></div>
        <button className="primary" onClick={()=>actions.words(wordsMax,wordsSilence,setWordsOutput)}>Generar SRT</button>
        <TranscriptResult value={wordsOutput} name="transcript-generado.srt" onUse={value=>actions.use('words',value)} onCopy={actions.copy} onDownload={actions.download}/>
      </article>
    </div>
    <article className="panel"><h2>CAPÍTULOS Y TÉRMINOS DE BÚSQUEDA · OPCIONAL</h2><p className="studio-help">Carga estos JSON después de elegir el SRT de trabajo. Los capítulos se comparan con el guion y el transcript; los search terms corresponden uno a uno a sus bloques.</p>
      <div className="studio-grid two"><div><FileDrop id="input-chapters-file" accept=".json" icon="≡" title="Capítulos JSON · opcional" detail={info?.chapters?`${info.chapters} capítulos guardados`:'chapter, startText y endText'} onFile={actions.file}/><button className="secondary source-clear" disabled={!info?.chapters} onClick={()=>actions.clear('chapters')}>Quitar capítulos</button></div>
      <div><FileDrop id="input-searchterms-file" accept=".json" icon="⌕" title="Search terms JSON · opcional" detail={info?.searchTerms?`${info.searchTerms} search terms guardados`:'Un searchTerm por bloque SRT'} onFile={actions.file}/><button className="secondary source-clear" disabled={!info?.searchTerms} onClick={()=>actions.clear('searchTerms')}>Quitar search terms</button></div></div>
      <p className="studio-help">{info?.sourceNote||''}</p>
    </article>
  </>;
}

