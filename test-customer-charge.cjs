const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const compile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const api={};vm.runInNewContext(compile(fs.readFileSync('src/utils/customerCharge.ts','utf8')),{exports:api});
const r=api.resolveCustomerCharge;
assert.equal(r({customerCleaningCharge:210,propertyCleaningFee:185}),210);
assert.equal(r({customerCleaningCharge:0,propertyCleaningFee:185}),0);
assert.equal(r({customerCleaningCharge:null,cleaningFee:999,propertyCleaningFee:185}),185);
assert.equal(r({customerCleaningCharge:null,propertyCleaningFee:0}),0);
assert.equal(r({customer_cleaning_charge:0,property:{cleaning_fee:185}}),0);
assert.equal(r({customerCleaningCharge:null,customer_cleaning_charge:999,propertyCleaningFee:185}),185);
assert.equal(r({property:{standard_cleaning_charge:185}}),185); // assigned view: no homes list
assert.equal(r({cleaningFee:'',price:125,propertyCleaningFee:185}),125);
assert.equal(r({amount:0},{cleaningFee:185}),0);
assert.equal(r({}),null);assert.equal(r({propertyCleaningFee:''}),null);
assert.equal(api.parseCustomerCharge('0'),0);assert.equal(api.parseCustomerCharge(''),null);assert.equal(api.parseCustomerCharge('185.25'),185.25);
for(const v of ['-1','abc','1.001','Infinity','10000000000','1e2'])assert.throws(()=>api.parseCustomerCharge(v));
async function save(table,mode){
 const column=table==='reservations'?'customer_cleaning_charge':'amount_cents';
 const row={id:'task',status:'In Process',[column]:table==='reservations'?null:18500,assigned_user_id:'cleaner',timeline:['Check grill']};
 const before=JSON.stringify(row);let pending,checked=[];
 const client={from(name){assert.equal(name,table);const q={update(v){pending=v;return q},eq(k,v){checked.push([k,v]);return q},is(k,v){checked.push([k,v]);return q},select(){return q},async maybeSingle(){if(mode==='db-error')return{data:null,error:{message:'failure'}};if(mode==='denied'||mode==='stale')return{data:null,error:null};Object.assign(row,pending);return{data:{...row},error:null}}};return q}};
 const promise=api.saveCustomerChargeUpdate(client,table,'task',table==='reservations'?null:185,0,{status:'Completed',timeline:['Check grill','Completion']},['Check grill']);
 if(mode!=='success'){await assert.rejects(promise);assert.equal(JSON.stringify(row),before)}else{
  const saved=await promise;assert.equal(saved[column],0);assert.equal(row[column],0);assert.equal(saved.assigned_user_id,'cleaner');assert.equal(saved.timeline[0],'Check grill');
  const loaded=table==='reservations'?{customerCleaningCharge:row[column],propertyCleaningFee:185}:{amount:row.amount_cents/100};
  assert.equal(r(loaded),0); // reload then invoice resolution
 }
 assert(checked.some(([k,v])=>k==='id'&&v==='task'));assert(checked.some(([k])=>k===column));
 assert(!('assigned_user_id'in pending));assert(!('property_id'in pending));console.log('PASS '+table+' '+mode);
}
async function clearOverride() {
  let persisted=210;
  const q={update(values){persisted=values.customer_cleaning_charge;return q},eq(){return q},is(){return q},select(){return q},async maybeSingle(){return{data:{id:'task',customer_cleaning_charge:persisted},error:null}}};
  const saved=await api.saveCustomerChargeUpdate({from(){return q}},'reservations','task',210,null,{status:'Completed'},[]);
  assert.equal(saved.customer_cleaning_charge,null);
  assert.equal(r({customerCleaningCharge:saved.customer_cleaning_charge,propertyCleaningFee:185}),185);
  const client={from(){throw Error('No write expected')}};
  await assert.rejects(api.saveCustomerChargeUpdate(client,'cleaner_jobs','task',185,null,{}),/Enter a customer charge/);
  await assert.rejects(api.saveCustomerChargeUpdate(client,'cleaner_jobs','task',185,21474836.48,{}),/too large/);
}
const portal=fs.readFileSync('src/pages/CleanerPortalPage.tsx','utf8').replace(/\r\n/g,'\n');
async function completion(name,edited,value){
 const start=portal.indexOf('  const '+name+' = async'),end=portal.indexOf('\n  const ',start+8);
 let call,success=false;
 const ctx={parseCustomerCharge:api.parseCustomerCharge,taskBeingCompleted:{id:'task',customerCleaningCharge:null,propertyCleaningFee:185,status:'Accepted'},updateCleanerTask:async(...args)=>{call=args;return null},setSelectedCleanerTask(){},setTaskNoteDraft(){},setTaskNoteSaved(){},setTaskBeingCompleted(){success=true},window:{alert(){success=true}}};
 vm.runInNewContext(compile(portal.slice(start,end)+'\nglobalThis.run='+name),ctx);
 await ctx.run({cleaningFee:value,chargeEdited:edited,notes:'',photos:[],maintenancePhotos:[],guestReady:true});
 assert.equal(call[3],edited?api.parseCustomerCharge(value):undefined);assert.equal(success,false); // no confirmation on failed save
}
(async()=>{
 await clearOverride();
 for(const table of ['reservations','cleaner_jobs'])for(const mode of ['success','denied','stale','db-error'])await save(table,mode);
 for(const name of ['saveCompletionDraft','finishCompletedTask']){await completion(name,true,'0');await completion(name,true,'');await completion(name,false,'185')}
 const app=fs.readFileSync('src/App.tsx','utf8');assert(app.includes('standard_cleaning_charge:property_standard_cleaning_charge'));assert(!app.slice(app.indexOf('property:properties ('),app.indexOf('property:properties (')+250).includes('notes'));
 assert(!fs.readFileSync('src/pages/CleanerPortalCalendar.tsx','utf8').includes('Estimated Pay'));assert(!portal.includes('Estimated Pay'));
 console.log('PASS precedence, zero, missing values, legacy overrides, assigned metadata, completion edits, reload/invoice, denied/stale saves, no false confirmation');
})().catch(e=>{console.error(e);process.exitCode=1});
