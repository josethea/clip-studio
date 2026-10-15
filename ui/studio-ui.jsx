import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider} from 'react-redux';
import {configureStore, createSlice} from '@reduxjs/toolkit';
import {TranscriptApp} from './transcript.jsx';
import {ProjectApp} from './project.jsx';
import {AssetLibrary, AssetTarget, ChapterGrouping, AutofillControls, AutofillReviewButton, MissingMediaSummary, MediaBoard, MediaPagination, YoutubeSources} from './media.jsx';
import {MediaPage} from './media-page.jsx';
import {TimelineView,HistoryControls} from './editor.jsx';
import {TemplatePanel,EditorMediaPicker} from './editor-extras.jsx';
import {NarrationControls,EditorStoryboardControls,MediaStoryboardControls,TimelineToolbar} from './editor-workflow.jsx';
import {EditorInspectorPanel} from './editor-inspector-panel.jsx';
import {emptyEditorInteraction,selectEditorItem as deriveEditorSelection,restoreEditorInteraction as reconcileEditorSelection} from './editor-selection-model.mjs';
import {GlobalControls,FormatControls,PreviewControls} from './editor-controls.jsx';
import {ExportPage} from './export.jsx';
import {RenamePanel} from './rename.jsx';
import {GeminiPanel,KeysPanel,PromptsPanel} from './sidebar-tools.jsx';
import {StudioShell} from './studio-shell.jsx';
export {filesFromDrop} from './file-drop.jsx';
// The controller imports these from this bundle so React inputs and API calls share one store.
export {getCredential,subscribeCredentials} from '../credential-session.mjs';

const uiSlice=createSlice({
  name:'studioUi',
  initialState:{activeView:'project',activeSidebar:'gemini',sidebarCollapsed:false,projectIndicator:'Sin proyecto',notice:{message:'',bad:false},editorTitle:'Proyecto',editorDirty:'Todos los cambios guardados',previewSurface:{empty:true,status:'Los cambios se muestran al instante.'},busyView:{running:false,title:'Procesando…',detail:'Espera un momento.',percent:0},globalControls:null,formatControls:null,previewControls:null,editorHistory:{canUndo:false,canRedo:false},exportView:{projectId:null,title:'',problems:['Crea o abre un proyecto'],summary:'',resolutionNote:'',exports:[],ready:null},exportProgress:{mp4:'',running:false,capcut:'',capcutRunning:false,capcutResult:null},renameView:{count:0,duplicates:0,message:''},transcript:null,project:null,projects:[],mediaAssets:null,mediaTarget:{selected:null,scenes:[]},mediaChapters:null,mediaAutofill:{projectId:null,sceneCount:0,entries:[],start:1,running:false,remaining:0,missingOnly:false,requirements:'',canRun:false},autofillProgress:{visible:false,percent:0,status:''},youtubeSources:{projectId:null,json:''},mediaMissing:null,mediaBoard:null,mediaStock:null,mediaPagination:{assets:null,media:null},mediaSession:{activeScene:0,assetTargetScene:null,provider:'storyblocks',type:'videos',query:'',searched:false,missingOnly:false,pexelsPage:0,storyblocksPage:0,googlePage:0},editorScene:null,editorSceneExtras:null,editorTemplates:[],editorMediaPicker:null,editorNarration:null,editorStoryboard:null,editorTimeline:null,editorInspector:null,editorSelection:null,editorInteraction:emptyEditorInteraction()},
  reducers:{
    setActiveView(state,action){state.activeView=action.payload;},
    setActiveSidebar(state,action){state.activeSidebar=action.payload;},
    toggleSidebar(state){state.sidebarCollapsed=!state.sidebarCollapsed;},
    setProjectIndicator(state,action){state.projectIndicator=action.payload;},
    setNotice(state,action){state.notice=action.payload;},
    setEditorTitle(state,action){state.editorTitle=action.payload;},
    setEditorDirty(state,action){state.editorDirty=action.payload;},
    patchPreviewSurface(state,action){Object.assign(state.previewSurface,action.payload);},
    patchBusyView(state,action){Object.assign(state.busyView,action.payload);},
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
    showMediaTarget(state,action){state.mediaTarget=action.payload;},
    showMediaChapters(state,action){state.mediaChapters=action.payload;},
    showAutofill(state,action){if(state.mediaAutofill.projectId!==action.payload.projectId)state.autofillProgress={visible:false,percent:0,status:''};state.mediaAutofill=action.payload;},
    patchAutofillProgress(state,action){Object.assign(state.autofillProgress,action.payload);},
    showYoutubeSources(state,action){state.youtubeSources=action.payload;},
    showMediaMissing(state,action){state.mediaMissing=action.payload;},
    showMediaBoard(state,action){state.mediaBoard=action.payload;},
    showMediaStock(state,action){state.mediaStock=action.payload;},
    showMediaPagination(state,action){state.mediaPagination[action.payload.kind]=action.payload.view;},
    patchMediaSession(state,action){Object.assign(state.mediaSession,action.payload);},
    patchEditorInteraction(state,action){Object.assign(state.editorInteraction,action.payload);},
    selectEditorItem(state,action){state.editorInteraction=deriveEditorSelection(state.editorInteraction,action.payload.type,action.payload.index,action.payload.append);},
    restoreEditorInteraction(state,action){state.editorInteraction=reconcileEditorSelection(action.payload,state.editorInteraction);},
    showEditorScene(state,action){state.editorScene=action.payload;},
    showEditorSceneExtras(state,action){state.editorSceneExtras=action.payload;},
    showEditorTemplates(state,action){state.editorTemplates=action.payload;},
    showEditorMediaPicker(state,action){state.editorMediaPicker=action.payload;},
    showEditorNarration(state,action){state.editorNarration=action.payload;},
    showEditorStoryboard(state,action){state.editorStoryboard=action.payload;},
    showEditorTimeline(state,action){state.editorTimeline=action.payload;},
    showEditorHistory(state,action){state.editorHistory=action.payload;},
    showEditorInspector(state,action){state.editorInspector=action.payload;},
    showEditorSelection(state,action){state.editorSelection=action.payload;}
  }
});
const store=configureStore({reducer:{studioUi:uiSlice.reducer}});
const roots=new Map();
function root(id){
  if(!roots.has(id))roots.set(id,createRoot(document.getElementById(id)));
  return roots.get(id);
}

