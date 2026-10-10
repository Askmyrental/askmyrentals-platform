// One place for what each team role can see and do in the app.
// The database enforces the same rules (see migrations/proposed/20261011_role_security.sql);
// these helpers keep the screens consistent with it.

export type TeamRole =
  | "owner"
  | "administrator"
  | "manager"
  | "cleaner"
  | "maintenance"
  | "inspector"
  | "team_member"
  | "homeowner"
  | "member"
  | "";

export const TEAM_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  administrator: "Administrator",
  manager: "Manager",
  cleaner: "Cleaner",
  maintenance: "Maintenance Worker",
  inspector: "Inspector",
  team_member: "Team Member",
  homeowner: "Homeowner",
  member: "Member",
};

const OWNER_ROLES = ["owner", "group_owner", "company_owner"];
const MANAGER_ROLES = ["admin", "administrator", "manager", "team_manager"];

export function normalizeTeamRole(role: unknown): string {
  return String(role ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function isTeamOwner(role: unknown) {
  return OWNER_ROLES.includes(normalizeTeamRole(role));
}

// Owners, administrators, and managers run the team: they see all work and
// assign it.
export function canManageTeam(role: unknown) {
  const normalized = normalizeTeamRole(role);
  return OWNER_ROLES.includes(normalized) || MANAGER_ROLES.includes(normalized);
}

// Everyone else in a team (cleaners, maintenance, inspectors, legacy team
// members, and any role the app doesn't recognize) sees only work assigned to
// them. A personal account with no team role is not limited.
export function seesOnlyAssignedWork(role: unknown) {
  const normalized = normalizeTeamRole(role);
  return normalized !== "" && !canManageTeam(normalized);
}

// Charges, invoices, and payment totals are business information.
export function canSeeBusinessFinancials(role: unknown) {
  return !seesOnlyAssignedWork(role);
}

// Roles a person may give to others. Managers may only bring on cleaners and
// maintenance staff; nobody but an owner can create managers or administrators.
export function assignableTeamRoles(actorRole: unknown): string[] {
  if (isTeamOwner(actorRole)) {
    // Team Member and Homeowner stay available to owners until the role
    // migration and homeowner-as-client changes are approved.
    return ["cleaner", "maintenance", "inspector", "manager", "administrator", "team_member", "homeowner"];
  }
  if (canManageTeam(actorRole)) {
    return ["cleaner", "maintenance"];
  }
  return [];
}

// Whether `actorRole` may change or remove someone who currently has `targetRole`.
export function canManageMember(actorRole: unknown, targetRole: unknown, isSelf = false) {
  const target = normalizeTeamRole(targetRole);
  if (target === "owner") return false;
  if (isTeamOwner(actorRole)) return true;
  if (isSelf) return false;
  return canManageTeam(actorRole) && ["cleaner", "maintenance"].includes(target);
}
