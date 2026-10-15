import {fade} from '@remotion/transitions/fade';
import {pushCut} from '@remotion/transitions/push-cut';
import {slide} from '@remotion/transitions/slide';
import {wipe} from '@remotion/transitions/wipe';
import {flip} from '@remotion/transitions/flip';
import {clockWipe} from '@remotion/transitions/clock-wipe';
import {iris} from '@remotion/transitions/iris';
import {zoomBlur} from '@remotion/transitions/zoom-blur';
import {dreamyZoom} from '@remotion/transitions/dreamy-zoom';
import {filmBurn} from '@remotion/transitions/film-burn';
import {linearBlur} from '@remotion/transitions/linear-blur';
import {bookFlip} from '@remotion/transitions/book-flip';
import {zoomInOut} from '@remotion/transitions/zoom-in-out';
import {dissolve} from '@remotion/transitions/dissolve';
import {ripple} from '@remotion/transitions/ripple';
import {crosswarp} from '@remotion/transitions/crosswarp';
import {crossZoom} from '@remotion/transitions/cross-zoom';
import {swap} from '@remotion/transitions/swap';
import {blurSlide} from '@remotion/transitions/blur-slide';

const cache=new Map();
function FadeThroughBlack({children,presentationDirection,presentationProgress}){
  const opacity=presentationDirection==='exiting'?Math.max(0,1-2*presentationProgress):Math.max(0,2*presentationProgress-1);
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
}

export function transitionPresentation(name,width,height){
  if(name==='remotion:none')return null;
  const id=name,key=`${id}:${width}x${height}`;
  if(cache.has(key))return cache.get(key);
  const [,kind,direction]=id.split(':');
  let presentation;
  switch(kind){
    case 'fade':presentation=fade();break;
    case 'fade-black':presentation={component:FadeThroughBlack,props:{}};break;
    case 'push-cut':presentation=pushCut();break;
    case 'slide':presentation=slide({direction:`from-${direction}`});break;
    case 'wipe':presentation=wipe({direction:`from-${direction}`});break;
    case 'flip':presentation=flip({direction:`from-${direction}`});break;
    case 'clock-wipe':presentation=clockWipe({width,height});break;
    case 'iris':presentation=iris({width,height});break;
    case 'zoom-blur':presentation=zoomBlur({});break;
    case 'dreamy-zoom':presentation=dreamyZoom({});break;
    case 'film-burn':presentation=filmBurn({});break;
    case 'linear-blur':presentation=linearBlur({});break;
    case 'book-flip':presentation=bookFlip({direction:`from-${direction}`});break;
    case 'zoom-in-out':presentation=zoomInOut({});break;
    case 'dissolve':presentation=dissolve({});break;
    case 'ripple':presentation=ripple({});break;
    case 'crosswarp':presentation=crosswarp({});break;
    case 'cross-zoom':presentation=crossZoom({});break;
    case 'swap':presentation=swap({});break;
    case 'blur-slide':presentation=blurSlide({direction:`from-${direction}`});break;
    default:return null;
  }
  cache.set(key,presentation);
  return presentation;
}
import React from 'react';
import {AbsoluteFill} from 'remotion';
