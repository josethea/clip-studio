import React from 'react';
import {useSelector} from 'react-redux';
import {useEditorLayout} from './editor-layout.jsx';

const pages=[['project','Proyecto'],['transcript','Transcript'],['assets','Medios'],['editor','Editor'],['export','Exportar']];
const tools=[['gemini','Gemini'],['keys','Claves'],['prompts','Prompts'],['rename','Renombrar']];

function EditorWorkspace({onPreviewResize}){
  const view=useSelector(state=>state.studioUi.activeView);
  const resize=useEditorLayout(view==='editor',onPreviewResize);
  const name=useSelector(state=>state.studioUi.editorTitle);
  const dirty=useSelector(state=>state.studioUi.editorDirty);
  const surface=useSelector(state=>state.studioUi.previewSurface);
  return <section className={`page editor-page ${view==='editor'?'active':''}`} id="editor">
    <div className="section-heading"><span className="eyebrow">04 · EDITOR</span><h1>Mesa de montaje</h1><p>Revisa el vídeo en vivo, ajusta la línea de tiempo y edita cada elemento desde su panel de propiedades.</p></div>
    <div className="editor-topline"><strong id="editor-project-name">{name}</strong><span id="editor-dirty">{dirty}</span><div id="editor-actions" className="studio-actions"/></div>
    <div className="editor-workspace" id="editor-workspace">
      <aside className="editor-global" aria-label="Ajustes globales">
        <div className="editor-pane-title"><span>AJUSTES GLOBALES</span><small>Todo el vídeo</small></div>
        <details open><summary>Montaje y transiciones</summary><div id="global-controls" className="editor-pane-body"/></details>
        <details><summary>Narración y duración</summary><div id="narration-controls" className="editor-pane-body"/></details>
        <details><summary>Formato y subtítulos</summary><div id="format-controls" className="editor-pane-body"/></details>
        <details><summary>Storyboard y asignación</summary><div id="editor-storyboard-controls" className="editor-pane-body"/></details>
        <details><summary>Plantillas de texto</summary><div id="template-panel" className="editor-pane-body"/></details>
      </aside>
      <div className="editor-resize-handle editor-resize-global" data-editor-resize="global" title="Arrastra para cambiar el ancho de Ajustes globales" role="separator" aria-label="Ajustar ancho de Ajustes globales" aria-orientation="vertical" tabIndex={0} onPointerDown={event=>resize.pointerDown('global',event)} onKeyDown={event=>resize.keyDown('global',event)} onDoubleClick={()=>resize.reset('global')}/>
      <div className="editor-main-grid" id="editor-main-grid">
        <div className="editor-top-grid" id="editor-top-grid">
          <div className="editor-center"><article className="editor-monitor"><div className="editor-monitor-head"><strong>VISTA PREVIA · REMOTION</strong><span id="preview-render-status">{surface.status}</span></div><div id="preview-stage" className="preview-stage exact-preview"><div id="remotion-preview"/><video id="rendered-preview" hidden/><div id="preview-empty" hidden={!surface.empty}>Crea el storyboard para visualizar el montaje.</div></div><div id="preview-controls" className="preview-controls"/><div id="monitor-actions" className="monitor-actions"/></article></div>
          <div className="editor-resize-handle editor-resize-inspector" data-editor-resize="inspector" title="Arrastra para cambiar el ancho de Ajustes específicos" role="separator" aria-label="Ajustar ancho de Ajustes específicos" aria-orientation="vertical" tabIndex={0} onPointerDown={event=>resize.pointerDown('inspector',event)} onKeyDown={event=>resize.keyDown('inspector',event)} onDoubleClick={()=>resize.reset('inspector')}/>
          <aside className="editor-inspector" aria-label="Propiedades de selección"><div id="inspector-app"/></aside>
        </div>
        <div className="editor-resize-handle editor-resize-timeline" data-editor-resize="timeline" title="Arrastra para cambiar la altura del timeline" role="separator" aria-label="Ajustar altura del timeline" aria-orientation="horizontal" tabIndex={0} onPointerDown={event=>resize.pointerDown('timeline',event)} onKeyDown={event=>resize.keyDown('timeline',event)} onDoubleClick={()=>resize.reset('timeline')}/>
        <article className="editor-timeline"><div id="timeline-toolbar" className="timeline-toolbar"/><div className="timeline-scroll" id="timeline-scroll"><div id="timeline-root"/></div></article>
      </div>
    </div>
  </section>;
}

