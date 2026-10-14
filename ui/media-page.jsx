import React from 'react';

function LibraryPanel(){
  return <article className="panel"><h2>BIBLIOTECA DE MEDIOS</h2><p className="studio-help">Importa una carpeta de imágenes o mezcla archivos propios con clips de YouTube y Pexels. Todo se guarda dentro del proyecto.</p>
    <div className="studio-grid two">
      <label className="drop-zone" data-drop-target="asset-files"><span className="drop-icon">↥</span><strong>Arrastra imágenes, videos o audios</strong><small>O haz clic para elegir archivos</small><input id="asset-files" type="file" multiple accept="image/*,video/*,audio/*"/></label>
      <label className="drop-zone" data-drop-target="asset-folder"><span className="drop-icon">▧</span><strong>Importar carpeta de assets</strong><small>Haz clic para elegir una carpeta completa</small><input id="asset-folder" type="file" webkitdirectory="" multiple/></label>
    </div>
    <p className="studio-help">Destino: carpeta local <code>data/studio/[proyecto]/assets</code>. Elige una escena para asignar directamente los medios que importes.</p>
    <label>Escena de destino<select id="media-target-scene" defaultValue=""><option value="">Solo guardar en biblioteca</option></select></label>
    <div id="asset-list" className="asset-grid"/><div id="asset-pagination" className="pagination"/>
  </article>;
}

function AutofillPanel(){
  return <div className="autofill-inline"><h3>COMPLETAR MEDIOS FALTANTES</h3><p className="studio-help">Configura una secuencia de imágenes y videos. Se repite hasta cubrir los bloques pendientes. Google Images usa la primera imagen apta de un máximo de 10 candidatas.</p>
    <div className="autofill-head"><label>Desde escena #<input id="autofill-start" type="number" defaultValue="1" min="1"/></label><button className="secondary" id="autofill-add" type="button">+ Agregar fuente</button></div>
    <div id="autofill-sequence" className="autofill-sequence"/>
    <div id="autofill-editor" className="autofill-editor" hidden><div className="studio-grid two"><label>Tipo<select id="autofill-entry-type" defaultValue="photos"><option value="photos">Imagen</option><option value="videos">Video</option></select></label><label>Fuente<select id="autofill-entry-provider" defaultValue="google"><option value="google">Google Images</option><option value="storyblocks">Storyblocks</option><option value="pexels">Pexels</option></select></label></div><div className="studio-actions"><button className="primary" id="autofill-save" type="button">Guardar fuente</button><button className="secondary" id="autofill-cancel" type="button">Cancelar</button></div></div>
    <button className="secondary" id="autofill-run" type="button" disabled>Buscar medios faltantes</button><p id="autofill-requirements" className="studio-help"/><p id="autofill-status" className="studio-help" role="status"/><div className="autofill-progress" id="autofill-progress" hidden><div id="autofill-progress-bar"/></div>
  </div>;
}

function StoryboardPanel(){
  return <article className="panel"><h2>STORYBOARD DESDE EL SRT</h2><p className="studio-help">Cada asset cubre uno o varios bloques consecutivos. Los subtítulos conservan sus tiempos originales.</p>
    <label>Distribución de assets<select id="media-scene-mode" defaultValue="srt"><option value="srt">Uno por bloque SRT · search terms 1 a 1</option><option value="chapter">Agrupar bloques por capítulo</option></select></label>
    <div id="chapter-grouping" className="chapter-grouping"/>
    <div className="studio-actions"><button className="primary" id="media-build-scenes">Crear storyboard</button><button className="secondary" id="media-auto-assign">Asignar medios por nombre/orden</button><button className="secondary" id="autofill-missing" type="button" hidden>Ver bloques sin medio</button></div>
    <div id="media-missing-summary" className="media-missing-summary" hidden/><div id="media-board" className="media-board"/><AutofillPanel/><div id="media-pagination" className="pagination"/>
  </article>;
}

function YoutubePanel(){
  return <article className="panel"><h2>VIDEOS DE YOUTUBE POR CAPÍTULO</h2><p className="studio-help">Este JSON es independiente de los capítulos del guion. Usa <code>name</code> y <code>urls</code> para descargar, cortar, aplicar espejo y eliminar el audio. Puedes reanudar desde un número de video.</p>
    <label>Capítulos y enlaces de YouTube<textarea id="source-json" rows="7" placeholder='[{"name":"Capítulo 1","urls":["https://www.youtube.com/watch?v=..."]}]'/></label>
    <div className="studio-grid four"><label>Clip (s)<input id="source-duration" type="number" defaultValue="5" min="0.5" step="0.1"/></label><label>Pausa entre descargas (s)<input id="source-delay" type="number" defaultValue="12" min="0"/></label><label>Reanudar desde video #<input id="source-start" type="number" defaultValue="1" min="1"/></label><label>Cookies del navegador<select id="source-cookie" defaultValue="none"><option value="none">Sin cookies</option><option value="chrome">Chrome</option><option value="safari">Safari</option><option value="firefox">Firefox</option></select></label></div>
    <button className="primary" id="source-run">Descargar y segmentar</button><div id="source-status" className="studio-help"/>
  </article>;
}

export function MediaPage(){
  return <><div className="section-heading"><span className="eyebrow">MÓDULO 02</span><h1>Medios y fuentes</h1><p>Prepara prompts, importa assets, busca B-roll o descarga y segmenta fuentes por capítulo.</p></div><LibraryPanel/><StoryboardPanel/><YoutubePanel/></>;
}
