// Manual boundaries only: no meter, beat counting, rests or audio timing.
export const BARLINE_TYPES=['single','double','final'];
export function validateBarline(value){
  if(value==null)return null;
  if(!BARLINE_TYPES.includes(value))throw new Error('小節線類型無效，請使用一般小節線、雙小節線或終止線。');
  return value;
}
export const barlineLabel=value=>({single:'一般小節線',double:'雙小節線',final:'終止線'}[value]||'無小節線');
export const barlineGap=value=>({single:14,double:18,final:20}[value]||0);
