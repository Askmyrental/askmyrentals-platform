// Team role rules: what owners, managers, cleaners, maintenance, and inspectors
// can see and do. Pure logic and source checks only; no database, network,
// emails, or payments.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

const out = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/utils/teamRoles.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText,
  { exports: out, String },
);

// Who runs the team
for (const role of ['owner', 'Owner', 'group_owner', 'administrator', 'admin', 'manager', 'Team Manager']) {
  assert.equal(out.canManageTeam(role), true, role);
  assert.equal(out.seesOnlyAssignedWork(role), false, role);
  assert.equal(out.canSeeBusinessFinancials(role), true, role);
}
// Assigned-only roles, including the previously missed maintenance and inspector
for (const role of ['cleaner', 'maintenance', 'Maintenance Worker', 'inspector', 'team_member', 'member', 'employee', 'something-new']) {
  assert.equal(out.canManageTeam(role), false, role);
  assert.equal(out.seesOnlyAssignedWork(role), true, role);
  assert.equal(out.canSeeBusinessFinancials(role), false, role);
}
// A personal account with no team role is not limited
assert.equal(out.seesOnlyAssignedWork(''), false);
assert.equal(out.seesOnlyAssignedWork(undefined), false);

// Who can give which roles
assert.deepEqual(Array.from(out.assignableTeamRoles('manager')), ['cleaner', 'maintenance']);
assert.deepEqual(Array.from(out.assignableTeamRoles('administrator')), ['cleaner', 'maintenance']);
assert.ok(out.assignableTeamRoles('owner').includes('manager'));
assert.ok(out.assignableTeamRoles('owner').includes('inspector'));
assert.ok(!out.assignableTeamRoles('owner').includes('owner'));
assert.deepEqual(Array.from(out.assignableTeamRoles('cleaner')), []);
assert.deepEqual(Array.from(out.assignableTeamRoles('maintenance')), []);

// Who can change or remove whom
assert.equal(out.canManageMember('manager', 'cleaner'), true);
assert.equal(out.canManageMember('manager', 'maintenance'), true);
assert.equal(out.canManageMember('manager', 'manager'), false);
assert.equal(out.canManageMember('manager', 'administrator'), false);
assert.equal(out.canManageMember('manager', 'inspector'), false);
assert.equal(out.canManageMember('manager', 'cleaner', true), false, 'managers cannot change themselves');
assert.equal(out.canManageMember('owner', 'manager'), true);
assert.equal(out.canManageMember('owner', 'owner'), false);
assert.equal(out.canManageMember('cleaner', 'cleaner'), false);

// Screens use the shared rules
const pulse = fs.readFileSync('src/pages/CleanerPortalPage.tsx', 'utf8');
assert(pulse.includes('const isAssignedTeamCleaner = seesOnlyAssignedWork(normalizedGroupRole);'));
assert(pulse.includes('canEditCharge={canSeeBusinessFinancials(normalizedGroupRole)}'));
assert(/\{!isAssignedTeamCleaner && \(\s*<div className="cleanerJobPayRow">/.test(pulse), 'charge row hidden from assigned-only roles');
const app = fs.readFileSync('src/App.tsx', 'utf8');
assert(app.includes('seesOnlyAssignedWork(selectedGroupRole) ||'), 'maintenance/inspectors load their assigned work');
const modal = fs.readFileSync('src/components/pulse/CompleteTaskModal.tsx', 'utf8');
assert(modal.includes('canEditCharge = true'));
assert(modal.includes('chargeEdited: canEditCharge && chargeEdited'), 'non-managers never send a charge change');
assert(modal.includes('{canEditCharge && ('));
const team = fs.readFileSync('src/pages/SharedWorkspacesPage.tsx', 'utf8');
assert(team.includes('assignableTeamRoles(selectedGroupRole).map'));
assert(!team.includes('<option value="administrator">Administrator</option>'), 'role menus come from the shared rules');

// Backend mirrors the database hierarchy
const server = fs.readFileSync('server.cjs', 'utf8');
const start = server.indexOf('const MANAGER_MANAGEABLE_ROLES');
const end = server.indexOf('app.post(', start);
const helper = {};
vm.runInNewContext(server.slice(start, end) + '\nexports.check = assertCanManageTeamRole;', { exports: helper, Set, Error });
const blocked = (fn) => { try { fn(); return false; } catch (error) { return error.statusCode === 403; } };
assert.equal(blocked(() => helper.check('manager', 'cleaner', null)), false);
assert.equal(blocked(() => helper.check('manager', 'maintenance', 'cleaner')), false);
assert.equal(blocked(() => helper.check('manager', 'manager', null)), true);
assert.equal(blocked(() => helper.check('administrator', 'administrator', null)), true);
assert.equal(blocked(() => helper.check('manager', 'cleaner', 'manager')), true);
assert.equal(blocked(() => helper.check('manager', null, 'inspector')), true);
assert.equal(blocked(() => helper.check('owner', 'manager', 'cleaner')), false);
assert.equal(blocked(() => helper.check('owner', null, 'owner')), true);
// Every manager-only contact/invite route applies the check
const routes = server.match(/^\s+await requireGroupManager\(groupId, req\.amrUser\.id\);/gm) || [];
assert.equal(routes.length, 0, 'no manager route skips the role check');
assert.equal((server.match(/assertCanManageTeamRole\(/g) || []).length, 8);

console.log('PASS team roles: owner/manager/assigned-only rules, maintenance+inspector limited, charge hidden from staff, role menus, backend hierarchy on all 7 manager routes.');
