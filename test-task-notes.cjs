const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const mod = {exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/saveTaskNotes.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, {exports:mod.exports, module:mod});
const save = mod.exports.saveTaskNotes;
function database(initial, allowed=true, fail=false) {
 const row={id:'task',notes:initial,status:'Accepted',timeline:['Check grill'],assigned_user_id:'assigned'};
 let writes=0;
 return {row,get writes(){return writes},from(table){assert(['reservations','cleaner_jobs'].includes(table));let update,match;const q={update(v){update=v;assert.deepEqual(Object.keys(v),['notes']);return q},eq(k,v){if(k==='notes')match=v;else assert.equal(k,'id');return q},is(k,v){assert.equal(k,'notes');match=v;return q},select(){return q},async maybeSingle(){if(fail)return {error:{message:'DB unavailable'}};if(!allowed||row.notes!==match)return {data:null,error:null};Object.assign(row,update);writes++;return {data:{id:row.id,notes:row.notes},error:null};}};return q;}};
}
(async()=>{
 for(const table of ['reservations','cleaner_jobs']) {
  const db=database(null);assert.equal(await save(db,table,'task',null,'Check supplies'),'Check supplies');
  assert.equal(db.row.notes,'Check supplies');assert.equal(db.row.status,'Accepted');assert.deepEqual(db.row.timeline,['Check grill']);
  assert.equal(await save(db,table,'task','Check supplies','Check supplies; check grill'),'Check supplies; check grill');
  await assert.rejects(save(db,table,'task','Check supplies','stale draft'),/changed/);assert.equal(db.row.notes,'Check supplies; check grill');
  assert.equal(await save(db,table,'task',db.row.notes,''),'');
  const denied=database('private',false);await assert.rejects(save(denied,table,'task','private','bad'),/access/);assert.equal(denied.writes,0);
  const broken=database('',true,true);await assert.rejects(save(broken,table,'task','','draft'),/DB unavailable/);assert.equal(broken.writes,0);
 }
 const s=fs.readFileSync('src/pages/CleanerPortalCalendar.tsx','utf8');
 const start=s.indexOf('  const getTaskTitle =');const end=s.indexOf('  const getTaskSubtitle =',start);
 const code=ts.transpileModule(s.slice(start,end)+'\nglobalThis.title=getTaskTitle;globalThis.address=getTaskAddress;',{}).outputText;
 const context={homes:[],normalizeId:String,isOwnerStay:()=>false,isNoCleanNeeded:()=>false,isAirbnbBlock:()=>false};vm.runInNewContext(code,context);
 assert.equal(context.title({propertyName:'Squeeze Me In',propertyAddress:'123 Main',guestName:'Miranda'}),'Squeeze Me In');
 assert.equal(context.address({propertyAddress:'123 Main'}),'123 Main');
 assert.equal(context.title({propertyName:' ',propertyAddress:'123 Main',guestName:'Miranda'}),'123 Main');
 context.homes=[{id:'p',name:'',address:''}];assert.equal(context.title({homeId:'p',propertyName:'Assigned property',propertyAddress:'A'}),'Assigned property');
 console.log('PASS: both task tables: save/reload, existing notes, stale edits, clearing, denied access, DB failure, unchanged status/history; 4 property label checks.');
})().catch(e=>{console.error(e);process.exitCode=1});
