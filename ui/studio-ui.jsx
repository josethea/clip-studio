import React, {memo} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider, useSelector} from 'react-redux';
import {configureStore, createSlice} from '@reduxjs/toolkit';
import {TranscriptApp} from './transcript.jsx';
import {ProjectApp} from './project.jsx';
import {AssetLibrary, ChapterGrouping, AutofillEntries, MissingMediaSummary, MediaBoard, MediaPagination} from './media.jsx';
import {MediaPage} from './media-page.jsx';
import {SceneInspector, TimelineRuler, TimelineLane, EffectInspector, TransitionInspector, SfxInspector, AudioInspector} from './editor.jsx';
import {TextInspector,SubtitleInspector,MultiInspector} from './editor-text.jsx';
import {GlobalControls,FormatControls,PreviewControls} from './editor-controls.jsx';

const uiSlice=createSlice({
  name:'studioUi',
  initialState:{globalControls:null,formatControls:null,previewControls:null,projectId:null,projectTitle:'',exports:[],transcript:null,project:null,projects:[],mediaAssets:null,mediaChapters:null,autofillEntries:[],mediaMissing:null,mediaBoard:null,mediaStock:null,mediaPagination:{assets:null,media:null},mediaSession:{activeScene:0,provider:'storyblocks',type:'videos',query:'',searched:false,missingOnly:false,pexelsPage:0,storyblocksPage:0,googlePage:0},editorScene:null,editorTimeline:null,editorInspector:null},
  reducers:{
    showGlobalControls(state,action){state.globalControls=action.payload;},
    showFormatControls(state,action){state.formatControls=action.payload;},
    showPreviewControls(state,action){state.previewControls=action.payload;},
    showExports(state,action){Object.assign(state,action.payload);},
    showTranscript(state,action){state.transcript=action.payload;},
    showProject(state,action){state.project=action.payload;},
    showProjects(state,action){state.projects=action.payload;},
    showMediaAssets(state,action){state.mediaAssets=action.payload;},
    showMediaChapters(state,action){state.mediaChapters=action.payload;},
    showAutofillEntries(state,action){state.autofillEntries=action.payload;},
    showMediaMissing(state,action){state.mediaMissing=action.payload;},
    showMediaBoard(state,action){state.mediaBoard=action.payload;},
    showMediaStock(state,action){state.mediaStock=action.payload;},
    showMediaPagination(state,action){state.mediaPagination[action.payload.kind]=action.payload.view;},
    patchMediaSession(state,action){Object.assign(state.mediaSession,action.payload);},
    showEditorScene(state,action){state.editorScene=action.payload;},
    showEditorTimeline(state,action){state.editorTimeline=action.payload;},
    showEditorInspector(state,action){state.editorInspector=action.payload;}
  }
});
const store=configureStore({reducer:{studioUi:uiSlice.reducer}});
const roots=new Map();
function root(id){
  if(!roots.has(id))roots.set(id,createRoot(document.getElementById(id)));
  return roots.get(id);
}

const ExportHistory=memo(function ExportHistory(){
  const {projectId,projectTitle,exports}=useSelector(state=>state.studioUi);
  if(!projectId||!exports.length)return <div className="studio-item">Aún no hay exportaciones.</div>;
  return <>{exports.map(item=>{
    const url=`/api/studio/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(item.name)}`;
    return <div className="studio-item" key={item.name}>
      <div><strong>{item.name}</strong><small>{formatTime(item.duration)} · {item.width}×{item.height}{Number.isFinite(item.renderDurationMs)?` · Tiempo de exportación ${formatElapsed(item.renderDurationMs)}`:''}</small></div>
      <div className="studio-actions"><a href={url} target="_blank" rel="noopener noreferrer">Ver</a><a href={url} download={`${projectTitle}.mp4`}>Descargar MP4</a></div>
    </div>;
  })}</>;
});

function formatTime(value){const n=Number(value)||0;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}.${String(Math.round(n%1*1000)).padStart(3,'0')}`;}
function formatElapsed(value){const n=Math.max(0,Math.round(Number(value)/1000)||0);return `${String(Math.floor(n/3600)).padStart(2,'0')}:${String(Math.floor(n/60)%60).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}

