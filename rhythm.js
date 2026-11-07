// Manual rhythm only. No audio duration, tempo estimation or beat detection.
export const BEAT_VALUES = [0.25,0.5,1,1.5,2,3,4];
export const DEFAULT_TEMPO = 120;
export function validateBeats(value) {
  if(value == null)return null;
  if(!BEAT_VALUES.includes(value))throw new Error('拍數請選擇 ¼、½、1、1½、2、3 或 4 拍。');
  return value;
}
export function validateTempo(value) {
  if(!Number.isInteger(value)||value<30||value>240)throw new Error('播放速度請輸入 30–240 的整數 BPM。');
  return value;
}
export function playbackTiming(event,tempo=DEFAULT_TEMPO) {
  validateTempo(tempo);const beats=validateBeats(event.beats);
  if(beats===null)return {timed:false,stepSeconds:.65,durationSeconds:.52};
  const stepSeconds=beats*60/tempo;
  return {timed:true,stepSeconds,durationSeconds:stepSeconds*.92};
}
export function noteValue(beats) {
  validateBeats(beats);
  if(beats==null)return {kind:'unassigned',hollow:false,stem:false,flags:0,dotted:false};
  const values={
    '0.25':{kind:'sixteenth',hollow:false,stem:true,flags:2,dotted:false},
    '0.5':{kind:'eighth',hollow:false,stem:true,flags:1,dotted:false},
    '1':{kind:'quarter',hollow:false,stem:true,flags:0,dotted:false},
    '1.5':{kind:'dotted-quarter',hollow:false,stem:true,flags:0,dotted:true},
    '2':{kind:'half',hollow:true,stem:true,flags:0,dotted:false},
    '3':{kind:'dotted-half',hollow:true,stem:true,flags:0,dotted:true},
    '4':{kind:'whole',hollow:true,stem:false,flags:0,dotted:false}
  };
  return values[String(beats)];
}
export const beatLabel = beats => beats==null?'拍數未設定':`${beats} 拍`;
