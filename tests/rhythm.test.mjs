import test from 'node:test';
import assert from 'node:assert/strict';
import {PitchEditor,parseProject,exportProject} from '../editor-state.js';
import {playbackTiming,noteValue,BEAT_VALUES} from '../rhythm.js';
import {renderScore} from '../notation.js';
import {analyzeSamples,frequency} from '../dsp.js';
const raw=(pitch=60)=>({pitches:[pitch],start:.3,end:1.73,confidence:.9,cents:2});
test('automatic analysis provides pitch without any inferred beat count',()=>{
 const sr=22050,a=new Float32Array(sr);for(let i=2000;i<18000;i++)a[i]=.5*Math.sin(2*Math.PI*frequency(72)*i/sr);
 const result=analyzeSamples(a,sr);assert.equal(result.events.length,1);assert.equal(result.events[0].beats,undefined);
 const e=new PitchEditor(result.events);assert.equal(e.events[0].beats,null);assert.deepEqual(e.events[0].pitches,[72]);assert.equal(e.events[0].start,result.events[0].start);
});
test('manual beats apply to the whole chord without changing pitches or source timing',()=>{
 const e=new PitchEditor([raw()]);e.addTone(64);e.addTone(67);e.setBeats(2);
 assert.deepEqual(e.events[0].pitches,[60,64,67]);assert.equal(e.events[0].beats,2);assert.equal(e.events[0].start,.3);assert.equal(e.events[0].end,1.73);
 e.setBeats(null);assert.equal(e.events[0].beats,null);
});
test('beat and tempo edits participate in undo and redo',()=>{
 const e=new PitchEditor([raw()]);e.setBeats(.5);e.setTempo(90);e.undo();assert.equal(e.tempo,120);assert.equal(e.events[0].beats,.5);e.undo();assert.equal(e.events[0].beats,null);e.redo();e.redo();assert.equal(e.tempo,90);assert.equal(e.events[0].beats,.5);
});
test('quarter-note beats convert to correct step lengths at multiple tempos',()=>{
 for(const beats of BEAT_VALUES)for(const tempo of [30,60,120,240]){
  const t=playbackTiming({beats},tempo);assert.equal(t.stepSeconds,beats*60/tempo);assert.ok(t.durationSeconds>0&&t.durationSeconds<t.stepSeconds);assert.equal(t.timed,true);
 }
});
test('unassigned groups preserve their old playback interval regardless of tempo',()=>{
 assert.deepEqual(playbackTiming({beats:null},30),{timed:false,stepSeconds:.65,durationSeconds:.52});assert.deepEqual(playbackTiming({},240),playbackTiming({},30));
 const groups=[{beats:null},{beats:2},{beats:.5}];assert.equal(groups.reduce((s,e)=>s+playbackTiming(e,120).stepSeconds,0),1.9);
});
test('legacy schema 1 and 2 remain unassigned and never acquire beats from seconds',()=>{
 for(const schemaVersion of [1,2]){
  const p=parseProject({project:'P142',schemaVersion,tempo:80,events:[{...raw(),beats:2}]});assert.equal(p.events[0].beats,null);assert.equal(p.tempo,120);
 }
});
test('schema 3 roundtrip preserves manual beats, untimed groups, tempo and chord',()=>{
 const e=new PitchEditor([raw(),raw(72)]);e.addTone(64);e.setBeats(1.5);e.setTempo(95);
 const saved=exportProject(e.events,{source:'bell.mp3'},e.tempo),loaded=parseProject(JSON.stringify(saved));
 assert.equal(saved.schemaVersion,3);assert.equal(loaded.tempo,95);assert.deepEqual(loaded.events.map(v=>v.beats),[1.5,null]);assert.deepEqual(loaded.events[0].pitches,[60,64]);assert.equal(loaded.events[0].end,1.73);
 const restored=new PitchEditor(loaded.events,loaded.tempo);assert.equal(restored.tempo,95);
});
test('new manual groups stay unassigned even next to a timed group',()=>{
 const e=new PitchEditor([raw()]);e.setBeats(4);e.insert();assert.equal(e.selectedEvent.beats,null);assert.equal(e.selectedEvent.start,null);e.addTone(64);assert.equal(e.selectedEvent.beats,null);
});
test('unsupported beats and invalid tempos are rejected without corrupting state',()=>{
 const e=new PitchEditor([raw()]);e.setBeats(1);const before=JSON.stringify(e.state);
 for(const beats of [0,-1,.3,8,'1',NaN,Infinity])assert.throws(()=>e.setBeats(beats));
 for(const tempo of [0,29,241,80.5,'120',NaN])assert.throws(()=>e.setTempo(tempo));
 assert.equal(JSON.stringify(e.state),before);assert.throws(()=>parseProject({project:'P142',schemaVersion:3,tempo:0,events:[raw()]}));assert.throws(()=>parseProject({project:'P142',schemaVersion:3,events:[{...raw(),beats:9}]}));
});
test('same beat value does not create an edit or undo step',()=>{const e=new PitchEditor([raw()]);assert.equal(e.setBeats(null),false);assert.equal(e.canUndo,false);});
test('notation distinguishes unspecified, quarter, half, whole, flagged and dotted values',()=>{
 const cases=[[null,'unassigned',0,0],[1,'quarter',1,0],[2,'half',1,0],[4,'whole',0,0],[.5,'eighth',1,1],[.25,'sixteenth',1,2],[1.5,'dotted-quarter',1,0],[3,'dotted-half',1,0]];
 for(const [beats,kind,stems,flags]of cases){
  const svg=renderScore([{...raw(),beats}],700,-1,-1,95);assert.ok(svg.includes(`data-note-value="${kind}"`));assert.equal((svg.match(/data-stem=/g)||[]).length,stems);assert.equal((svg.match(/class="note-flag"/g)||[]).length,flags);
  assert.equal(svg.includes('augmentation-dot'),beats===1.5||beats===3);if([2,3,4].includes(beats))assert.ok(svg.includes('notehead hollow'));
 }
 assert.equal(noteValue(null).stem,false);
});
test('a chord shares one stem per staff and one duration, rather than separate rhythmic events',()=>{
 const chord={...raw(),pitches:[60,64,67],beats:.5};const svg=renderScore([chord],700);assert.equal((svg.match(/data-stem=/g)||[]).length,1);assert.equal((svg.match(/class="note-flag"/g)||[]).length,1);assert.equal((svg.match(/data-event=/g)||[]).length,3);assert.ok(svg.includes('0.5 拍'));
 const split=renderScore([{...chord,pitches:[43,60]}],700);assert.equal((split.match(/data-stem=/g)||[]).length,2);
});
test('changing tempo never changes source seconds or derives a new beat value',()=>{
 const e=new PitchEditor([raw()]);e.setTempo(60);assert.equal(e.events[0].start,.3);assert.equal(e.events[0].end,1.73);assert.equal(e.events[0].beats,null);e.setBeats(1);e.setTempo(240);assert.equal(e.events[0].beats,1);assert.equal(e.events[0].end,1.73);
});
