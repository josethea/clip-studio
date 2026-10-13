export function visibleScenesAtTime(scenes, time) {
  let currentIndex = -1;
  for (let i = 0; i < scenes.length; i++) {
    if (scenes[i].start <= time) currentIndex = i;
    else break;
  }

  for (let i = 0; i < scenes.length - 1; i++) {
    const duration = Number(scenes[i].transitionSeconds) || 0;
    if (duration <= 0) continue;
    const start = scenes[i].end - duration / 2;
    const end = scenes[i].end + duration / 2;
    if (time >= start && time < end) {
      return {indexes: [i, i + 1], transitionIndex: i, progress: (time - start) / duration};
    }
  }

  return {indexes: scenes.length ? [Math.max(0, currentIndex)] : [], transitionIndex: -1, progress: 1};
}

export function sceneVisibleBounds(scenes, index) {
  const scene = scenes[index];
  const previousHalf = index > 0 ? (Number(scenes[index - 1].transitionSeconds) || 0) / 2 : 0;
  const nextHalf = index < scenes.length - 1 ? (Number(scene.transitionSeconds) || 0) / 2 : 0;
  return {start: scene.start - previousHalf, end: scene.end + nextHalf};
}
