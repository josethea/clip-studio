import React from 'react';
import {Composition,registerRoot} from 'remotion';
import {StudioComposition} from './composition.jsx';

const Root=()=> <Composition id="ClipStudio" component={StudioComposition} width={1920} height={1080} fps={30} durationInFrames={30} defaultProps={{project:{scenes:[],assets:[],settings:{}}}} calculateMetadata={({props})=>({width:props.project.width,height:props.project.height,durationInFrames:Math.max(1,Math.ceil(props.project.duration*30))})}/>;
registerRoot(Root);
