import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutScore,renderScore,normalizeSpacing,DEFAULT_GROUP_SPACING} from '../notation.js';
const note=(midi=60,beats=null)=>({pitches:[midi],beats,start:1,end:1.5});
const notes=n=>Array.from({length:n},(_,i)=>note([60,64,67][i%3]));
test('compact settings reduce row count and SVG height for long melodies',()=>{
 const events=notes(40),layouts=[40,52,74,104].map(s=>layoutScore(events,1000,s));
 assert.deepEqual(layouts.map(l=>l.rows.length),[2,3,4,5]);
 assert.ok(layouts[1].height<layouts[2].height);assert.equal(DEFAULT_GROUP_SPACING,52);
 for(let i=1;i<layouts.length;i++)assert.ok(layouts[i-1].height<=layouts[i].height);
});
test('short rows retain their chosen gap rather than stretching to staff width',()=>{
 const a=layoutScore(notes(2),1000,52).rows[0].groups,b=layoutScore(notes(20),1000,52).rows[0].groups;
 assert.equal(a[1].x-a[0].x,52);assert.equal(a[0].x,b[0].x);assert.equal(a[1].x,b[1].x);
 assert.ok(a[1].x<200);
});
test('a dense chord reserves local space without widening neighboring single notes',()=>{
 const events=[note(),{pitches:Array.from({length:12},(_,i)=>60+i),beats:.25},note(72),note(76)];
 const g=layoutScore(events,1000,52).rows[0].groups;
 assert.ok(g[1].cellWidth>g[0].cellWidth);assert.equal(g[0].cellWidth,52);assert.equal(g[2].cellWidth,52);assert.equal(g[3].cellWidth,52);
});
test('all supported pitches, dense chords, accidentals and rhythms stay inside each cell',()=>{
 const events=Array.from({length:61},(_,i)=>note(36+i,[null,.25,.5,1,1.5,2,3,4][i%8]));
 events.splice(10,0,{pitches:Array.from({length:12},(_,i)=>60+i),beats:.25,manual:true});
 for(const width of [340,500,1000])for(const spacing of [40,52,74,104]){
  const layout=layoutScore(events,width,spacing);let count=0;
  for(const row of layout.rows){let previousRight=62;
   for(const g of row.groups){
    assert.ok(g.x+g.left>=g.cellLeft+3.9);assert.ok(g.x+g.right<=g.cellLeft+g.cellWidth-3.9);
    assert.ok(g.cellLeft>=previousRight);assert.ok(g.cellLeft+g.cellWidth<=width-16+.01);
    for(const h of g.heads)assert.ok(g.x+h.nx>=62);
    previousRight=g.cellLeft+g.cellWidth;assert.equal(g.index,count++);
   }
  }
  assert.equal(count,events.length);
 }
});
test('density leaves pitch, manual beats, tempo and source seconds unchanged in SVG',()=>{
 const events=[note(61,.25),note(60,3),{...note(67),pitches:[60,64,67]}],before=JSON.stringify(events);
 for(const spacing of [40,52,74,104]){
  const svg=renderScore(events,340,1,0,95,spacing);
  assert.equal((svg.match(/data-event=/g)||[]).length,5);assert.ok(svg.includes('速度 95 BPM'));assert.ok(svg.includes('dotted-half'));assert.ok(svg.includes('note-flag'));assert.ok(svg.includes('v20l7-3'));
  assert.ok(!svg.includes('NaN'));assert.equal(JSON.stringify(events),before);
 }
});
test('default and invalid density settings have a safe compact fallback, including empty scores',()=>{
 for(const value of [undefined,null,0,999,'40',NaN])assert.equal(normalizeSpacing(value),52);
 assert.equal(layoutScore([],340,40).rows.length,1);assert.ok(!renderScore([]).includes('NaN'));
 assert.deepEqual(layoutScore(notes(3),500),layoutScore(notes(3),500,52));
});

test('row numbers clear the previous row beat labels, including large chord labels',()=>{
 const events=notes(20);events[2]={pitches:Array.from({length:12},(_,i)=>60+i),beats:1.5};
 const rows=layoutScore(events,340,40).rows;
 for(let i=1;i<rows.length;i++){
  const previous=rows[i-1],lastLabelY=previous.top+260+(Math.max(...previous.groups.map(g=>g.labels.length))-1)*12;
  assert.ok(rows[i].top-40>=lastLabelY+24);
 }
});
