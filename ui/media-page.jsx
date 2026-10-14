import React from 'react';

function LibraryPanel(){
  return <article className="panel"><h2>BIBLIOTECA DE MEDIOS</h2><p className="studio-help">Importa una carpeta de imágenes o mezcla archivos propios con clips de YouTube y Pexels. Todo se guarda dentro del proyecto.</p>
    <div className="studio-grid two">
      <label className="drop-zone" data-drop-target="asset-files"><span className="drop-icon">↥</span><strong>Arrastra imágenes, videos o audios</strong><small>O haz clic para elegir archivos</small><input id="asset-files" type="file" multiple accept="image/*,video/*,audio/*"/></label>
      <label className="drop-zone" data-drop-target="asset-folder"><span className="drop-icon">▧</span><strong>Importar carpeta de assets</strong><small>Haz clic para elegir una carpeta completa</small><input id="asset-folder" type="file" webkitdirectory="" multiple/></label>
    </div>
    <p className="studio-help">Destino: carpeta local <code>data/studio/[proyecto]/assets</code>. Elige una escena para asignar directamente los medios que importes.</p>
    <div id="media-target-scene"/>
    <div id="asset-list" className="asset-grid"/><div id="asset-pagination" className="pagination"/>
  </article>;
}

function AutofillPanel(){
  return <div id="autofill-app"/>;
}

function StoryboardPanel(){
  return <article className="panel"><h2>STORYBOARD DESDE EL SRT</h2><p className="studio-help">Cada asset cubre uno o varios bloques consecutivos. Los subtítulos conservan sus tiempos originales.</p>
    <div id="media-storyboard-controls"/>
    <div id="chapter-grouping" className="chapter-grouping"/>
    <div className="studio-actions"><div id="autofill-missing"/></div>
    <div id="media-missing-summary" className="media-missing-summary" hidden/><div id="media-board" className="media-board"/><AutofillPanel/><div id="media-pagination" className="pagination"/>
  </article>;
}

function YoutubePanel(){
  return <div id="youtube-sources"/>;
}

export function MediaPage(){
  return <><div className="section-heading"><span className="eyebrow">MÓDULO 02</span><h1>Medios y fuentes</h1><p>Prepara prompts, importa assets, busca B-roll o descarga y segmenta fuentes por capítulo.</p></div><LibraryPanel/><StoryboardPanel/><YoutubePanel/></>;
}
