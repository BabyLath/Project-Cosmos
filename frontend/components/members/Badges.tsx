import type { AccountStatus, Role } from "@/lib/api/members";

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className="rounded-full border border-oms-accent/50 px-2 py-0.5 text-xs font-medium text-oms-accent">
      {role}
    </span>
  );
}

export function StatusBadge({ status }: { status: AccountStatus }) {
  const active = status === "ACTIVE";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? "bg-oms-success/15 text-oms-success" : "bg-oms-danger/15 text-oms-danger"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}
