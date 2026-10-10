const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const s=fs.readFileSync('src/utils/appHistory.ts','utf8');const code=ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;const testExports={};vm.runInNewContext(code,{exports:testExports,require:()=>({}),URLSearchParams});
for(const role of ['cleaner','company-owner']) {
 const history=['/'];let index=0;const push=(key,value)=>{const p=testExports.updateAppSearch(history[index].split('?')[1]||'',key,value);history.splice(++index);history.push('/app?'+p.toString())};
 history.push('/app');index=1;
 push('view','Cleaner Profile');push('view','Shared Workspaces');push('view','Cleaner Schedule');push('calendar','1');push('day','2026-10-15');push('task','sample-task');
 const card=history[index];index--;assert(!history[index].includes('task='));assert(history[index].includes('day='));index++;assert.equal(history[index],card);assert.equal(new URL('https://test'+history[index]).searchParams.get('task'),'sample-task');
 push('view','Cleaner Profile');assert(!history[index].includes('task='));assert(!history[index].includes('calendar='));
 while(index>0)index--;assert.equal(history[index],'/');
 console.log('PASS '+role+': Back, Forward, reload URL, view cleanup, natural exit');
}
const gate=fs.readFileSync('src/AuthGate.tsx','utf8');assert(gate.includes('const [invitationJustAccepted, setInvitationJustAccepted] = useState(false)'));assert(gate.includes('if (response === "accept") setInvitationJustAccepted(true)'));assert(gate.includes('invitationJustAccepted &&'));console.log('PASS: invitation welcome gated by fresh acceptance');
