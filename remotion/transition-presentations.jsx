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

// Old project names remain valid; their nearest native Remotion presentation is used.
const legacy={
  'Left':'remotion:slide:right','Pick Another':'remotion:fade',
  'Zoom Swipe':'remotion:zoom-blur','Dive & Bounce':'remotion:iris',
  'Snapshot Glam':'remotion:dreamy-zoom','Pull & Reveal':'remotion:wipe:right',
  'Fundido':'remotion:fade','Deslizar derecha':'remotion:slide:left',
  'Deslizar arriba':'remotion:slide:bottom','Deslizar abajo':'remotion:slide:top',
  'Barrido izquierda':'remotion:wipe:right','Barrido derecha':'remotion:wipe:left',
  'Círculo cierre':'remotion:iris','Disolver':'remotion:dissolve',
  'Pixelado':'remotion:dissolve','Blur':'remotion:linear-blur',
  'Flash':'remotion:push-cut'
};
const cache=new Map();

export function transitionPresentation(name,width,height){
  if(name==='Corte')return null;
  const id=legacy[name]||name,key=`${id}:${width}x${height}`;
  if(cache.has(key))return cache.get(key);
  const [,kind,direction]=id.split(':');
  let presentation;
  switch(kind){
    case 'fade':presentation=fade();break;
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
    default:presentation=fade();
  }
  cache.set(key,presentation);
  return presentation;
}
