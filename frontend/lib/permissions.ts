import type { Role } from "./api/members";

// UI-only helpers so the interface hides actions the backend would
// reject anyway. The backend is the real enforcement point.

export function canManageMembers(role: Role) {
  return role === "ADMIN" || role === "OFFICER";
}

export function canEditMember(actor: { id: string; role: Role }, target: { id: string; role: Role }) {
  if (!canManageMembers(actor.role)) return false;
  // Officers cannot touch admin accounts.
  if (actor.role === "OFFICER" && target.role === "ADMIN") return false;
  return true;
}

export function assignableRoles(actorRole: Role): Role[] {
  return actorRole === "ADMIN" ? ["MEMBER", "OFFICER", "ADMIN"] : ["MEMBER", "OFFICER"];
}

export function canChangeStatus(actor: { id: string; role: Role }, target: { id: string }) {
  return actor.role === "ADMIN" && actor.id !== target.id;
}
