import React, {memo} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider, useSelector} from 'react-redux';
import {configureStore, createSlice} from '@reduxjs/toolkit';
import {transitions, transitionLabels} from '../studio-core.mjs';
import {TranscriptApp} from './transcript.jsx';
import {ProjectApp} from './project.jsx';

const uiSlice=createSlice({
  name:'studioUi',
  initialState:{transitionSequence:['remotion:none'],projectId:null,projectTitle:'',exports:[],transcript:null,project:null,projects:[]},
  reducers:{
    showTransitions(state,action){state.transitionSequence=action.payload;},
    showExports(state,action){Object.assign(state,action.payload);},
    showTranscript(state,action){state.transcript=action.payload;},
    showProject(state,action){state.project=action.payload;},
    showProjects(state,action){state.projects=action.payload;}
  }
});
const store=configureStore({reducer:{studioUi:uiSlice.reducer}});
const roots=new Map();
function root(id){
  if(!roots.has(id))roots.set(id,createRoot(document.getElementById(id)));
  return roots.get(id);
}

const TransitionPicker=memo(function TransitionPicker({onToggle}){
  const selected=useSelector(state=>state.studioUi.transitionSequence);
  return <>{transitions.map(id=><button key={id} type="button" className={`choice-chip ${selected.includes(id)?'active':''}`} aria-pressed={selected.includes(id)} onClick={()=>onToggle(id)}>{transitionLabels[id]||id}</button>)}</>;
});

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

export function renderTransitionPicker(sequence,onToggle){
  store.dispatch(uiSlice.actions.showTransitions([...sequence]));
  root('global-transitions').render(<Provider store={store}><TransitionPicker onToggle={onToggle}/></Provider>);
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
