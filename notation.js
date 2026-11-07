import { noteValue, beatLabel } from './rhythm.js?v=0.003';
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
export function layoutChord(pitches, x) {
  const heads=[];
  return pitches.map((midi,pitchIndex)=>{
    const position=notePosition(midi);
    const column=[0,18,36,54,72].find(dx=>!heads.some(h=>h.bass===position.bass&&Math.abs(h.y-position.y)<9&&h.dx===dx))??90;
    heads.push({...position,dx:column});return {midi,pitchIndex,nx:x+column,...position};
  });
}
function rhythmicStems(heads,value,index) {
  if(!value.stem)return '';
  let svg='';
  for(const bass of [false,true]){
    const staff=heads.filter(h=>h.bass===bass);if(!staff.length)continue;
    const stemX=Math.max(...staff.map(h=>h.nx))+8,tip=Math.min(...staff.map(h=>h.y))-38,bottom=Math.max(...staff.map(h=>h.y));
    svg+=`<path class="note-stem" data-stem="${index}-${bass?'bass':'treble'}" d="M${stemX} ${bottom}V${tip}" stroke="#243e35" stroke-width="1.4" fill="none"/>`;
    for(const head of staff)if(head.nx+8<stemX)svg+=`<path d="M${head.nx+7} ${head.y}H${stemX}" stroke="#243e35" stroke-width="1.3"/>`;
    for(let flag=0;flag<value.flags;flag++){
      const y=tip+flag*11;
      svg+=`<path class="note-flag" d="M${stemX} ${y}C${stemX+6} ${y+7} ${stemX+22} ${y+9} ${stemX+11} ${y+23}C${stemX+18} ${y+9} ${stemX+5} ${y+12} ${stemX} ${y+7}Z" fill="#243e35"/>`;
    }
  }
  return svg;
}
export function renderScore(events, width = 780, selected = -1, selectedPitch = -1, tempo=120) {
  width=Math.max(340,width);
  const maxChord=Math.max(1,...events.map(e=>e.pitches.length)),cell=maxChord>4?145:maxChord>1?100:74;
  const perRow=Math.max(1,Math.floor((width-90)/cell)),rows=Math.max(1,Math.ceil(events.length/perRow)),rowHeight=maxChord>6?340:300;
  const accidentals=new Map(),hasRhythm=events.some(e=>e.beats!=null);
  let content=`<rect width="100%" height="100%" fill="#fffefa"/><text x="16" y="18" fill="#718078" font-size="10" font-family="sans-serif">P142 聽音認譜 · ${hasRhythm?'音高與手動拍數譜':'音高順序譜（拍數未設定）'}</text>`;
  if(hasRhythm)content+=`<text x="16" y="33" fill="#718078" font-size="9" font-family="sans-serif">四分音符＝1 拍 · 速度 ${tempo} BPM · 未設定者僅表示音高</text>`;
  for(let row=0;row<rows;row++){
    const top=85+row*rowHeight,start=row*perRow,group=events.slice(start,start+perRow),spacing=(width-90)/perRow;
    content+=`<g transform="translate(0,${top})">`;
    for(const y of [50,62,74,86,98,146,158,170,182,194])content+=line(15,y,width-15,y);
    content+=line(15,50,15,194)+treble+bassClef;
    for(let j=0;j<group.length;j++){
      const event=group[j],idx=start+j,x=70+j*spacing+spacing*.43;
      const active=selected===idx,value=noteValue(event.beats),heads=layoutChord(event.pitches,x);
      content+=`<rect class="group-hit${active?' selected-group':''}" data-group="${idx}" x="${70+j*spacing}" y="-53" width="${spacing-5}" height="314" fill="${active?'#eff3e4':'transparent'}" fill-opacity=".5" rx="7" tabindex="0" role="button" aria-label="選取第 ${idx+1} 組音"/><text x="${x}" y="-40" text-anchor="middle" font-size="9" fill="#7c8970" font-family="sans-serif">${idx+1}</text>`;
      const placedAccidentals=[];
      content+=rhythmicStems(heads,value,idx);
      for(const head of heads){
        const {midi,pitchIndex:p,nx,y,sharp,bass}=head,naturalKey=sharp?midi-1:midi,natural=!sharp&&accidentals.get(naturalKey);
        const uncertain=!event.edited&&!event.manual&&((Number.isFinite(event.confidence)&&event.confidence<.68)||Math.abs(event.cents||0)>30);
        accidentals.set(naturalKey,sharp);
        const ledger=[];
        if(!bass&&y>=110)for(let ly=110;ly<=y;ly+=12)ledger.push(ly);
        if(!bass&&y<=38)for(let ly=38;ly>=y;ly-=12)ledger.push(ly);
        if(bass&&y>=206)for(let ly=206;ly<=y;ly+=12)ledger.push(ly);
        if(bass&&y<=134)for(let ly=134;ly>=y;ly-=12)ledger.push(ly);
        const time=Number.isFinite(event.start)?`原音 ${event.start.toFixed(2)} 秒`:'手動新增，未對應原音時間';
        content+=`<g class="note-hit${active&&selectedPitch===p?' selected':''}" data-event="${idx}" data-pitch="${p}" tabindex="0" role="button" aria-label="第 ${idx+1} 組，${noteName(midi)}，點選試聽與修正"><title>${noteName(midi)} · ${time} · ${beatLabel(event.beats)}${uncertain?' · 待確認':''}</title><rect class="note-ring" x="${nx-10}" y="${y-7}" width="20" height="14" rx="5" fill="${active&&selectedPitch===p?'#e5ebc9':'transparent'}" stroke="${active&&selectedPitch===p?'#7c925d':'none'}"/>`;
        for(const ly of ledger)content+=line(nx-15,ly,nx+15,ly);
        if(sharp||natural){
          const col=[0,1,2,3,4,5].find(c=>!placedAccidentals.some(a=>a.col===c&&Math.abs(a.y-y)<27))??6;
          placedAccidentals.push({col,y});const ax=x-23-col*12;
          if(sharp)content+=`<path d="M${ax} ${y-10}v22m7-24v22m-11-12 15-3m-15 10 15-3" stroke="#243e35" stroke-width="1.5" fill="none"/>`;
          if(natural)content+=`<path d="M${ax} ${y-12}v20l7-3m0-13v20m-7-12 7-3" stroke="#243e35" stroke-width="1.5" fill="none"/>`;
        }
        content+=`<ellipse class="notehead${value.hollow?' hollow':''}" data-note-value="${value.kind}" cx="${nx}" cy="${y}" rx="${value.kind==='whole'?10:8.5}" ry="5.6" transform="rotate(-18 ${nx} ${y})" fill="${value.hollow?'#fffefa':'#243e35'}" stroke="#243e35" stroke-width="${value.hollow?1.6:0}"/>`;
        if(value.dotted){const dotY=(y-(bass?146:50))%12===0?y-6:y;content+=`<circle class="augmentation-dot" cx="${Math.max(...heads.map(h=>h.nx))+17}" cy="${dotY}" r="2" fill="#243e35"/>`;}
        if(uncertain)content+=`<ellipse cx="${nx}" cy="${y}" rx="13" ry="10" fill="none" stroke="#b86c2a" stroke-width="1" stroke-dasharray="2 2"/>`;
        content+='</g>';
      }
      const labels=[];for(let k=0;k<event.pitches.length;k+=3)labels.push(event.pitches.slice(k,k+3).map(noteName).join(' · '));
      labels.forEach((label,k)=>{content+=`<text x="${x+6}" y="${232+k*12}" text-anchor="middle" font-size="10" fill="#53674c" font-family="sans-serif">${label}</text>`;});
      content+=`<text class="beat-label" x="${x+6}" y="${260+(labels.length-1)*12}" text-anchor="middle" font-size="9" fill="#5f7451">${beatLabel(event.beats)}</text>`;
      if(event.edited||event.manual)content+=`<text class="manual-label" x="${x+6}" y="${247+(labels.length-1)*12}" text-anchor="middle" font-size="8" fill="#718078" font-family="sans-serif">${event.manual?'手動新增':'已編輯'}</text>`;
    }
    content+='</g>';
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${rows*rowHeight+85}" role="group" aria-label="按聲音順序排列的音高五線譜，拍數僅由使用者手動設定"><style>.note-hit,.group-hit{cursor:pointer}.note-hit:focus .note-ring{stroke:#b38c43;stroke-width:2}</style>${content}</svg>`;
}
