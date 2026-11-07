// P142 pitch-sequence editing. Pure state/history, independent of audio and DOM.
export const MIN_PITCH = 36, MAX_PITCH = 96, MAX_GROUPS = 1000, MAX_CHORD = 12;
const copy = value => JSON.parse(JSON.stringify(value));
const inRange = pitch => Number.isInteger(pitch) && pitch >= MIN_PITCH && pitch <= MAX_PITCH;
export const hasSourceTime = event => Number.isFinite(event.start) && Number.isFinite(event.end) && event.start >= 0 && event.end > event.start;
export function normalizeEvents(input) {
  if (!Array.isArray(input) || input.length > MAX_GROUPS) throw new Error(`音組資料必須是陣列，且最多 ${MAX_GROUPS} 組。`);
  return input.map((event, index) => {
    if (!event || typeof event !== 'object' || !Array.isArray(event.pitches) || !event.pitches.length || event.pitches.length > MAX_CHORD || !event.pitches.every(inRange)) throw new Error(`第 ${index+1} 組音高無效：請使用 C2–C7，每組最多 ${MAX_CHORD} 個音。`);
    if (new Set(event.pitches).size !== event.pitches.length) throw new Error(`第 ${index+1} 組有重複音高。`);
    const noTime = event.start == null && event.end == null;
    if (!noTime && (!hasSourceTime(event) || event.end > 86400)) throw new Error(`第 ${index+1} 組原音時間無效。`);
    return {id:index+1,pitches:event.pitches.slice().sort((a,b)=>a-b),start:noTime?null:event.start,end:noTime?null:event.end,
      confidence:Number.isFinite(event.confidence)?Math.max(0,Math.min(1,event.confidence)):null,
      cents:Number.isFinite(event.cents)?Math.max(-1200,Math.min(1200,event.cents)):null,
      edited:event.edited===true,manual:event.manual===true||noTime};
  });
}
export function parseProject(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  if (!data || typeof data !== 'object' || data.project !== 'P142' || ![1,2].includes(data.schemaVersion)) throw new Error('請選擇 P142 匯出的音符資料 JSON（版本 1 或 2）。');
  const events = normalizeEvents(data.events);
  const metadata = {source:typeof data.source==='string'?data.source.slice(0,300):'載入的音高譜',origin:'imported',mode:['melody','poly','manual'].includes(data.mode)?data.mode:'manual'};
  if(typeof data.algorithm==='string')metadata.algorithm=data.algorithm.slice(0,100);
  if(data.range && Number.isFinite(data.range.start) && Number.isFinite(data.range.end) && data.range.start>=0 && data.range.end>data.range.start)metadata.range={start:data.range.start,end:data.range.end};
  return {events,metadata};
}
export function exportProject(events, metadata={}) {
  return {schemaVersion:2,project:'P142',webVersion:'V0.002',sds:'3.6',tuning:440,notation:'pitch-sequence-without-rhythm',playback:'equal-spacing',confidenceType:'heuristic-not-probability',
    source:typeof metadata.source==='string'?metadata.source:'手動編輯音高譜',mode:metadata.mode||'manual',algorithm:metadata.algorithm||null,range:metadata.range||null,
    events:copy(events)};
}
export class PitchEditor {
  constructor(events=[]) { this.load(events); }
  load(events) {
    const normalized=normalizeEvents(events); // validate before changing a live document
    this.state={events:normalized,selectedId:normalized[0]?.id??null,selectedMidi:normalized[0]?.pitches[0]??null};
    this.past=[];this.future=[];
  }
  get events(){return this.state.events;}
  get selectedIndex(){return this.events.findIndex(e=>e.id===this.state.selectedId);}
  get selectedEvent(){return this.events[this.selectedIndex]||null;}
  get selectedPitchIndex(){return this.selectedEvent?.pitches.indexOf(this.state.selectedMidi)??-1;}
  get selectedMidi(){return this.state.selectedMidi;}
  get canUndo(){return this.past.length>0;}
  get canRedo(){return this.future.length>0;}
  select(index,pitchIndex=0){const e=this.events[index];if(!e||!Number.isInteger(pitchIndex)||!inRange(e.pitches[pitchIndex]))return;this.state.selectedId=e.id;this.state.selectedMidi=e.pitches[pitchIndex];}
  commit(next) {
    if(JSON.stringify(next)===JSON.stringify(this.state))return false;
    this.past.push(copy(this.state));if(this.past.length>100)this.past.shift();this.future=[];this.state=next;return true;
  }
  setPitch(pitch) {
    if(!inRange(pitch))throw new Error('音高範圍為 C2–C7。');
    const index=this.selectedIndex;if(index<0)throw new Error('請先點選五線譜上的音符。');
    const e=this.events[index],old=this.selectedMidi;
    if(pitch===old)return false;
    if(e.pitches.includes(pitch))throw new Error('這一組已經有這個音高，請選擇其他音。');
    const next=copy(this.state),target=next.events[index];
    target.pitches=target.pitches.map(p=>p===old?pitch:p).sort((a,b)=>a-b);target.edited=true;target.cents=0;
    next.selectedMidi=pitch;return this.commit(next);
  }
  transpose(semitones){return this.setPitch(this.selectedMidi+semitones);}
  insert(side='after',pitch=this.selectedMidi??60) {
    if(this.events.length>=MAX_GROUPS)throw new Error(`最多可編輯 ${MAX_GROUPS} 組音。`);
    if(!inRange(pitch))throw new Error('音高範圍為 C2–C7。');
    const next=copy(this.state),index=this.selectedIndex<0?next.events.length:this.selectedIndex+(side==='before'?0:1);
    const id=Math.max(0,...next.events.map(e=>e.id))+1;
    next.events.splice(index,0,{id,pitches:[pitch],start:null,end:null,confidence:null,cents:null,edited:true,manual:true});
    next.selectedId=id;next.selectedMidi=pitch;return this.commit(next);
  }
  addTone(pitch) {
    if(!inRange(pitch))throw new Error('音高範圍為 C2–C7。');
    const index=this.selectedIndex;if(index<0)throw new Error('請先選取要加入和弦音的音組。');
    const e=this.events[index];
    if(e.pitches.includes(pitch))throw new Error('這一組已經有這個音高。');
    if(e.pitches.length>=MAX_CHORD)throw new Error(`同一組最多 ${MAX_CHORD} 個音。`);
    const next=copy(this.state);next.events[index].pitches.push(pitch);next.events[index].pitches.sort((a,b)=>a-b);next.events[index].edited=true;next.selectedMidi=pitch;
    return this.commit(next);
  }
  removeTone() {
    const index=this.selectedIndex;if(index<0)return false;
    const next=copy(this.state),event=next.events[index],pitchIndex=this.selectedPitchIndex;
    event.pitches.splice(pitchIndex,1);event.edited=true;
    if(event.pitches.length){next.selectedMidi=event.pitches[Math.min(pitchIndex,event.pitches.length-1)];}
    else {next.events.splice(index,1);const neighbor=next.events[Math.min(index,next.events.length-1)];next.selectedId=neighbor?.id??null;next.selectedMidi=neighbor?.pitches[0]??null;}
    return this.commit(next);
  }
  undo(){if(!this.canUndo)return false;this.future.push(copy(this.state));this.state=this.past.pop();return true;}
  redo(){if(!this.canRedo)return false;this.past.push(copy(this.state));this.state=this.future.pop();return true;}
  suggestedTone(){const e=this.selectedEvent;if(!e)return 64;const preferred=[this.selectedMidi+4,this.selectedMidi+7,...Array.from({length:61},(_,i)=>i+36)];return preferred.find(p=>inRange(p)&&!e.pitches.includes(p))??null;}
}
