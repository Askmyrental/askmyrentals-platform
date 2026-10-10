const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
const out = {};
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(compile(fs.readFileSync('src/utils/calendarFeed.ts', 'utf8')), { exports: out, URL });
const airbnb = 'https://www.airbnb.com/calendar/ical/test.ics';
const vrbo = 'https://www.vrbo.com/icalendar/test.ics';
assert.equal(out.validateCalendarFeed('Airbnb', ' '+airbnb+' '), airbnb);
assert.equal(out.validateCalendarFeed('VRBO', vrbo), vrbo);
for (const [provider, url] of [['', airbnb], ['VRBO', airbnb], ['Airbnb', vrbo], ['Airbnb', 'https://www.airbnb.com/rooms/123'], ['Airbnb', 'https://airbnb.evil.com/calendar/ical/test'], ['Airbnb', 'http://www.airbnb.com/calendar/ical/test'], ['VRBO', 'https://user:password@vrbo.com/icalendar/test.ics']]) {
  assert.throws(() => out.validateCalendarFeed(provider, url));
}
for (const provider of ['Airbnb', 'VRBO']) {
  const url = provider === 'Airbnb' ? airbnb : vrbo;
  const updates = out.calendarFeedUpdates(provider, url);
  assert.equal(updates.calendar_source, provider);
  assert.equal(out.resolveCalendarFeed(updates, { calendarSource: 'VRBO', vrboCalendarUrl: vrbo }).url, url);
  assert.equal(Object.values(updates).filter(v => v === url).length, 2); // canonical + selected legacy alias
  assert.equal(updates[provider === 'Airbnb' ? 'vrbo_property_id' : 'airbnb_property_id'], null);
}
assert.equal(out.resolveCalendarFeed({ calendar_feed_url: vrbo, calendar_source: 'Airbnb', airbnb_property_id: airbnb }).url, airbnb);
assert.equal(out.resolveCalendarFeed({ airbnb_ical_url: airbnb }).provider, 'Airbnb');
const app = fs.readFileSync('src/App.tsx', 'utf8').replace(/\r\n/g, '\n');
const start = app.indexOf('  async function connectCleanerPropertyCalendar(');
const end = app.indexOf('  async function updateCleanerProperty(', start);
const source = compile(app.slice(start, end)+'\nglobalThis.connect = connectCleanerPropertyCalendar;');
async function test(mode) {
  const connected = !['new', 'denied', 'anonymous', 'save-error', 'zero-row', 'import-error'].includes(mode);
  const record = { id: 'property', calendar_feed_url: connected ? vrbo : null, calendar_source: connected ? 'VRBO' : null, airbnb_property_id: null, vrbo_property_id: connected ? vrbo : null, notes: 'private notes' };
  const saved = { ...record, ...(mode === 'stale' ? { calendar_feed_url: 'https://www.vrbo.com/icalendar/new.ics', vrbo_property_id: 'https://www.vrbo.com/icalendar/new.ics' } : {}) };
  let writes = 0, syncs = 0, loads = 0, changes, checks = [];
  const db = { auth: { getUser: async () => ({ data: { user: mode === 'anonymous' ? null : { id: 'owner' } } }) }, from(table) {
    assert.equal(table, 'properties'); let updating = false;
    const query = { select(){return query}, update(value){updating=true; writes++;changes=value;return query}, eq(k,v){checks.push([k,v]);return query}, is(k,v){checks.push([k,v]);return query}, async single(){return updating ? { data: ['save-error','zero-row'].includes(mode) ? null : { id:'property' }, error:mode==='save-error'?{message:'DB failure'}:null } : { data: mode==='denied'?null:saved, error:mode==='denied'?{message:'Access denied'}:null };} }; return query;
  }};
  const context = { ...out, supabase: db, homes: [{ id:'property', calendarFeedUrl: record.calendar_feed_url || '', iCalUrl: record.vrbo_property_id || '', airbnbUrl:'' }], decodeCleanerPropertyDetails:()=>({}), loadPropertiesFromSupabase:async()=>{loads++}, syncReservations:async(home)=>{syncs++;assert.equal(home.iCalUrl,'');assert.equal(home.airbnbUrl,airbnb);if(mode==='import-error')throw Error('Import failed');return 2} };
  vm.runInNewContext(source, context);
  const promise = context.connect('property', airbnb, 'Airbnb', connected && mode !== 'no-replace');
  if (['anonymous','denied','stale','no-replace','save-error','zero-row','import-error'].includes(mode)) await assert.rejects(promise);
  else { const result = await promise; assert.equal(result.source,'Airbnb');assert.equal(result.importedCount,connected?0:2);assert.equal(!!result.replaced,connected); }
  if (['anonymous','denied','stale','no-replace'].includes(mode)) assert.equal(writes,0);
  if (writes) { assert.equal(changes.calendar_source,'Airbnb');assert.equal(changes.vrbo_property_id,null);assert.equal(changes.notes,undefined);assert(checks.some(([k,v])=>k==='owner_id'&&v==='owner'));for(const field of ['calendar_feed_url','calendar_source','airbnb_property_id','vrbo_property_id'])assert(checks.some(([k])=>k===field)); }
  if (connected || ['save-error','zero-row','denied','anonymous'].includes(mode)) assert.equal(syncs,0);
  if (['save-error','zero-row'].includes(mode)) assert.equal(loads,0);
  console.log('PASS '+mode);
}
(async()=>{for(const mode of ['new','replace','no-replace','stale','denied','anonymous','save-error','zero-row','import-error'])await test(mode);console.log('PASS provider validation, reload, legacy selection, one active feed, ownership, concurrency, reservation preservation');})().catch(e=>{console.error(e);process.exitCode=1});
