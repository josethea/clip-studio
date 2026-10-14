export const TIMELINE_OVERSCAN_PX=320;

export function visibleTimelineItems(items,scale,scrollLeft,viewportWidth,overscan=TIMELINE_OVERSCAN_PX){
  const left=Math.max(0,scrollLeft-overscan),right=scrollLeft+Math.max(0,viewportWidth)+overscan;
  return items.filter(item=>{
    const start=64+item.start*scale;
    const end=64+(item.end??item.start)*scale;
    return Math.max(start,end, start+2)>=left&&Math.min(start,end)<=right;
  });
}

export function visibleTimelineTicks(ticks,scrollLeft,viewportWidth,overscan=TIMELINE_OVERSCAN_PX){
  const left=Math.max(0,scrollLeft-overscan),right=scrollLeft+Math.max(0,viewportWidth)+overscan;
  return ticks.filter(tick=>tick.left>=left&&tick.left<=right);
}
