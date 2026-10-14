import React from 'react';
import {useSelector} from 'react-redux';
import {SceneInspector,EffectInspector,TransitionInspector,SfxInspector,AudioInspector} from './editor.jsx';
import {SceneExtraControls} from './editor-extras.jsx';
import {TextInspector,SubtitleInspector,MultiInspector} from './editor-text.jsx';
import {EmptyInspector} from './editor-workflow.jsx';

export function EditorInspectorPanel({actions}){
  const selection=useSelector(state=>state.studioUi.editorSelection);
  const type=selection?.type||'empty';
  let content;
  if(type==='scene')content=<><div className="scene-list"><SceneInspector actions={actions.scene}/></div><SceneExtraControls actions={actions.sceneExtras}/></>;
  else if(type==='effect')content=<EffectInspector actions={actions.inspector}/>;
  else if(type==='transition')content=<TransitionInspector actions={actions.inspector}/>;
  else if(type==='sfx')content=<SfxInspector actions={actions.inspector}/>;
  else if(type==='voice'||type==='music')content=<AudioInspector kind={type} actions={actions.inspector}/>;
  else if(type==='text')content=<TextInspector actions={actions.inspector}/>;
  else if(type==='subtitle')content=<SubtitleInspector actions={actions.inspector}/>;
  else if(type==='multi')content=<MultiInspector actions={actions.inspector}/>;
  else content=<EmptyInspector actions={actions.empty}/>;
  return <><div className="editor-pane-title"><span>{selection?.heading||'PROPIEDADES'}</span><small>{selection?.time||''}</small></div><div id={`inspector-${type}`} className="editor-pane-body">{content}</div></>;
}
