// Tests for the combined Work list (rental cleans + independent jobs).
// Pure logic only: no database, network, emails, or payments.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

const source = fs.readFileSync('src/utils/rentalCleans.ts', 'utf8');
const out = {};
vm.runInNewContext(
  ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
  { exports: out, Date, Number, String },
);

const today = new Date('2026-10-10T09:00:00');
const imported = (reservation) => Boolean(reservation.calendarFeedId);

const reservations = [
  { id: 'past', calendarFeedId: 'f1', departure: '2026-10-09', status: 'Upcoming', homeId: 'h1' },
  { id: 'today-unassigned', calendarFeedId: 'f1', departure: '2026-10-10', status: '', homeId: 'h1' },
  { id: 'assigned-libby', calendarFeedId: 'f1', departure: '2026-10-15', status: 'Upcoming', homeId: 'h1', assigned_user_id: 'libby' },
  { id: 'in-progress', calendarFeedId: 'f1', departure: '2026-10-12', status: 'In Progress', homeId: 'h2', assignedUserId: 'logan' },
  { id: 'no-clean', calendarFeedId: 'f1', departure: '2026-10-20', status: 'No clean needed', homeId: 'h1' },
  { id: 'invoiced', calendarFeedId: 'f1', departure: '2026-10-21', status: 'Complete', invoiceSent: true, homeId: 'h1' },
  { id: 'plain-block', source: 'vrbo', calendarFeedId: 'f1', departure: '2026-10-22', status: 'Blocked', homeId: 'h1' },
  { id: 'owner-stay', source: 'Owner Block', departure: '2026-10-23', status: 'Blocked', homeId: 'h1' },
  { id: 'manual-reservation', source: 'Direct', departure: '2026-10-24', status: 'Upcoming', homeId: 'h1' },
];

// Owners/managers: every upcoming rental clean that still needs work, in date order.
const all = out.selectUpcomingRentalCleans(reservations, { isImportedReservation: imported, today });
assert.deepEqual(all.map((r) => r.id), ['today-unassigned', 'in-progress', 'assigned-libby', 'owner-stay']);

// Cleaners / maintenance / inspectors: only rental cleans assigned to them.
const libby = out.selectUpcomingRentalCleans(reservations, { isImportedReservation: imported, today, onlyAssignedToUserId: 'libby' });
assert.deepEqual(libby.map((r) => r.id), ['assigned-libby']);

// Restricted view with an unknown user sees nothing rather than everything.
const unknown = out.selectUpcomingRentalCleans(reservations, { isImportedReservation: imported, today, onlyAssignedToUserId: null });
assert.deepEqual(unknown, []);

// Statuses match the home screen rules.
assert.equal(out.getRentalCleanStatus({ status: 'In Progress' }), 'In Progress');
assert.equal(out.getRentalCleanStatus({ status: 'Started' }), 'In Progress');
assert.equal(out.getRentalCleanStatus({ status: 'Complete' }), 'Completed');
assert.equal(out.getRentalCleanStatus({ status: 'Complete', invoiceSent: true }), 'Invoiced');
assert.equal(out.getRentalCleanStatus({ status: 'no clean needed' }), 'No Clean Needed');
assert.equal(out.getRentalCleanStatus({}), 'Upcoming');

// "Rental clean" wording is display-only; stored values are untouched.
assert.equal(out.displayWorkType('Vacation Rental Turnover'), 'Rental clean');
assert.equal(out.displayWorkType(undefined), 'Rental clean');
assert.equal(out.displayWorkType('Deep Clean'), 'Deep Clean');
const stored = { jobType: 'Vacation Rental Turnover' };
out.displayWorkType(stored.jobType);
assert.equal(stored.jobType, 'Vacation Rental Turnover');

// Source labels.
assert.equal(out.getRentalCleanSourceLabel({ calendarSource: 'airbnb' }), 'From Airbnb');
assert.equal(out.getRentalCleanSourceLabel({ source: 'Owner Block' }), 'Owner stay');

// Wiring checks: the tab is called Work but keeps the same page key, so saved
// links and back/forward navigation still work.
const app = fs.readFileSync('src/App.tsx', 'utf8');
assert(app.includes('{ label: "Work", page: "Cleaner Jobs" }'));
assert(app.includes('{ label: "Work", page: "Cleaner Jobs", icon: "💼" }'));
assert(!app.includes('label: "Jobs", page: "Cleaner Jobs"'));
assert(app.includes('onOpenRentalClean={openRentalCleanTask}'));
assert(app.includes('updated.set("view", "Cleaner Portal");') && app.includes('updated.set("task", taskId);'));

// Rental clean fees are only shown to owners/managers.
const jobsPage = fs.readFileSync('src/pages/CleanerJobsPage.tsx', 'utf8');
assert(jobsPage.includes('{canSeeAllWork && feeCents !== null && ('));
assert(jobsPage.includes('onlyAssignedToUserId: canSeeAllWork ? undefined : currentUserId'));
// Maintenance and inspector are not in the see-everything list.
const seeAll = jobsPage.slice(jobsPage.indexOf('const canSeeAllWork'), jobsPage.indexOf('].includes(normalizedGroupRole);', jobsPage.indexOf('const canSeeAllWork')));
assert(!/maintenance|inspector/.test(seeAll));

// Home screen opens on the next 7 days and can expand.
const pulse = fs.readFileSync('src/pages/CleanerPortalPage.tsx', 'utf8');
assert(pulse.includes('>("7");'));
assert(pulse.includes('Show All Upcoming'));
assert(pulse.includes('setPulseDateRange("all");'));

console.log('PASS Work list: rental cleans + independent jobs, assigned-only visibility, Rental clean labels, Work tab wiring, 7-day home default.');
