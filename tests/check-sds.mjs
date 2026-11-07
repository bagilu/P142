import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const root=existsSync('dist/index.html')?'dist':'.';
const html=readFileSync(resolve(root,'index.html'),'utf8');
const js=readdirSync(root).filter(f=>f.endsWith('.js')).map(f=>readFileSync(resolve(root,f),'utf8')).join('\n');
const businessJs=js.replace(/Array\.from\s*\(/g,'ArrayFrom(');
const checks={
 'QA-02 No direct table CRUD':!/\.from\s*\(|\/rest\/v1\/|graphql/i.test(businessJs),
 'QA-03 No database transport':!/supabase\.rpc\s*\(|fetch\s*\(|XMLHttpRequest|WebSocket/.test(js),
 'QA-10 No embedded privileged secrets':!/service_role|sb_secret_|smtp[_-]?password|eyJ[a-zA-Z0-9_-]{15,}\./.test(js),
 'QA-12 No config.js in release':!existsSync(resolve(root,'config.js'))&&existsSync(resolve(root,'config-sample.js')),
 'QA-15 HTML version/cache busting':html.includes('V0.002')&&html.includes('style.css?v=0.002')&&html.includes('app.js?v=0.002')&&js.includes('analysis-worker.js?v=0.002')&&js.includes('dsp.js?v=0.002')&&js.includes('notation.js?v=0.002')&&js.includes('editor-state.js?v=0.002'),
 'QA-16 Footer identity and order':/慈濟大學｜經營管理學系｜好玩實驗室[\s\S]*Web Version V0\.002 · SBI-P-SDS v3\.6/.test(html),
 'QA-22 Frontend files': ['index.html','style.css','app.js','dsp.js','notation.js','analysis-worker.js','icon.svg','config-sample.js','editor-state.js'].every(f=>existsSync(resolve(root,f))),
 'Privacy no remote assets/requests':!/https?:\/\//.test(html)&&!/(fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket)/.test(js)
};
for(const [name,ok]of Object.entries(checks)) console.log(`${ok?'PASS':'FAIL'} ${name}`);
if(Object.values(checks).some(v=>!v))process.exit(1);