let onShellNavigate=()=>{};
export function mountStudioShell(onNavigate,onPreviewResize,onGlobalSave){
  onShellNavigate=onNavigate;
  flushSync(()=>root('app-root').render(<Provider store={store}><StudioShell onNavigate={navigateStudioView} onSidebar={id=>store.dispatch(uiSlice.actions.setActiveSidebar(id))} onToggleSidebar={()=>store.dispatch(uiSlice.actions.toggleSidebar())} onPreviewResize={onPreviewResize} onGlobalSave={onGlobalSave}/></Provider>));
}
export function navigateStudioView(view){
  if(!['project','transcript','assets','editor','export'].includes(view))return;
  flushSync(()=>store.dispatch(uiSlice.actions.setActiveView(view)));
  onShellNavigate(view);
}
export const showProjectIndicator=value=>store.dispatch(uiSlice.actions.setProjectIndicator(value));
export const showGlobalNotice=(message,bad=false)=>store.dispatch(uiSlice.actions.setNotice({message,bad}));
export const showEditorTitle=value=>store.dispatch(uiSlice.actions.setEditorTitle(value));
export const showEditorDirty=value=>store.dispatch(uiSlice.actions.setEditorDirty(value));
export const patchPreviewSurface=patch=>store.dispatch(uiSlice.actions.patchPreviewSurface(patch));
export const patchBusyView=patch=>store.dispatch(uiSlice.actions.patchBusyView(patch));

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
export function mountSidebarTools(actions,origin){
  root('gemini-app').render(<GeminiPanel actions={actions}/>);
  root('keys-app').render(<KeysPanel origin={origin}/>);
  root('prompts-app').render(<PromptsPanel actions={actions}/>);
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
export const renderAssetTarget=(view,actions)=>renderMediaIsland('media-target-scene',uiSlice.actions.showMediaTarget,view,AssetTarget,actions);
export const renderChapterGroups=(view,actions)=>renderMediaIsland('chapter-grouping',uiSlice.actions.showMediaChapters,view,ChapterGrouping,actions);
export function renderAutofillPanel(view,actions){
  store.dispatch(uiSlice.actions.showAutofill(view));
  if(!roots.has('autofill-app'))root('autofill-app').render(<Provider store={store}><AutofillControls key={view.projectId||'none'} actions={actions}/></Provider>);
  if(!roots.has('autofill-missing'))root('autofill-missing').render(<Provider store={store}><AutofillReviewButton actions={actions}/></Provider>);
}
export function patchAutofillProgress(patch){store.dispatch(uiSlice.actions.patchAutofillProgress(patch));}
export function renderYoutubeSources(view,actions){
  store.dispatch(uiSlice.actions.showYoutubeSources(view));
  root('youtube-sources').render(<Provider store={store}><YoutubeSources key={view.draftKey||'none'} actions={actions}/></Provider>);
}
export const renderMissingSummary=(view,actions)=>renderMediaIsland('media-missing-summary',uiSlice.actions.showMediaMissing,view,MissingMediaSummary,actions);
export const renderStoryboard=(view,actions)=>renderMediaIsland('media-board',uiSlice.actions.showMediaBoard,view,MediaBoard,actions);
export function renderMediaPagination(kind,view,actions){
  store.dispatch(uiSlice.actions.showMediaPagination({kind,view}));
  root(kind==='assets'?'asset-pagination':'media-pagination').render(<Provider store={store}><MediaPagination kind={kind} actions={actions}/></Provider>);
}
export function renderStockCards(view){store.dispatch(uiSlice.actions.showMediaStock(view));}
export function mountMediaPage(actions){flushSync(()=>root('assets').render(<MediaPage actions={actions}/>));}
export function getMediaSession(){return store.getState().studioUi.mediaSession;}
export function patchMediaSession(patch){store.dispatch(uiSlice.actions.patchMediaSession(patch));}
export function getEditorInteraction(){return store.getState().studioUi.editorInteraction;}
export function patchEditorInteraction(patch){store.dispatch(uiSlice.actions.patchEditorInteraction(patch));}
export function selectEditorInteraction(type,index,append=false){store.dispatch(uiSlice.actions.selectEditorItem({type,index,append}));}
export function restoreEditorSelection(sceneCount,textCount){store.dispatch(uiSlice.actions.restoreEditorInteraction({sceneCount,textCount}));}
export function renderSceneInspector(view){store.dispatch(uiSlice.actions.showEditorScene(view));}
export function renderSceneExtras(view){store.dispatch(uiSlice.actions.showEditorSceneExtras(view));}
export function renderTemplatePanel(view,actions){renderMediaIsland('template-panel',uiSlice.actions.showEditorTemplates,view,TemplatePanel,actions);}
export function renderEditorMediaPicker(view,actions){
  store.dispatch(uiSlice.actions.showEditorMediaPicker(view));
  flushSync(()=>root('media-picker-app').render(<Provider store={store}><EditorMediaPicker actions={actions}/></Provider>));
}
export function mountEditorInspector(actions){root('inspector-app').render(<Provider store={store}><EditorInspectorPanel actions={actions}/></Provider>);}
export function renderInspectorSelection(view){store.dispatch(uiSlice.actions.showEditorSelection(view));}
export function renderNarrationPanel(view,actions){renderMediaIsland('narration-controls',uiSlice.actions.showEditorNarration,view,NarrationControls,actions);}
export function renderStoryboardSettings(view,actions){
  store.dispatch(uiSlice.actions.showEditorStoryboard(view));
  if(!roots.has('editor-storyboard-controls'))root('editor-storyboard-controls').render(<Provider store={store}><EditorStoryboardControls actions={actions}/></Provider>);
  if(!roots.has('media-storyboard-controls'))root('media-storyboard-controls').render(<Provider store={store}><MediaStoryboardControls actions={actions}/></Provider>);
}
export function renderEditorTimeline(view,actions){
  store.dispatch(uiSlice.actions.showEditorTimeline(view));
  if(!roots.has('timeline-root'))root('timeline-root').render(<Provider store={store}><TimelineView actions={actions}/></Provider>);
  if(!roots.has('timeline-toolbar'))root('timeline-toolbar').render(<Provider store={store}><TimelineToolbar actions={actions}/></Provider>);
}
export function renderEditorHistory(view,actions){
  store.dispatch(uiSlice.actions.showEditorHistory(view));
  if(!roots.has('editor-actions'))root('editor-actions').render(<Provider store={store}><HistoryControls actions={actions}/></Provider>);
}
export function renderEditorInspector(view){
  store.dispatch(uiSlice.actions.showEditorInspector(view));
}
