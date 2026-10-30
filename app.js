import { frequency } from './dsp.js?v=0.001';
import { noteName, renderScore } from './notation.js?v=0.001';
const $ = id => document.getElementById(id);
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
  timers.forEach(clearTimeout); timers = [];
  oscillators.forEach(o => { try { o.stop(); } catch {} }); oscillators = [];
  if (sourceNode) { try { sourceNode.stop(); } catch {} sourceNode = null; }
  $('original').pause();
  document.querySelectorAll('.playing,.piano-key.active').forEach(el => el.classList.remove('playing', 'active'));
  $('stop').disabled = true; $('play').disabled = !events.length || busy;
}
function sound(midi, when, duration = .65) {
  const ctx = audioContext, amp = ctx.createGain();
  amp.gain.setValueAtTime(0, when); amp.gain.linearRampToValueAtTime(.13, when + .012);
  amp.gain.exponentialRampToValueAtTime(.045, when + Math.min(.2, duration*.5));
  amp.gain.exponentialRampToValueAtTime(.0001, when + duration);
  amp.connect(ctx.destination);
  for (const [h, volume] of [[1,1],[2,.27],[3,.09]]) {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = frequency(midi) * h; gain.gain.value = volume;
    osc.connect(gain).connect(amp); osc.start(when); osc.stop(when + duration + .03);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); }; oscillators.push(osc);
  }
  timers.push(setTimeout(() => amp.disconnect(), Math.max(0, when-ctx.currentTime+duration+.1)*1000));
}
function flash(midi, index = -1, duration = 500) {
  const key = document.querySelector(`[data-midi="${midi}"]`); key?.classList.add('active');
  if (index >= 0) document.querySelectorAll(`[data-event="${index}"]`).forEach(el => el.classList.add('playing'));
  timers.push(setTimeout(() => { key?.classList.remove('active'); if(index>=0) document.querySelectorAll(`[data-event="${index}"]`).forEach(el=>el.classList.remove('playing')); }, duration));
}
function resetResults() {
  events = []; analysisMeta = null; selected = -1; exportUrls.forEach(URL.revokeObjectURL); exportUrls = []; $('results').hidden = true; $('empty').hidden = false; $('editor').hidden = true; $('count').textContent = '等待分析';
  $('score').replaceChildren();
}
function setBusy(value) {
  busy = value; $('analyze').disabled = value || !buffer || fileBusy; $('file').disabled = value; $('demo').disabled = value || fileBusy;
  for (const id of ['start','end','mode','min-duration','gate']) $(id).disabled = value;
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
  stopPlayback(); resetResults(); buffer=next; sourceName=name;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl=URL.createObjectURL(blob); $('original').src=objectUrl;
  $('file-title').textContent=name; $('file-description').textContent='已載入 · 可重新選擇音檔';
  $('source-area').hidden=false; $('start').value='0'; $('end').value=Math.min(90,next.duration).toFixed(2);
  $('start').max=next.duration; $('end').max=next.duration;
  $('duration').textContent=`${next.duration.toFixed(2)} 秒 · ${next.numberOfChannels} 聲道`;
  $('analyze').disabled=false; drawWave();
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
  stopPlayback();resetResults();setBusy(true);$('progress').value=0;status('正在分析音高，請稍候…');
  const token=++run, rate=buffer.sampleRate, first=Math.floor(start*rate), last=Math.min(buffer.length,Math.floor(end*rate)), samples=new Float32Array(last-first);
  // Select the channel with the greatest energy, avoiding anti-phase stereo cancellation.
  let bestChannel=0,bestEnergy=-1;
  for(let c=0;c<buffer.numberOfChannels;c++){const ch=buffer.getChannelData(c);let e=0;for(let i=first;i<last;i+=16)e+=ch[i]*ch[i];if(e>bestEnergy){bestEnergy=e;bestChannel=c;}}
  samples.set(buffer.getChannelData(bestChannel).subarray(first,last));
  try {
    worker=new Worker(new URL('./analysis-worker.js?v=0.001',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{
      if(token!==run)return;
      if(data.type==='progress'){$('progress').value=data.progress;status(`正在分析音高… ${data.progress}%`);}
      if(data.type==='error')finishError(data.message);
      if(data.type==='complete'){
        worker.terminate();worker=null;setBusy(false);events=data.result.events;analysisMeta={...data.result,events:undefined,source:sourceName,range:{start,end},sampleRate:rate,channel:bestChannel+1};
        if(!events.length){$('count').textContent='未找到穩定音高';status('沒有找到足夠穩定的音符。請縮小片段、降低訊號門檻或縮短最短音長。',true);return;}
        render();status(`完成：${events.length} 組音高。請播放原音，核對八度與音符。${$('mode').value==='poly'?'多音模式為實驗功能。':''}`);
      }
    };
    worker.onerror=()=>{if(token===run)finishError('分析模組未能啟動。請以 HTTPS 網址或本機伺服器開啟，並確認所有檔案已完整上傳。');};
    worker.postMessage({samples,sampleRate:rate,options:{mode:$('mode').value,minDuration:Number($('min-duration').value),gate:Number($('gate').value),offset:start}},[samples.buffer]);
  }catch(e){finishError(e.message);}
};
function finishError(message){worker?.terminate();worker=null;setBusy(false);status(`分析未完成：${message}`,true);}
$('cancel').onclick=()=>{++run;worker?.terminate();worker=null;setBusy(false);status('分析已取消，可調整設定後重試。');};
function render() {
  $('empty').hidden=!!events.length;$('results').hidden=!events.length;$('count').textContent=`${events.length} 組音高`;
  $('play').disabled=!events.length;
  if(!events.length){$('count').textContent='沒有音符';$('editor').hidden=true;return;}
  const width=Math.max(340,Math.floor($('output-panel')?.clientWidth||$('score').parentElement.clientWidth)-12);
  $('score').innerHTML=renderScore(events,width,selected,selectedPitch);
  const all=events.flatMap(e=>e.pitches);$('range-summary').textContent=`${noteName(Math.min(...all))} — ${noteName(Math.max(...all))}`;
  const table=document.createElement('table');table.innerHTML='<thead><tr><th>順序</th><th>音高</th><th>原音時間（秒）</th><th>檢視</th></tr></thead>';
  const tbody=document.createElement('tbody');events.forEach((ev,i)=>{
    const tr=document.createElement('tr');
    for(const text of [i+1,ev.pitches.map(noteName).join(' · '),`${ev.start.toFixed(2)}–${ev.end.toFixed(2)}`]){const td=document.createElement('td');td.textContent=text;tr.append(td);}
    const td=document.createElement('td'),btn=document.createElement('button');btn.textContent='原音片段';btn.onclick=()=>playSource(ev);td.append(btn);tr.append(td);tbody.append(tr);
  });table.append(tbody);$('note-table').replaceChildren(table);updateDownloads();
}
async function selectNote(index,pitch){
  if(!events[index])return; stopPlayback(); selected=index;selectedPitch=pitch; const ev=events[index],midi=ev.pitches[pitch];
  render();$('editor').hidden=false;$('selected-title').textContent=`第 ${index+1} 組 · ${noteName(midi)}`;$('selected-time').textContent=`原音 ${ev.start.toFixed(2)}–${ev.end.toFixed(2)} 秒${ev.confidence<.68?' · 待確認':''}`;$('pitch-edit').value=midi;
  try{await context();sound(midi,audioContext.currentTime+.015);flash(midi);}catch(e){status(e.message,true);}
  const key=document.querySelector(`[data-midi="${midi}"]`);if(key){const scroll=$('keyboard').parentElement;scroll.scrollLeft=Math.max(0,key.offsetLeft-scroll.clientWidth/2);}
}
$('score').addEventListener('click',e=>{const g=e.target.closest('[data-event]');if(g)selectNote(Number(g.dataset.event),Number(g.dataset.pitch));});
$('score').addEventListener('keydown',e=>{const g=e.target.closest('[data-event]');if(g&&['Enter',' '].includes(e.key)){e.preventDefault();selectNote(Number(g.dataset.event),Number(g.dataset.pitch));}});
$('pitch-edit').onchange=()=>{if(!events[selected])return;const ev=events[selected];ev.pitches[selectedPitch]=Number($('pitch-edit').value);ev.pitches=[...new Set(ev.pitches)].sort((a,b)=>a-b);ev.edited=true;ev.confidence=.99;ev.cents=0;selectedPitch=Math.max(0,ev.pitches.indexOf(Number($('pitch-edit').value)));selectNote(selected,selectedPitch);};
$('audition').onclick=()=>selectNote(selected,selectedPitch);
$('remove-note').onclick=()=>{if(!events[selected])return;stopPlayback();const ev=events[selected];ev.pitches.splice(selectedPitch,1);if(!ev.pitches.length)events.splice(selected,1);else ev.edited=true;selected=-1;$('editor').hidden=true;render();};
$('play').onclick=async()=>{
  stopPlayback();try{await context();}catch(e){status(e.message,true);return;}
  $('original').pause();$('stop').disabled=false;$('play').disabled=true;
  events.forEach((ev,i)=>{
    const delay=i*.65;
    ev.pitches.forEach(midi=>sound(midi,audioContext.currentTime+delay+.02,.52));
    timers.push(setTimeout(()=>{ev.pitches.forEach(m=>flash(m,i,500));const el=document.querySelector(`[data-event="${i}"]`);if(el){const score=$('score');const r=el.getBoundingClientRect(),s=score.getBoundingClientRect();if(r.bottom>s.bottom||r.top<s.top)score.scrollTop+=r.top-s.top-60;}},delay*1000));
  });
  timers.push(setTimeout(stopPlayback,events.length*650+50));
};
$('stop').onclick=stopPlayback;
$('original').addEventListener('play',()=>{timers.forEach(clearTimeout);timers=[];oscillators.forEach(o=>{try{o.stop();}catch{}});oscillators=[];if(sourceNode){try{sourceNode.stop();}catch{}sourceNode=null;}$('stop').disabled=true;$('play').disabled=!events.length;document.querySelectorAll('.active,.playing').forEach(e=>e.classList.remove('active','playing'));});
async function playSource(ev){stopPlayback();try{await context();sourceNode=audioContext.createBufferSource();sourceNode.buffer=buffer;sourceNode.connect(audioContext.destination);const start=Math.max(0,ev.start-.04),end=Math.min(buffer.duration,ev.end+.04);sourceNode.start(0,start,end-start);$('stop').disabled=false;sourceNode.onended=()=>{$('stop').disabled=true;};}catch(e){status(e.message,true);}}
function updateDownloads(){
  exportUrls.forEach(URL.revokeObjectURL);
  const data={schemaVersion:1,project:'P142',webVersion:'V0.001',sds:'3.6',tuning:440,notation:'pitch-sequence-without-rhythm',confidenceType:'heuristic-not-probability',...analysisMeta,events:events.map(ev=>({...ev,names:ev.pitches.map(noteName)}))};
  exportUrls=[URL.createObjectURL(new Blob([renderScore(events,1000)],{type:'image/svg+xml;charset=utf-8'})),URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}))];
  $('export-svg').href=exportUrls[0];$('export-json').href=exportUrls[1];
}
function createKeyboard(){let white=0;for(let midi=36;midi<=96;midi++){
  const isBlack=[1,3,6,8,10].includes(midi%12),key=document.createElement('button');key.className=`piano-key ${isBlack?'black':'white'}`;key.dataset.midi=midi;key.style.left=(isBlack?white*31-10:white*31)+'px';key.ariaLabel=noteName(midi);key.title=noteName(midi);if(midi%12===0){const span=document.createElement('span');span.textContent=noteName(midi);key.append(span);}if(!isBlack)white++;
  key.onclick=async()=>{stopPlayback();try{await context();sound(midi,audioContext.currentTime+.01);flash(midi);}catch(e){status(e.message,true);}};$('keyboard').append(key);
}$('keyboard').style.width=white*31+'px';}
for(let midi=36;midi<=96;midi++){const opt=document.createElement('option');opt.value=midi;opt.textContent=noteName(midi);$('pitch-edit').append(opt);}createKeyboard();
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{drawWave();if(events.length)render();},180);});
window.addEventListener('pagehide',()=>{worker?.terminate();stopPlayback();if(objectUrl)URL.revokeObjectURL(objectUrl);exportUrls.forEach(URL.revokeObjectURL);});
