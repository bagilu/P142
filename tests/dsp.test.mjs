import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeSamples,frequency} from '../dsp.js';
import {notePosition,noteName,renderScore} from '../notation.js';
function audio(notes,rate=22050,amp=.6){const length=Math.ceil((Math.max(...notes.map(n=>n.t+n.d))+.2)*rate),samples=new Float32Array(length);for(const n of notes)for(let i=0;i<n.d*rate;i++){const t=i/rate,e=Math.min(1,t/.01,(n.d-t)/.015);let val=0;for(const [h,a] of n.h||[[1,1]])val+=a*Math.sin(2*Math.PI*frequency(n.m)*h*t);samples[Math.floor(n.t*rate)+i]+=amp*e*val;}return samples;}
function seq(result){return result.events.map(e=>e.pitches);}
test('pure prompt tones retain pitch and octave, including repeated C5',()=>{const notes=[72,76,79,76,72,72].map((m,i)=>({m,t:.2+i*.55,d:.35}));const out=analyzeSamples(audio(notes),22050);assert.deepEqual(seq(out),notes.map(n=>[n.m]));for(let i=0;i<notes.length;i++)assert.ok(Math.abs(out.events[i].start-notes[i].t)<.05);});
test('strong second harmonic does not replace fundamental',()=>{const notes=[48,60,69,84].map((m,i)=>({m,t:.2+i*.8,d:.5,h:[[1,.3],[2,1],[3,.2],[4,.12]]}));assert.deepEqual(seq(analyzeSamples(audio(notes),22050)),notes.map(n=>[n.m]));});
test('sharp keys and 44.1 kHz resampling',()=>{const notes=[61,66,73,82].map((m,i)=>({m,t:.2+i*.6,d:.4}));assert.deepEqual(seq(analyzeSamples(audio(notes,44100),44100)),notes.map(n=>[n.m]));});
test('quiet recording uses relative gate',()=>{assert.deepEqual(seq(analyzeSamples(audio([{m:67,t:.2,d:.5}],22050,.001),22050)),[[67]]);});
test('silence produces no notes',()=>assert.equal(analyzeSamples(new Float32Array(22050),22050).events.length,0));
test('polyphonic clean C major triad',()=>{const notes=[60,64,67].map(m=>({m,t:.2,d:.65}));const out=analyzeSamples(audio(notes,22050,.2),22050,{mode:'poly'});assert.ok(out.events.some(e=>e.pitches.join(',')==='60,64,67'),JSON.stringify(out.events));});
test('short tones and time offset',()=>{const notes=[72,74,76].map((m,i)=>({m,t:.2+i*.22,d:.13}));const out=analyzeSamples(audio(notes),22050,{minDuration:.06,offset:10});assert.deepEqual(seq(out),[[72],[74],[76]]);assert.ok(out.events[0].start>=10);});
test('notation positions are musically correct',()=>{assert.equal(notePosition(60).y,110);assert.equal(notePosition(64).y,98);assert.equal(notePosition(43).y,194);assert.equal(notePosition(57).y,146);assert.equal(notePosition(61).sharp,true);assert.equal(noteName(60),'C4');assert.equal(noteName(69),'A4');});
test('score renders every event with ledger lines and no time signature',()=>{const events=[36,60,61,96].map((m,i)=>({pitches:[m],start:i,end:i+.5,confidence:.9,cents:0}));const svg=renderScore(events,780);assert.equal((svg.match(/data-event=/g)||[]).length,4);assert.ok(svg.includes('C♯4'));assert.ok(svg.includes('xmlns='));});
test('all 61 chromatic pitches C2–C7, clean synthetic single tones',()=>{for(let m=36;m<=96;m++){const out=analyzeSamples(audio([{m,t:.1,d:.55}]),22050);assert.deepEqual(seq(out),[[m]],`MIDI ${m}`);}});
test('a natural following a sharp carries an explicit natural sign',()=>{const e=[61,60].map((m,i)=>({pitches:[m],start:i,end:i+.3,confidence:.9,cents:0}));const svg=renderScore(e,500);assert.ok(svg.includes('C♯4'));assert.ok(svg.includes('v20l7-3'));});
