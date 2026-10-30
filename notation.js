export const names = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const degree = [0,0,1,1,2,3,3,4,4,5,5,6];
export const noteName = midi => names[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
export function notePosition(midi) {
  const oct = Math.floor(midi / 12) - 1, index = oct * 7 + degree[midi % 12], bass = midi < 60;
  return { y: bass ? 194 - (index - 18) * 6 : 98 - (index - 30) * 6, sharp: [1,3,6,8,10].includes(midi % 12), bass, index };
}
const line = (x1,y1,x2,y2,extra='') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#9ba792" stroke-width=".8" ${extra}/>`;
const treble = `<g transform="translate(18,26)"><path d="M20 77C-2 70 3 47 21 39C37 31 40 10 28 1C18 10 18 30 22 49L32 88C36 106 13 110 11 95C10 87 21 85 23 93C25 100 17 103 15 99M23 52C8 47 4 69 20 73C32 76 39 60 29 55C17 48 10 60 17 65" fill="none" stroke="#52634c" stroke-width="3.2" stroke-linecap="round"/></g>`;
const bassClef = `<g transform="translate(23,146)"><path d="M3 13C-4 4 6-3 15 1C31 8 23 32 1 43C15 29 24 9 12 5C7 3 4 6 5 9" fill="#52634c"/><circle cx="5" cy="10" r="4.5" fill="#52634c"/><circle cx="31" cy="6" r="2" fill="#52634c"/><circle cx="31" cy="18" r="2" fill="#52634c"/></g>`;
export function renderScore(events, width = 780, selected = -1, selectedPitch = -1) {
  width = Math.max(340, width); const perRow = Math.max(3, Math.floor((width - 100) / 74)), rows = Math.ceil(events.length / perRow), rowHeight = 300;
  const accidentals = new Map();
  let content = `<rect width="100%" height="100%" fill="#fffefa"/><text x="16" y="18" fill="#718078" font-size="10" font-family="sans-serif">P142 聽音認譜 · 音高順序譜（不表示節奏）</text>`;
  for (let row = 0; row < rows; row++) {
    const top = 85 + row * rowHeight, start = row * perRow, group = events.slice(start, start + perRow);
    const usable = width - 90, spacing = usable / Math.max(group.length, perRow);
    content += `<g transform="translate(0,${top})">`;
    for (const y of [50,62,74,86,98,146,158,170,182,194]) content += line(15,y,width-15,y);
    content += line(15,50,15,194) + treble + bassClef;
    for (let j = 0; j < group.length; j++) {
      const event = group[j], idx = start + j, x = 88 + j * spacing + spacing / 2;
      content += `<text x="${x}" y="-40" text-anchor="middle" font-size="9" fill="#a0aa93" font-family="sans-serif">${idx+1}</text>`;
      for (let p = 0; p < event.pitches.length; p++) {
        const midi = event.pitches[p], {y,sharp,bass} = notePosition(midi), naturalKey = sharp ? midi-1 : midi, natural = !sharp && accidentals.get(naturalKey), uncertain = event.confidence < .68 || Math.abs(event.cents || 0) > 30;
        accidentals.set(naturalKey, sharp);
        const ledger = [];
        if (!bass && y >= 110) for (let ly=110; ly<=y; ly+=12) ledger.push(ly);
        if (!bass && y <= 38) for (let ly=38; ly>=y; ly-=12) ledger.push(ly);
        if (bass && y >= 206) for (let ly=206; ly<=y; ly+=12) ledger.push(ly);
        if (bass && y <= 134) for (let ly=134; ly>=y; ly-=12) ledger.push(ly);
        // Adjacent diatonic noteheads in a chord sit on opposite sides.
        const overlap = p > 0 && Math.abs(notePosition(event.pitches[p-1]).y - y) < 9, nx = x + (overlap ? 11 : 0);
        content += `<g class="note-hit${selected===idx && selectedPitch===p?' selected':''}" data-event="${idx}" data-pitch="${p}" tabindex="0" role="button" aria-label="第 ${idx+1} 組，${noteName(midi)}，點選試聽與修正"><title>${noteName(midi)} · 原音 ${event.start.toFixed(2)} 秒${uncertain?' · 待確認':''}</title><rect class="note-ring" x="${nx-18}" y="${y-16}" width="36" height="32" rx="5" fill="transparent" stroke="none"/>`;
        for (const ly of ledger) content += line(nx-15,ly,nx+15,ly);
        if (sharp) content += `<path d="M${nx-23} ${y-10}v22m7-24v22m-11-12 15-3m-15 10 15-3" stroke="#243e35" stroke-width="1.5" fill="none"/>`;
        if (natural) content += `<path d="M${nx-22} ${y-12}v20l7-3m0-13v20m-7-12 7-3" stroke="#243e35" stroke-width="1.5" fill="none"/>`;
        content += `<ellipse class="notehead" cx="${nx}" cy="${y}" rx="8.5" ry="5.6" transform="rotate(-18 ${nx} ${y})" fill="#243e35"/>`;
        if (uncertain) content += `<ellipse cx="${nx}" cy="${y}" rx="13" ry="10" fill="none" stroke="#b86c2a" stroke-width="1" stroke-dasharray="2 2"/>`;
        content += `</g>`;
      }
      content += `<text x="${x}" y="232" text-anchor="middle" font-size="${event.pitches.length>3?8:10}" fill="#53674c" font-family="sans-serif">${event.pitches.map(noteName).join(' · ')}</text>`;
      if (event.edited) content += `<text x="${x}" y="247" text-anchor="middle" font-size="8" fill="#718078" font-family="sans-serif">已修正</text>`;
    }
    content += `</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${rows*rowHeight+85}" role="group" aria-label="按聲音順序排列的音高五線譜，沒有拍號與時值"><style>.note-hit{cursor:pointer}</style>${content}</svg>`;
}
