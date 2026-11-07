import test from 'node:test';
import assert from 'node:assert/strict';
import {PitchEditor,parseProject,exportProject,hasSourceTime,MAX_GROUPS,MAX_CHORD} from '../editor-state.js';
import {layoutChord,renderScore} from '../notation.js';
const note=(pitch,start=1)=>({pitches:[pitch],start,end:start+.5,confidence:.7,cents:3});
const sequence=editor=>editor.events.map(e=>e.pitches);
test('inserting before and after preserves sequence, selected note, and real source timing',()=>{
 const e=new PitchEditor([note(60),note(64,2)]);e.select(1);e.insert('before',62);
 assert.deepEqual(sequence(e),[[60],[62],[64]]);assert.equal(e.selectedIndex,1);assert.equal(e.events[1].start,null);assert.equal(e.events[1].end,null);assert.equal(e.events[2].start,2);
 e.insert('after',63);assert.deepEqual(sequence(e),[[60],[62],[63],[64]]);assert.equal(e.selectedMidi,63);
});
test('adding chord tones retains one time group and plays as a shared event',()=>{
 const e=new PitchEditor([note(60)]);e.addTone(67);e.addTone(64);
 assert.deepEqual(sequence(e),[[60,64,67]]);assert.equal(e.events[0].start,1);assert.equal(e.events[0].end,1.5);assert.equal(e.selectedMidi,64);assert.equal(e.selectedPitchIndex,1);
});
test('duplicate chord additions and colliding pitch changes do not delete notes',()=>{
 const e=new PitchEditor([note(60)]);e.addTone(64);const before=JSON.stringify(e.state),undo=e.past.length;
 assert.throws(()=>e.addTone(64));assert.throws(()=>e.setPitch(60));assert.equal(JSON.stringify(e.state),before);assert.equal(e.past.length,undo);
});
test('semitone and octave edits preserve other chord members and valid range',()=>{
 const e=new PitchEditor([note(60)]);e.addTone(67);e.transpose(1);assert.deepEqual(sequence(e),[[60,68]]);e.transpose(12);assert.deepEqual(sequence(e),[[60,80]]);e.transpose(-12);e.transpose(-1);assert.deepEqual(sequence(e),[[60,67]]);
 e.setPitch(96);assert.throws(()=>e.transpose(1));e.setPitch(36);assert.throws(()=>e.transpose(-1));
});
test('deleting one chord member preserves its partners and undo restores exact chord',()=>{
 const e=new PitchEditor([note(60)]);e.addTone(64);e.addTone(67);e.select(0,1);e.removeTone();assert.deepEqual(sequence(e),[[60,67]]);e.undo();assert.deepEqual(sequence(e),[[60,64,67]]);assert.equal(e.selectedMidi,64);
});
test('deleting all groups leaves an editable empty score; undo, redo, and reinsertion work',()=>{
 const e=new PitchEditor([note(60)]);e.removeTone();assert.deepEqual(e.events,[]);assert.equal(e.selectedIndex,-1);e.undo();assert.deepEqual(sequence(e),[[60]]);e.redo();assert.equal(e.events.length,0);e.insert();assert.deepEqual(sequence(e),[[60]]);assert.equal(e.events[0].manual,true);
});
test('undo and redo retain both pitch edits and selection; new edit discards stale redo',()=>{
 const e=new PitchEditor([note(60)]);e.transpose(1);e.insert('after',64);e.addTone(67);e.undo();assert.deepEqual(sequence(e),[[61],[64]]);e.undo();assert.deepEqual(sequence(e),[[61]]);e.redo();assert.deepEqual(sequence(e),[[61],[64]]);e.transpose(1);assert.equal(e.canRedo,false);assert.deepEqual(sequence(e),[[61],[65]]);
});
test('loading invalid data preserves current document and history',()=>{
 const e=new PitchEditor([note(60)]);e.transpose(1);const before=JSON.stringify(e.state);assert.throws(()=>e.load([{pitches:[999]}]));assert.equal(JSON.stringify(e.state),before);assert.equal(e.canUndo,true);
});
test('legacy V0.001 exports load with source times and chord pitches',()=>{
 const p=parseProject({project:'P142',schemaVersion:1,source:'door.mp3',events:[{pitches:[67,60,64],start:.3,end:.8,confidence:.9}]});assert.deepEqual(p.events[0].pitches,[60,64,67]);assert.equal(p.metadata.source,'door.mp3');assert.equal(p.events[0].start,.3);
});
test('edited JSON roundtrip preserves manual null times, sequence, and polyphony',()=>{
 const e=new PitchEditor([note(60)]);e.insert('after',62);e.addTone(65);const out=exportProject(e.events,{source:'tone.mp3',mode:'melody'});const back=parseProject(JSON.stringify(out));assert.deepEqual(back.events.map(v=>v.pitches),[[60],[62,65]]);assert.equal(back.events[1].start,null);assert.equal(back.events[1].end,null);assert.equal(back.events[1].manual,true);assert.equal(hasSourceTime(back.events[1]),false);assert.equal(hasSourceTime(back.events[0]),true);
});
test('empty saved scores can be reloaded and edited',()=>{const data=exportProject([]);const e=new PitchEditor(parseProject(data).events);e.insert();assert.deepEqual(sequence(e),[[60]]);});
test('imports reject wrong format, string pitches, invalid times, duplicates and excess size',()=>{
 for(const data of [{project:'other',schemaVersion:2,events:[]},{project:'P142',schemaVersion:999,events:[]},{project:'P142',schemaVersion:2,events:[{pitches:['60']}]},{project:'P142',schemaVersion:2,events:[{pitches:[60],start:1,end:.5}]},{project:'P142',schemaVersion:2,events:[{pitches:[60,60]}]},{project:'P142',schemaVersion:2,events:Array.from({length:MAX_GROUPS+1},()=>note(60))},{project:'P142',schemaVersion:2,events:[{pitches:Array.from({length:MAX_CHORD+1},(_,i)=>36+i)}]}])assert.throws(()=>parseProject(data));
});
test('source-less manual notes render without fake source seconds',()=>{
 const e=new PitchEditor();e.insert();e.addTone(64);e.addTone(67);const svg=renderScore(e.events,700,0,1);assert.ok(svg.includes('手動新增，未對應原音時間'));assert.equal((svg.match(/data-event=/g)||[]).length,3);assert.ok(!svg.includes('NaN'));assert.ok(!svg.includes('原音 0.00 秒'));
});
test('adjacent notes and same-line natural/sharp heads remain individually selectable',()=>{
 const pitches=[60,61,62,63,64,65,66,67,68,69,70,71],heads=layoutChord(pitches,150);
 for(let i=0;i<heads.length;i++)for(let j=i+1;j<heads.length;j++)if(Math.abs(heads[i].y-heads[j].y)<9)assert.notEqual(heads[i].nx,heads[j].nx);
 const svg=renderScore([{pitches,start:null,end:null,manual:true}],340);assert.equal((svg.match(/data-event=/g)||[]).length,12);assert.ok(svg.includes('C♯4'));
});
test('history is bounded and invalid operations never create history entries',()=>{const e=new PitchEditor([note(60)]);for(let i=0;i<110;i++)e.transpose(i%2?-1:1);assert.equal(e.past.length,100);const n=e.past.length;assert.throws(()=>e.addTone(999));assert.equal(e.past.length,n);});
