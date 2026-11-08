import { frequency } from './dsp.js?v=0.004';
import { noteName, renderScore, normalizeSpacing } from './notation.js?v=0.004';
import { PitchEditor, parseProject, exportProject, hasSourceTime, MIN_PITCH, MAX_PITCH, MAX_CHORD } from './editor-state.js?v=0.004';
import { playbackTiming, beatLabel } from './rhythm.js?v=0.004';
const $ = id => document.getElementById(id);
const pitchEditor = new PitchEditor();
let groupSpacing=normalizeSpacing(null);
try{groupSpacing=normalizeSpacing(Number(localStorage.getItem('P142.groupSpacing')));}catch{}
$('group-spacing').value=groupSpacing;
let scoreOpened = false, playbackRun = 0;
let audioContext, buffer, objectUrl, worker, events = [], selected = -1, selectedPitch = 0, run = 0, loadId = 0, busy = false, sourceName = '', analysisMeta = null;
let oscillators = [], timers = [], sourceNode, fileBusy = false, exportUrls = [];
const status = (text, error = false) => { $('status').textContent = text; $('status').classList.toggle('error', error); };
async function context(activate = true) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error('此瀏覽器未提供 Web Audio，請使用新版 Chrome、Edge、Firefox 或 Safari。');
  audioContext ||= new AudioContextClass();
  if (activate && audioContext.state === 'suspended') await audioContext.resume();
  return audioContext;
}
function stopPlayback() {
  playbackRun++;
  timers.forEach(clearTimeout); timers = [];
  oscillators.forEach(o => { try { o.stop(); } catch {} }); oscillators = [];
  if (sourceNode) { try { sourceNode.stop(); } catch {} sourceNode = null; }
  $('original').pause();
  document.querySelectorAll('.playing,.piano-key.active').forEach(el => el.classList.remove('playing', 'active'));
  $('stop').disabled = true; $('play').disabled = !events.length || busy;
}
function sound(midi, when, duration = .65, scale = 1) {
  const ctx = audioContext, amp = ctx.createGain();
  amp.gain.setValueAtTime(0, when); amp.gain.linearRampToValueAtTime(.13*scale, when + .012);
  amp.gain.exponentialRampToValueAtTime(.045*scale, when + Math.min(.2, duration*.5));
  amp.gain.exponentialRampToValueAtTime(.0001, when + duration);
  amp.connect(ctx.destination);
  for (const [h, volume] of [[1,1],[2,.27],[3,.09]]) {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = frequency(midi) * h; gain.gain.value = volume;
    osc.connect(gain).connect(amp); osc.start(when); osc.stop(when + duration + .03);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); oscillators=oscillators.filter(item=>item!==osc); }; oscillators.push(osc);
  }
  timers.push(setTimeout(() => amp.disconnect(), Math.max(0, when-ctx.currentTime+duration+.1)*1000));
}
function flash(midi, index = -1, duration = 500) {
  const key = document.querySelector(`[data-midi="${midi}"]`); key?.classList.add('active');
  if (index >= 0) document.querySelectorAll(`[data-event="${index}"]`).forEach(el => el.classList.add('playing'));
  timers.push(setTimeout(() => { key?.classList.remove('active'); if(index>=0) document.querySelectorAll(`[data-event="${index}"]`).forEach(el=>el.classList.remove('playing')); }, duration));
}
function resetResults() {
  pitchEditor.load([]);scoreOpened=false;$('document-status').textContent='可先分析音檔，也可直接編輯。';
  events = []; analysisMeta = null; selected = -1; exportUrls.forEach(URL.revokeObjectURL); exportUrls = []; $('results').hidden = true; $('empty').hidden = false; $('editor').hidden = true; $('count').textContent = '等待分析';
  $('score').replaceChildren();
}
function setBusy(value) {
  busy = value; $('analyze').disabled = value || !buffer || fileBusy; $('file').disabled = value; $('demo').disabled = value || fileBusy;
  for (const id of ['start','end','mode','min-duration','gate']) $(id).disabled = value;
  $('new-score').disabled=value;$('import-json').disabled=value;
  $('cancel').hidden = !value; $('progress').hidden = !value;
  $('analyze').querySelector('span').textContent = value ? '正在分析…' : '開始分析';
}
function drawWave() {
  if (!buffer) return;
  const canvas = $('waveform'), dpr = window.devicePixelRatio || 1, width = canvas.clientWidth || 260;
  canvas.width = width*dpr; canvas.height=74*dpr;
  const ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr); ctx.clearRect(0,0,width,74);
  const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
  const bins=Array.from({length:Math.ceil(width)},(_,i)=>{
    let max=0; const begin=Math.floor(i*buffer.length/width), end=Math.floor((i+1)*buffer.length/width), step=Math.max(1,Math.floor((end-begin)/100));
    for(let k=begin;k<end;k+=step) for(const ch of channels) max=Math.max(max,Math.abs(ch[k]||0));
    return max;
  });
  const peak=Math.max(...bins, .001), start=Number($('start').value), end=Number($('end').value);
  bins.forEach((v,i)=>{ctx.strokeStyle=i/width*buffer.duration>=start&&i/width*buffer.duration<=end?'#6d8b58':'#c8d1bf';ctx.beginPath();ctx.moveTo(i,37-v/peak*29);ctx.lineTo(i,37+v/peak*29);ctx.stroke();});
}
function installBuffer(next, name, blob) {
  const keep=scoreOpened&&(analysisMeta?.source===name||analysisMeta?.origin==='manual');
  if(!keep&&!mayReplaceDocument()){status('已保留目前的編輯結果。');return;}
  stopPlayback(); if(!keep)resetResults(); buffer=next; sourceName=name;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl=URL.createObjectURL(blob); $('original').src=objectUrl;
  $('file-title').textContent=name; $('file-description').textContent='已載入 · 可重新選擇音檔';
  $('source-area').hidden=false; $('start').value='0'; $('end').value=Math.min(90,next.duration).toFixed(2);
  $('start').max=next.duration; $('end').max=next.duration;
  $('duration').textContent=`${next.duration.toFixed(2)} 秒 · ${next.numberOfChannels} 聲道`;
  $('analyze').disabled=false; drawWave();if(keep)render();
  status(next.duration>90?'音檔已載入，預設分析前 90 秒。可調整起訖秒數。':'音檔已載入。按下「開始分析」產生音高五線譜。');
}
async function loadFile(file) {
  if (!file || busy || fileBusy) return;
  if (file.size>50*1024*1024) { status('請選擇 50 MB 以下的音檔，或先裁切要辨識的片段。',true); return; }
  fileBusy=true; const token=++loadId; $('analyze').disabled=true; $('demo').disabled=true; $('file').disabled=true;
  stopPlayback(); status('正在讀取音檔…');
  try {
    const ctx=await context(false), decoded=await ctx.decodeAudioData(await file.arrayBuffer());
    if(token!==loadId)return;
    if(decoded.duration<.08)throw new Error('音檔太短，請提供至少 0.08 秒的聲音。');
    if(decoded.duration>600)throw new Error('音檔超過 10 分鐘，請先裁切提示音片段再匯入。');
    installBuffer(decoded,file.name,file);
  } catch(error) { status(`無法讀取：${error.message || '請確認是有效的 MP3 或 WAV 音檔。'}`,true); }
  finally { if(token===loadId) {fileBusy=false; $('file').disabled=false; $('demo').disabled=false; $('analyze').disabled=!buffer;} }
}
function wavBlob(audio) {
  const samples=audio.getChannelData(0), bytes=new ArrayBuffer(44+samples.length*2), v=new DataView(bytes);
  const text=(pos,s)=>[...s].forEach((c,i)=>v.setUint8(pos+i,c.charCodeAt(0)));
  text(0,'RIFF');v.setUint32(4,36+samples.length*2,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,audio.sampleRate,true);v.setUint32(28,audio.sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,samples[i]))*32767,true);
  return new Blob([bytes],{type:'audio/wav'});
}
$('demo').onclick=async()=>{
  if(busy||fileBusy)return;
  try {
    const ctx=await context(false), rate=22050, demo=ctx.createBuffer(1,rate*4.5,rate), a=demo.getChannelData(0);
    const notes=[{m:72,t:.3,d:.38},{m:76,t:.85,d:.38},{m:79,t:1.4,d:.55},{m:76,t:2.15,d:.38},{m:72,t:2.7,d:.7},{m:72,t:3.65,d:.45}];
    for(const {m,t,d} of notes)for(let i=0;i<d*rate;i++){
      const time=i/rate, envelope=Math.min(1,time/.012)*Math.min(1,(d-time)/.035)*Math.exp(-time*2.3), phase=2*Math.PI*frequency(m)*time;
      a[Math.floor(t*rate)+i]=.55*envelope*(Math.sin(phase)+.22*Math.sin(phase*2)+.06*Math.sin(phase*3));
    }
    installBuffer(demo,'合成提示音範例（非捷運原音）',wavBlob(demo));
  }catch(e){status(e.message,true);}
};
$('file').onchange=()=>loadFile($('file').files[0]);
const drop=$('dropzone');
for(const name of ['dragenter','dragover'])drop.addEventListener(name,e=>{e.preventDefault();if(!busy)drop.classList.add('drag');});
for(const name of ['dragleave','drop'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.remove('drag');});
drop.addEventListener('drop',e=>loadFile(e.dataTransfer.files[0]));
for(const id of ['start','end'])$(id).addEventListener('input',drawWave);
$('analyze').onclick=async()=>{
  if(!buffer||busy)return;
  const start=Number($('start').value), end=Number($('end').value);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>buffer.duration+.011||end-start>90.011){status('請設定有效範圍：起點小於終點、位於音檔內，且片段不超過 90 秒。',true);return;}
  if(!mayReplaceDocument()){status('已保留目前的編輯結果。');return;}
  stopPlayback();resetResults();setBusy(true);$('progress').value=0;status('正在分析音高，請稍候…');
  const token=++run, rate=buffer.sampleRate, first=Math.floor(start*rate), last=Math.min(buffer.length,Math.floor(end*rate)), samples=new Float32Array(last-first);
  // Select the channel with the greatest energy, avoiding anti-phase stereo cancellation.
  let bestChannel=0,bestEnergy=-1;
  for(let c=0;c<buffer.numberOfChannels;c++){const ch=buffer.getChannelData(c);let e=0;for(let i=first;i<last;i+=16)e+=ch[i]*ch[i];if(e>bestEnergy){bestEnergy=e;bestChannel=c;}}
  samples.set(buffer.getChannelData(bestChannel).subarray(first,last));
  try {
    worker=new Worker(new URL('./analysis-worker.js?v=0.004',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{
      if(token!==run)return;
      if(data.type==='progress'){$('progress').value=data.progress;status(`正在分析音高… ${data.progress}%`);}
      if(data.type==='error')finishError(data.message);
      if(data.type==='complete'){
        worker.terminate();worker=null;setBusy(false);
        try{pitchEditor.load(data.result.events);}catch(e){finishError(e.message);return;}
        scoreOpened=true;syncEditor();analysisMeta={...data.result,events:undefined,source:sourceName,range:{start,end},sampleRate:rate,channel:bestChannel+1,origin:'analysis'};
        if(!events.length){render();status('未找到穩定音高。可以新增音組，或調整分析設定重試。',true);return;}
        render();status(`完成：${events.length} 組音高。請播放原音，核對八度與音符。${$('mode').value==='poly'?'多音模式為實驗功能。':''}`);
      }
    };
    worker.onerror=()=>{if(token===run)finishError('分析模組未能啟動。請以 HTTPS 網址或本機伺服器開啟，並確認所有檔案已完整上傳。');};
    worker.postMessage({samples,sampleRate:rate,options:{mode:$('mode').value,minDuration:Number($('min-duration').value),gate:Number($('gate').value),offset:start}},[samples.buffer]);
  }catch(e){finishError(e.message);}
};
function finishError(message){worker?.terminate();worker=null;setBusy(false);status(`分析未完成：${message}`,true);}
$('cancel').onclick=()=>{++run;worker?.terminate();worker=null;setBusy(false);status('分析已取消，可調整設定後重試。');};
function syncEditor(){events=pitchEditor.events;selected=pitchEditor.selectedIndex;selectedPitch=pitchEditor.selectedPitchIndex;}
function mayReplaceDocument(){return !pitchEditor.canUndo||window.confirm('目前有編輯結果。請先下載「音符資料」保存。確定要取代目前的音高譜嗎？');}
function canPlaySource(event){return !!buffer&&hasSourceTime(event)&&analysisMeta?.source===sourceName&&event.end<=buffer.duration+.01;}
function sourceDescription(event){return hasSourceTime(event)?`原音 ${event.start.toFixed(2)}–${event.end.toFixed(2)} 秒`:'手動新增 · 未對應原音時間';}
function render() {
  syncEditor();
  $('empty').hidden=scoreOpened;$('results').hidden=!scoreOpened;$('count').textContent=scoreOpened?`${events.length} 組音高`:'等待分析';
  $('play').disabled=!events.length||busy;$('tempo').value=pitchEditor.tempo;$('undo').disabled=!pitchEditor.canUndo;$('redo').disabled=!pitchEditor.canRedo;
  $('insert-before').disabled=selected<0;$('insert-after').textContent=events.length?'＋ 在後新增音組':'＋ 新增第一組音';
  $('document-status').textContent=scoreOpened?`${events.length} 組音高 · 可下載音符資料保存`:'可先分析音檔，也可直接編輯。';
  const width=Math.max(340,Math.floor($('score').parentElement.clientWidth)-12),scroll=$('score').scrollTop;
  if(events.length){
    $('score').innerHTML=renderScore(events,width,selected,selectedPitch,pitchEditor.tempo,groupSpacing);
    const all=events.flatMap(e=>e.pitches);$('range-summary').textContent=`${noteName(Math.min(...all))} — ${noteName(Math.max(...all))}`;
  }else{
    $('score').innerHTML='<div class="empty-score-editor"><strong>這張譜目前沒有音符。</strong>按「新增第一組音」，從中央 C 開始編輯。</div>';$('range-summary').textContent='';
  }
  $('score').scrollTop=scroll;
  $('editor').hidden=selected<0;
  if(selected>=0){
    const event=events[selected],midi=pitchEditor.selectedMidi;
    $('selected-title').textContent=`第 ${selected+1} 組 · 所選 ${noteName(midi)} · ${event.pitches.length} 個音`;
    $('selected-time').textContent=sourceDescription(event)+(event.edited?' · 已編輯':'');$('pitch-edit').value=midi;$('beats').value=event.beats??'';
    for(const option of $('pitch-edit').options)option.disabled=Number(option.value)!==midi&&event.pitches.includes(Number(option.value));
    for(const [id,shift]of [['down-semitone',-1],['up-semitone',1],['down-octave',-12],['up-octave',12]])$(id).disabled=midi+shift<MIN_PITCH||midi+shift>MAX_PITCH||event.pitches.includes(midi+shift);
    for(const option of $('chord-pitch').options)option.disabled=event.pitches.includes(Number(option.value));
    const suggestion=pitchEditor.suggestedTone();if(suggestion!==null)$('chord-pitch').value=suggestion;
    $('add-chord').disabled=event.pitches.length>=MAX_CHORD||suggestion===null;
    $('chord-hint').textContent=`同組：${event.pitches.map(noteName).join('、')}`;
  }
  const table=document.createElement('table');table.innerHTML='<thead><tr><th>順序</th><th>音高</th><th>手動拍數</th><th>原音時間／來源</th><th>檢視</th></tr></thead>';
  const tbody=document.createElement('tbody');events.forEach((event,index)=>{
    const tr=document.createElement('tr');
    for(const text of [index+1,event.pitches.map(noteName).join(' · '),beatLabel(event.beats),sourceDescription(event)]){const td=document.createElement('td');td.textContent=text;tr.append(td);}
    const td=document.createElement('td'),button=document.createElement('button');button.textContent='原音片段';button.disabled=!canPlaySource(event);button.title=canPlaySource(event)?'播放原音對應片段':'手動音符沒有原音時間；原有音符需先載入同名音檔';button.onclick=()=>playSource(event);td.append(button);tr.append(td);tbody.append(tr);
  });table.append(tbody);$('note-table').replaceChildren(table);updateDownloads();
}
async function auditionSelection(){
  const event=pitchEditor.selectedEvent,token=playbackRun;if(!event)return;
  try{await context();if(token!==playbackRun)return;const when=audioContext.currentTime+.02,timing=playbackTiming(event,pitchEditor.tempo);event.pitches.forEach(midi=>{sound(midi,when,timing.durationSeconds,1/Math.sqrt(event.pitches.length));flash(midi,selected,timing.durationSeconds*1000);});}catch(e){status(e.message,true);}
}
async function selectNote(index,pitch,focus=false){
  if(!events[index])return;stopPlayback();pitchEditor.select(index,pitch);render();
  if(focus)$('score').querySelector(`[data-event="${selected}"][data-pitch="${selectedPitch}"]`)?.focus({preventScroll:true});
  const midi=pitchEditor.selectedMidi,token=playbackRun;
  try{await context();if(token!==playbackRun)return;const timing=playbackTiming(pitchEditor.selectedEvent,pitchEditor.tempo);sound(midi,audioContext.currentTime+.015,timing.durationSeconds);flash(midi,-1,timing.durationSeconds*1000);}catch(e){status(e.message,true);}
  const key=document.querySelector(`[data-midi="${midi}"]`);if(key){const scroll=$('keyboard').parentElement;scroll.scrollLeft=Math.max(0,key.offsetLeft-scroll.clientWidth/2);}
}
function applyEdit(action,message,focus=false){
  stopPlayback();
  try{const changed=action();render();if(changed)status(message);if(focus)$('score').querySelector(`[data-event="${selected}"][data-pitch="${selectedPitch}"]`)?.focus({preventScroll:true});if(changed)auditionSelection();}
  catch(e){status(e.message,true);render();}
}
$('score').addEventListener('click',event=>{const note=event.target.closest('[data-event]'),group=event.target.closest('[data-group]');if(note)selectNote(Number(note.dataset.event),Number(note.dataset.pitch));else if(group)selectNote(Number(group.dataset.group),0);});
$('score').addEventListener('keydown',event=>{
  const note=event.target.closest('[data-event]'),group=event.target.closest('[data-group]');if(!note&&!group)return;
  const index=Number(note?.dataset.event??group.dataset.group),pitch=Number(note?.dataset.pitch??0);
  if(['Enter',' '].includes(event.key)){event.preventDefault();selectNote(index,pitch,true);}
  if(['ArrowUp','ArrowDown','Delete','Backspace'].includes(event.key)){event.preventDefault();pitchEditor.select(index,pitch);applyEdit(()=>['Delete','Backspace'].includes(event.key)?pitchEditor.removeTone():pitchEditor.transpose((event.key==='ArrowUp'?1:-1)*(event.shiftKey?12:1)),'音符已更新，可復原此操作。',true);}
});
$('group-spacing').onchange=()=>{
  stopPlayback();groupSpacing=normalizeSpacing(Number($('group-spacing').value));
  try{localStorage.setItem('P142.groupSpacing',String(groupSpacing));}catch{}
  render();status('音組間距已更新；下載五線譜也會採用此間距。');
};
$('beats').onchange=()=>applyEdit(()=>pitchEditor.setBeats($('beats').value===''?null:Number($('beats').value)),'此音組的手動拍數已更新。');
$('tempo').onchange=()=>applyEdit(()=>pitchEditor.setTempo(Number($('tempo').value)),'播放速度已更新；未設定拍數的音組維持固定間隔。');
$('pitch-edit').onchange=()=>applyEdit(()=>pitchEditor.setPitch(Number($('pitch-edit').value)),'音高已調整。');
for(const [id,shift]of [['down-semitone',-1],['up-semitone',1],['down-octave',-12],['up-octave',12]])$(id).onclick=()=>applyEdit(()=>pitchEditor.transpose(shift),'音高已調整。');
$('insert-before').onclick=()=>applyEdit(()=>pitchEditor.insert('before'),'已在前方新增一組音，可調整音高。');
$('insert-after').onclick=()=>applyEdit(()=>pitchEditor.insert('after'),'已新增一組音，可調整音高或加入和弦音。');
$('add-chord').onclick=()=>applyEdit(()=>pitchEditor.addTone(Number($('chord-pitch').value)),'已加入同時發聲的音。');
$('remove-note').onclick=()=>applyEdit(()=>pitchEditor.removeTone(),'已刪除所選音符，可按「復原」還原。');
$('undo').onclick=()=>applyEdit(()=>pitchEditor.undo(),'已復原上一個編輯動作。');
$('redo').onclick=()=>applyEdit(()=>pitchEditor.redo(),'已重做編輯動作。');
$('audition').onclick=()=>{stopPlayback();auditionSelection();};
$('new-score').onclick=()=>{if(busy||!mayReplaceDocument())return;stopPlayback();pitchEditor.load([]);scoreOpened=true;analysisMeta={source:sourceName||'手動編輯音高譜',origin:'manual',mode:'manual'};render();status('空白譜已建立。按「新增第一組音」開始。');};
$('import-json').onchange=async()=>{
  const file=$('import-json').files[0];if(!file)return;
  try{
    if(file.size>2*1024*1024)throw new Error('音符資料檔最多 2 MB。');
    const project=parseProject(await file.text());
    if(busy||!mayReplaceDocument())return;
    stopPlayback();pitchEditor.load(project.events,project.tempo);scoreOpened=true;analysisMeta=project.metadata;render();
    status(`已載入 ${events.length} 組音高。${buffer&&analysisMeta.source===sourceName?'可對照目前原音。':'可選取同名原音檔以恢復原音對照；音檔本身不包含在 JSON 內。'}`);
  }catch(e){status(`無法載入音符資料：${e.message}`,true);}finally{$('import-json').value='';}
};
document.addEventListener('keydown',event=>{
  if(!scoreOpened||busy||!(event.ctrlKey||event.metaKey)||event.altKey||event.target.closest('input,select,textarea,[contenteditable="true"]'))return;
  if(event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?$('redo').click():$('undo').click();}
  else if(event.key.toLowerCase()==='y'){event.preventDefault();$('redo').click();}
});
$('play').onclick=async()=>{
  stopPlayback();try{await context();}catch(e){status(e.message,true);return;}
  if(!events.length)return;$('stop').disabled=false;$('play').disabled=true;
  const token=playbackRun;
  const next=index=>{
    if(token!==playbackRun)return;if(index>=events.length){stopPlayback();return;}
    const event=events[index],when=audioContext.currentTime+.02,timing=playbackTiming(event,pitchEditor.tempo);
    event.pitches.forEach(midi=>{sound(midi,when,timing.durationSeconds,1/Math.sqrt(event.pitches.length));flash(midi,index,timing.durationSeconds*1000);});
    const element=$('score').querySelector(`[data-event="${index}"]`);if(element){const score=$('score'),r=element.getBoundingClientRect(),s=score.getBoundingClientRect();if(r.bottom>s.bottom||r.top<s.top)score.scrollTop+=r.top-s.top-60;}
    timers.push(setTimeout(()=>next(index+1),timing.stepSeconds*1000));
  };next(0);
};
$('stop').onclick=stopPlayback;
$('original').addEventListener('play',()=>{playbackRun++;timers.forEach(clearTimeout);timers=[];oscillators.forEach(o=>{try{o.stop();}catch{}});oscillators=[];if(sourceNode){try{sourceNode.stop();}catch{}sourceNode=null;}$('stop').disabled=true;$('play').disabled=!events.length;document.querySelectorAll('.active,.playing').forEach(e=>e.classList.remove('active','playing'));});
async function playSource(ev){if(!canPlaySource(ev)){status('此音符沒有可播放的原音片段，請先載入對應音檔。',true);return;}stopPlayback();try{await context();sourceNode=audioContext.createBufferSource();sourceNode.buffer=buffer;sourceNode.connect(audioContext.destination);const start=Math.max(0,ev.start-.04),end=Math.min(buffer.duration,ev.end+.04);sourceNode.start(0,start,end-start);$('stop').disabled=false;const playingSource=sourceNode;sourceNode.onended=()=>{if(sourceNode===playingSource){sourceNode=null;$('stop').disabled=true;}};}catch(e){status(e.message,true);}}
function updateDownloads(){
  exportUrls.forEach(URL.revokeObjectURL);
  const data=exportProject(events,analysisMeta||{},pitchEditor.tempo);
  exportUrls=[URL.createObjectURL(new Blob([renderScore(events,1000,-1,-1,pitchEditor.tempo,groupSpacing)],{type:'image/svg+xml;charset=utf-8'})),URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}))];
  $('export-svg').href=exportUrls[0];$('export-json').href=exportUrls[1];
}
function createKeyboard(){let white=0;for(let midi=36;midi<=96;midi++){
  const isBlack=[1,3,6,8,10].includes(midi%12),key=document.createElement('button');key.className=`piano-key ${isBlack?'black':'white'}`;key.dataset.midi=midi;key.style.left=(isBlack?white*31-10:white*31)+'px';key.ariaLabel=noteName(midi);key.title=noteName(midi);if(midi%12===0){const span=document.createElement('span');span.textContent=noteName(midi);key.append(span);}if(!isBlack)white++;
  key.onclick=async()=>{stopPlayback();try{await context();sound(midi,audioContext.currentTime+.01);flash(midi);}catch(e){status(e.message,true);}};$('keyboard').append(key);
}$('keyboard').style.width=white*31+'px';}
for(const id of ['pitch-edit','chord-pitch'])for(let midi=MIN_PITCH;midi<=MAX_PITCH;midi++){const option=document.createElement('option');option.value=midi;option.textContent=noteName(midi);$(id).append(option);}createKeyboard();
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{drawWave();if(scoreOpened)render();},180);});
window.addEventListener('pagehide',()=>{worker?.terminate();stopPlayback();if(objectUrl)URL.revokeObjectURL(objectUrl);exportUrls.forEach(URL.revokeObjectURL);});
