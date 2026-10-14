import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider} from 'react-redux';
import {configureStore, createSlice} from '@reduxjs/toolkit';
import {TranscriptApp} from './transcript.jsx';
import {ProjectApp} from './project.jsx';
import {AssetLibrary, ChapterGrouping, AutofillEntries, MissingMediaSummary, MediaBoard, MediaPagination} from './media.jsx';
import {MediaPage} from './media-page.jsx';
import {SceneInspector, TimelineView, HistoryControls, EffectInspector, TransitionInspector, SfxInspector, AudioInspector} from './editor.jsx';
import {TextInspector,SubtitleInspector,MultiInspector} from './editor-text.jsx';
import {GlobalControls,FormatControls,PreviewControls} from './editor-controls.jsx';
import {ExportPage} from './export.jsx';
import {RenamePanel} from './rename.jsx';

const uiSlice=createSlice({
  name:'studioUi',
  initialState:{globalControls:null,formatControls:null,previewControls:null,editorHistory:{canUndo:false,canRedo:false},exportView:{projectId:null,title:'',problems:['Crea o abre un proyecto'],summary:'',resolutionNote:'',exports:[],ready:null},exportProgress:{mp4:'',running:false,capcut:'',capcutRunning:false,capcutResult:null},renameView:{count:0,duplicates:0,message:''},transcript:null,project:null,projects:[],mediaAssets:null,mediaChapters:null,autofillEntries:[],mediaMissing:null,mediaBoard:null,mediaStock:null,mediaPagination:{assets:null,media:null},mediaSession:{activeScene:0,provider:'storyblocks',type:'videos',query:'',searched:false,missingOnly:false,pexelsPage:0,storyblocksPage:0,googlePage:0},editorScene:null,editorTimeline:null,editorInspector:null},
  reducers:{
    showGlobalControls(state,action){state.globalControls=action.payload;},
    showFormatControls(state,action){state.formatControls=action.payload;},
    showPreviewControls(state,action){state.previewControls=action.payload;},
    showExport(state,action){if(state.exportView.projectId!==action.payload.projectId)state.exportProgress={mp4:'',running:false,capcut:'',capcutRunning:false,capcutResult:null};state.exportView=action.payload;},
    patchExportProgress(state,action){Object.assign(state.exportProgress,action.payload);},
    showRename(state,action){state.renameView=action.payload;},
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
    showEditorHistory(state,action){state.editorHistory=action.payload;},
    showEditorInspector(state,action){state.editorInspector=action.payload;}
  }
});
const store=configureStore({reducer:{studioUi:uiSlice.reducer}});
const roots=new Map();
function root(id){
  if(!roots.has(id))roots.set(id,createRoot(document.getElementById(id)));
  return roots.get(id);
}

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

export function renderExportPage(view,actions){
  store.dispatch(uiSlice.actions.showExport(view));
  if(!roots.has('export-app'))root('export-app').render(<Provider store={store}><ExportPage actions={actions}/></Provider>);
}
export function patchExportProgress(patch){store.dispatch(uiSlice.actions.patchExportProgress(patch));}
export function renderRenamePanel(view,actions){
  store.dispatch(uiSlice.actions.showRename(view));
  if(!roots.has('rename-app'))root('rename-app').render(<Provider store={store}><RenamePanel actions={actions}/></Provider>);
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
export function renderEditorTimeline(view,actions){
  store.dispatch(uiSlice.actions.showEditorTimeline(view));
  if(!roots.has('timeline-root'))root('timeline-root').render(<Provider store={store}><TimelineView actions={actions}/></Provider>);
}
export function renderEditorHistory(view,actions){
  store.dispatch(uiSlice.actions.showEditorHistory(view));
  if(!roots.has('editor-actions'))root('editor-actions').render(<Provider store={store}><HistoryControls actions={actions}/></Provider>);
}
export function renderEditorInspector(view,actions){
  store.dispatch(uiSlice.actions.showEditorInspector(view));
  for(const [id,Component] of [['inspector-effect',EffectInspector],['inspector-transition',TransitionInspector],['inspector-sfx',SfxInspector]])if(!roots.has(id))root(id).render(<Provider store={store}><Component actions={actions}/></Provider>);
  for(const kind of ['voice','music'])if(!roots.has(`inspector-${kind}`))root(`inspector-${kind}`).render(<Provider store={store}><AudioInspector kind={kind} actions={actions}/></Provider>);
  for(const [id,Component] of [['inspector-text',TextInspector],['inspector-subtitle',SubtitleInspector],['inspector-multi',MultiInspector]])if(!roots.has(id))root(id).render(<Provider store={store}><Component actions={actions}/></Provider>);
}
