export function whisperWords(result) {
  return (result.segments || []).flatMap(s => s.words || [])
    .map(w => ({ text: String(w.word || '').trim(), start: Number(w.start), end: Number(w.end) }))
    .filter(w => w.text && Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start);
}

export function geminiWords(result) {
  return (result.steps || []).flatMap(step => step.content || [])
    .flatMap(content => content.annotations || [])
    .filter(a => a.type === 'word_info')
    .map(a => ({ text: String(a.text || '').trim(), start: parseFloat(a.start_offset), end: parseFloat(a.end_offset) }))
    .filter(w => w.text && Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start);
}

export function speechEnd(words) {
  if (!words.length) throw new Error('No se detectaron palabras en la locución');
  return Math.max(...words.map(w => w.end));
}

export function fitSegments(segments, targetSeconds) {
  const durations = segments.map(s => Math.min(8, Number(s.end) - Number(s.start)));
  const total = durations.reduce((a,b) => a+b, 0);
  if (!Number.isFinite(total) || total <= 0) throw new Error('El plan no contiene segmentos válidos');
  const factor = Math.min(1, targetSeconds / total);
  return segments.map((s,i) => ({ start:Number(s.start), duration:Math.max(.5,durations[i] * factor) }));
}

export function captionCues(words, audioSeconds, videoSeconds) {
  const factor = Math.min(1, videoSeconds / audioSeconds);
  const cues = [];
  let group = [];
  const flush = () => {
    if (!group.length) return;
    const start = Math.max(0, (group[0].start - .04) * factor);
    const end = Math.min(videoSeconds, (group.at(-1).end + .06) * factor);
    if (end > start) cues.push({ text:group.map(w => w.text).join(' '), start, end });
    group = [];
  };
  for (const word of words) {
    if (group.length && (group.length >= 4 || word.start - group.at(-1).end > .38)) flush();
    group.push(word);
  }
  flush();
  if (cues.length > 1 && cues.at(-1).end - cues.at(-1).start < .65) {
    const last = cues.pop();
    cues.at(-1).text += ` ${last.text}`;
    cues.at(-1).end = last.end;
  }
  for (let i=0; i<cues.length-1; i++) cues[i].end = Math.min(cues[i].end,cues[i+1].start);
  return cues;
}
