export const snapFrame=time=>Math.round(Math.max(0,Number(time)||0)*30)/30;

export function pointerTime(clientX,contentLeft,scale){
  return Math.max(0,(clientX-contentLeft-64)/Math.max(1,scale));
}

export function shiftTextRange(start,end,deltaSeconds,timelineEnd){
  const duration=Math.max(0,end-start),latest=Math.max(0,timelineEnd-duration);
  const next=Math.max(0,Math.min(latest,snapFrame(start+deltaSeconds)));
  return {start:next,end:next+duration};
}

export function boundaryTime(time,min,max){
  return Math.max(min,Math.min(max,snapFrame(time)));
}
