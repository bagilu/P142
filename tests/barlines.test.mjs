import test from 'node:test';
import assert from 'node:assert/strict';
import {PitchEditor,parseProject,exportProject} from '../editor-state.js';
import {layoutScore,renderScore} from '../notation.js';
import {playbackTiming} from '../rhythm.js';
const note=(midi=60)=>({pitches:[midi],start:1,end:1.5,confidence:.5,beats:null});
const sequence=n=>Array.from({length:n},(_,i)=>note(60+i%8));
test('manual barline types can be added, modified and removed without assigning beats or changing audio',()=>{
 const e=new PitchEditor([note()]);const before=playbackTiming(e.events[0],120);
 for(const type of ['single','double','final',null]){
  e.setBarline(type);assert.equal(e.events[0].barlineAfter,type);assert.equal(e.events[0].beats,null);assert.equal(e.events[0].start,1);assert.equal(e.events[0].confidence,.5);assert.equal(e.events[0].edited,false);assert.deepEqual(playbackTiming(e.events[0],120),before);
 }
});
test('moving a line follows the selected destination and supports exact undo and redo',()=>{
 const e=new PitchEditor(sequence(3));e.select(1);e.setBarline('double');e.moveBarline(-1);
 assert.deepEqual(e.events.map(v=>v.barlineAfter),['double',null,null]);assert.equal(e.selectedIndex,0);
 e.undo();assert.deepEqual(e.events.map(v=>v.barlineAfter),[null,'double',null]);assert.equal(e.selectedIndex,1);
 e.redo();e.moveBarline(1);assert.equal(e.events[1].barlineAfter,'double');assert.equal(e.selectedIndex,1);
});
test('invalid moves and occupied destinations never overwrite lines or add history',()=>{
 const e=new PitchEditor(sequence(3));e.setBarline('single');const before=JSON.stringify(e.state),past=e.past.length;
 assert.throws(()=>e.moveBarline(-1));assert.throws(()=>e.moveBarline(0));assert.equal(JSON.stringify(e.state),before);assert.equal(e.past.length,past);
 e.select(1);e.setBarline('final');const saved=JSON.stringify(e.state);assert.throws(()=>e.moveBarline(-1));assert.equal(JSON.stringify(e.state),saved);
 e.select(2);e.setBarline('single');assert.throws(()=>e.moveBarline(1));
});
test('chord edits and manual beat changes preserve the group boundary',()=>{
 const e=new PitchEditor([note()]);e.setBarline('final');e.addTone(64);e.setBeats(2);e.transpose(1);e.removeTone();assert.equal(e.events[0].barlineAfter,'final');assert.equal(e.events[0].beats,2);assert.deepEqual(e.events[0].pitches,[60]);
});
test('insertions retain the line after its original group and never create another boundary',()=>{
 const e=new PitchEditor([note()]);e.setBarline('single');const original=e.events[0].id;e.insert('before',62);assert.equal(e.events[0].barlineAfter,null);assert.equal(e.events[1].barlineAfter,'single');e.select(1);e.insert('after',64);
 assert.equal(e.events.find(v=>v.id===original).barlineAfter,'single');assert.deepEqual(e.events.map(v=>v.barlineAfter),[null,'single',null]);
});
test('deleting the last tone removes its attached line and undo restores both',()=>{
 const e=new PitchEditor([note(),note(64)]);e.setBarline('double');e.removeTone();assert.equal(e.events.length,1);assert.equal(e.events[0].barlineAfter,null);e.undo();assert.equal(e.events[0].barlineAfter,'double');assert.deepEqual(e.events[0].pitches,[60]);
});
test('schema 4 roundtrip preserves all manual line types, chords, beats, tempo and source time',()=>{
 const e=new PitchEditor(sequence(4));for(const [i,type]of ['single','double','final'].entries()){e.select(i);e.setBarline(type);}e.addTone(72);e.setBeats(1.5);e.setTempo(95);
 const json=exportProject(e.events,{source:'bell.mp3'},e.tempo),p=parseProject(JSON.stringify(json));assert.equal(json.schemaVersion,4);assert.equal(p.tempo,95);assert.deepEqual(p.events.map(v=>v.barlineAfter),['single','double','final',null]);assert.equal(p.events[2].beats,1.5);assert.equal(p.events[0].start,1);assert.equal(p.metadata.source,'bell.mp3');assert.deepEqual(p.events[2].pitches,[62,72]);
});
test('older schemas never invent boundaries, and schema 3 retains its manual rhythm',()=>{
 for(const schemaVersion of [1,2,3]){
  const p=parseProject({project:'P142',schemaVersion,tempo:85,events:[{...note(),beats:2,barlineAfter:'single'}]});assert.equal(p.events[0].barlineAfter,null);assert.equal(p.events[0].beats,schemaVersion===3?2:null);assert.equal(p.tempo,schemaVersion===3?85:120);
 }
});
test('malformed line metadata and no-op removal cannot corrupt a document',()=>{
 const e=new PitchEditor([note()]);assert.equal(e.setBarline(null),false);assert.equal(e.canUndo,false);
 for(const bad of ['',true,1,'repeat',{},'__proto__']){
  assert.throws(()=>e.setBarline(bad));assert.throws(()=>e.load([{...note(),barlineAfter:bad}]));assert.throws(()=>parseProject({project:'P142',schemaVersion:4,events:[{...note(),barlineAfter:bad}]}));
 }
 assert.equal(e.events[0].barlineAfter,null);assert.equal(e.canUndo,false);
});
test('wrapping prefers manually marked measure boundaries when a measure fits a row',()=>{
 const events=Array.from({length:9},(_,i)=>({...note(),barlineAfter:i%3===2?'single':null}));
 assert.deepEqual(layoutScore(events,340,52).rows.map(r=>r.groups.length),[3,3,3]);
 assert.deepEqual(layoutScore(events.map(e=>({...e,barlineAfter:null})),340,52).rows.map(r=>r.groups.length),[5,4]);
});
test('an oversized measure wraps without inventing barlines or dropping notes',()=>{
 const events=Array.from({length:20},(_,i)=>({...note(),barlineAfter:i===19?'single':null}));const svg=renderScore(events,340);
 assert.ok(layoutScore(events,340).rows.length>1);assert.equal((svg.match(/data-barline=/g)||[]).length,1);assert.equal((svg.match(/data-event=/g)||[]).length,20);assert.ok(svg.includes('第 20 組後的一般小節線'));
});
test('manual lines reserve space after dense chords at every supported width and density',()=>{
 const events=sequence(20);events[5]={pitches:Array.from({length:12},(_,i)=>60+i),beats:.25,barlineAfter:'final'};for(let i=0;i<events.length;i++)if(i%3===2)events[i].barlineAfter='double';
 for(const width of [340,500,1000])for(const spacing of [40,52,74,104]){
  const rows=layoutScore(events,width,spacing).rows;
  for(const row of rows)for(const g of row.groups){
   assert.ok(g.cellLeft+g.cellWidth<=width-16+.01);
   if(g.event.barlineAfter){assert.ok(g.x+g.right<g.barX-4);assert.ok(g.barX+4<=g.cellLeft+g.cellWidth);}
  }
 }
});
test('SVG keeps all three line styles spanning both staves and resets accidental scope at a manual boundary',()=>{
 const events=['single','double','final'].map(type=>({...note(),barlineAfter:type}));const svg=renderScore(events,700);
 for(const type of ['single','double','final'])assert.ok(svg.includes(`data-barline="${type}"`));assert.equal((svg.match(/data-barline=/g)||[]).length,3);assert.ok(svg.includes('stroke-width="3.6"'));assert.ok(svg.includes('50V194'));
 const noBoundary=renderScore([note(61),note(60)],700),withBoundary=renderScore([{...note(61),barlineAfter:'single'},note(60)],700);
 assert.ok(noBoundary.includes('v20l7-3'));assert.ok(!withBoundary.includes('v20l7-3'));assert.ok(!withBoundary.includes('NaN'));
});

test('an explicit final line ends the staff only when it is at the end of the document',()=>{
 const last=[{...note(),barlineAfter:'final'}],internal=[...last,note(64)];
 const endpoint=layoutScore(last,700).rows[0].groups[0].barX+3.8;
 assert.ok(renderScore(last,700).includes(`x2="${endpoint}" y2="50"`));
 assert.ok(renderScore(internal,700).includes('x2="685" y2="50"'));
});
