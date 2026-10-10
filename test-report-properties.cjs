const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const moduleExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/utils/reportProperties.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: moduleExports });
const build = moduleExports.buildReportProperties;
const homes = [{ id: 'owned', name: 'Owner property', address: 'Owner address' }];
const tasks = [
  { propertyId: 'assigned', propertyAddress: '404 Defuniak St', privateNotes: 'Do not copy' },
  { property_id: 'assigned', propertyName: 'Squeeze Me In' },
  { home_id: 42, property_name: ' ', property_address: 'Address only' },
  { propertyId: 'owned', propertyName: 'Stale name' },
  { propertyName: 'No property ID' },
];
const before = JSON.stringify({ homes, tasks });
const result = build(homes, tasks);
assert.equal(result.length, 3);
assert.equal(result.find(p => p.id === 'assigned').name, 'Squeeze Me In');
assert.equal(result.find(p => p.id === 'assigned').address, '404 Defuniak St');
assert.equal(result.find(p => p.id === 'assigned').privateNotes, undefined);
assert.equal(result.find(p => p.id === '42').name, 'Address only');
assert.equal(result.find(p => p.id === 'owned').name, 'Owner property');
assert.equal(JSON.stringify({ homes, tasks }), before);
assert.equal(build([], [{ propertyId: 'unknown' }])[0].name, 'Unnamed property');
const page = fs.readFileSync('src/pages/ReportsPage.tsx', 'utf8');
assert(!/\bhomes\.(find|map)\(/.test(page));
assert(page.includes('homes, [...reservations, ...cleanerJobs, ...invoices]'));
assert(!fs.readFileSync('src/utils/reportProperties.ts', 'utf8').includes('supabase'));
console.log('PASS assigned metadata, late names, address fallback, owner precedence, privacy, immutability, report integration');