function BusyOverlay(){
  const busy=useSelector(state=>state.studioUi.busyView);
  return <div id="busy-overlay" className="busy-overlay" hidden={!busy.running} role="status" aria-live="polite"><div className="busy-card"><div className="busy-spinner"/><strong id="busy-title">{busy.title}</strong><p id="busy-detail">{busy.detail}</p><div className="busy-track"><div id="busy-bar" style={{width:`${busy.percent}%`}}/></div><small id="busy-percent">{busy.percent?`${Math.round(busy.percent)}%`:''}</small></div></div>;
}

export function StudioShell({onNavigate,onSidebar,onToggleSidebar,onPreviewResize}){
  const view=useSelector(state=>state.studioUi.activeView);
  const sidebar=useSelector(state=>state.studioUi.activeSidebar);
  const collapsed=useSelector(state=>state.studioUi.sidebarCollapsed);
  const indicator=useSelector(state=>state.studioUi.projectIndicator);
  const notice=useSelector(state=>state.studioUi.notice);
  return <>
    <header className="topbar"><div className="brand"><div className="brand-icon">✧</div><div><strong>Clip Studio</strong><small>Guion · medios · edición · exportación</small></div><span className="brand-tag">STUDIO</span></div><nav className="tabs" aria-label="Módulos">{pages.map(([id,label])=><button key={id} className={`tab ${view===id?'active':''}`} data-view={id} onClick={()=>onNavigate(id)}>{label}</button>)}</nav><div className="system"><span className="pill blue">Remotion + FFmpeg</span><span className="pill green">● Listo</span></div></header>
    <div className="app-shell"><main><div className="status-banner"><span>● &nbsp; Proyecto guardado en esta instalación. Los medios y la edición quedan disponibles al volver.</span><span id="project-indicator">{indicator}</span></div>
      <section className={`page ${view==='project'?'active':''}`} id="project"><div id="project-app"/></section>
      <section className={`page ${view==='transcript'?'active':''}`} id="transcript"><div id="transcript-app"/></section>
      <section className={`page ${view==='assets'?'active':''}`} id="assets"/>
      <EditorWorkspace onPreviewResize={onPreviewResize}/>
      <dialog id="media-picker" className="media-picker"><div id="media-picker-app"/></dialog>
      <section className={`page ${view==='export'?'active':''}`} id="export"><div id="export-app"/></section>
      <div id="global-message" role="status" style={{color:notice.bad?'#ff8dab':'#78d7aa'}}>{notice.message}</div>
    </main><aside className={`assistant-sidebar ${collapsed?'collapsed':''}`}><div className="assistant-head"><span className="assistant-avatar">✧</span><div><strong>Herramientas</strong><small>Siempre a mano</small></div><button id="assistant-toggle" className="secondary" title="Mostrar u ocultar panel" onClick={onToggleSidebar}>◧</button></div><nav className="sidebar-tabs" aria-label="Herramientas laterales">{tools.map(([id,label])=><button key={id} className={`sidebar-tab ${sidebar===id?'active':''}`} data-sidebar={id} onClick={()=>onSidebar(id)}>{label}</button>)}</nav>{tools.map(([id])=><div key={id} className={`sidebar-pane ${sidebar===id?'active':''}`} id={`sidebar-${id}`}><div id={`${id}-app`}/></div>)}</aside></div>
    <BusyOverlay/>
  </>;
}