export function renderGlobalSettings(view,actions){
  store.dispatch(uiSlice.actions.showGlobalControls(view));
  if(!roots.has('global-controls'))root('global-controls').render(<Provider store={store}><GlobalControls actions={actions}/></Provider>);
}
export function renderFormatSettings(view,actions){
  store.dispatch(uiSlice.actions.showFormatControls(view));
  if(!roots.has('format-controls'))root('format-controls').render(<Provider store={store}><FormatControls actions={actions}/></Provider>);
}
export function renderPreviewTransport(view,actions){
  store.dispatch(uiSlice.actions.showPreviewControls(view));
  if(!roots.has('preview-controls'))root('preview-controls').render(<Provider store={store}><PreviewControls actions={actions}/></Provider>);
}

export function renderExportHistory(project){
  store.dispatch(uiSlice.actions.showExports({projectId:project.id,projectTitle:project.title,exports:[...(project.exports||[])]}));
  root('export-list').render(<Provider store={store}><ExportHistory/></Provider>);
}

export function renderTranscriptPanel(info,actions){
  store.dispatch(uiSlice.actions.showTranscript(info));
  root('transcript-app').render(<Provider store={store}><TranscriptApp actions={actions}/></Provider>);
}

export function renderProjectPanel(info,actions){
  store.dispatch(uiSlice.actions.showProject(info));
  root('project-app').render(<Provider store={store}><ProjectApp actions={actions}/></Provider>);
}

export function renderProjectOptions(projects){
  store.dispatch(uiSlice.actions.showProjects(projects.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))));
}

function renderMediaIsland(id,action,payload,Component,actions){
  store.dispatch(action(payload));
  root(id).render(<Provider store={store}><Component actions={actions}/></Provider>);
}
export const renderAssetLibrary=(view,actions)=>renderMediaIsland('asset-list',uiSlice.actions.showMediaAssets,view,AssetLibrary,actions);
export const renderChapterGroups=(view,actions)=>renderMediaIsland('chapter-grouping',uiSlice.actions.showMediaChapters,view,ChapterGrouping,actions);
export const renderAutofillSequence=(entries,actions)=>renderMediaIsland('autofill-sequence',uiSlice.actions.showAutofillEntries,entries,AutofillEntries,actions);
export const renderMissingSummary=(view,actions)=>renderMediaIsland('media-missing-summary',uiSlice.actions.showMediaMissing,view,MissingMediaSummary,actions);
export const renderStoryboard=(view,actions)=>renderMediaIsland('media-board',uiSlice.actions.showMediaBoard,view,MediaBoard,actions);
export function renderMediaPagination(kind,view,actions){
  store.dispatch(uiSlice.actions.showMediaPagination({kind,view}));
  root(kind==='assets'?'asset-pagination':'media-pagination').render(<Provider store={store}><MediaPagination kind={kind} actions={actions}/></Provider>);
}
export function renderStockCards(view){store.dispatch(uiSlice.actions.showMediaStock(view));}
export function mountMediaPage(){flushSync(()=>root('assets').render(<MediaPage/>));}
export function getMediaSession(){return store.getState().studioUi.mediaSession;}
export function patchMediaSession(patch){store.dispatch(uiSlice.actions.patchMediaSession(patch));}
export function renderSceneInspector(view,actions){renderMediaIsland('scene-list',uiSlice.actions.showEditorScene,view,SceneInspector,actions);}
export function renderEditorTimeline(view){
  store.dispatch(uiSlice.actions.showEditorTimeline(view));
  if(!roots.has('timeline-ruler'))root('timeline-ruler').render(<Provider store={store}><TimelineRuler/></Provider>);
  for(const lane of ['text-timeline','timeline','effect-timeline','transition-timeline','audio-timeline','music-timeline','sfx-timeline','subtitle-timeline'])if(!roots.has(lane))root(lane).render(<Provider store={store}><TimelineLane lane={lane}/></Provider>);
}
export function renderEditorInspector(view,actions){
  store.dispatch(uiSlice.actions.showEditorInspector(view));
  for(const [id,Component] of [['inspector-effect',EffectInspector],['inspector-transition',TransitionInspector],['inspector-sfx',SfxInspector]])if(!roots.has(id))root(id).render(<Provider store={store}><Component actions={actions}/></Provider>);
  for(const kind of ['voice','music'])if(!roots.has(`inspector-${kind}`))root(`inspector-${kind}`).render(<Provider store={store}><AudioInspector kind={kind} actions={actions}/></Provider>);
  for(const [id,Component] of [['inspector-text',TextInspector],['inspector-subtitle',SubtitleInspector],['inspector-multi',MultiInspector]])if(!roots.has(id))root(id).render(<Provider store={store}><Component actions={actions}/></Provider>);
}
