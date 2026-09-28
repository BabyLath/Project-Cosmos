"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMember, updateMemberStatus, type Member, type Role } from "@/lib/api/members";
import { ApiError } from "@/lib/api/auth";
import { canChangeStatus, canEditMember } from "@/lib/permissions";
import { RoleBadge, StatusBadge } from "./Badges";

export function MemberDetail({ id, currentUser }: { id: string; currentUser: { id: string; role: Role } }) {
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMember(id)
      .then((r) => !cancelled && setMember(r.member))
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Couldn't reach the server."));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function toggleStatus() {
    if (!member) return;
    const next = member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    if (next === "INACTIVE" && !window.confirm(`Deactivate ${member.fullName}? They will be signed out and unable to log in.`)) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const r = await updateMemberStatus(member.id, next);
      setMember(r.member);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-oms-danger/40 bg-oms-danger/10 px-4 py-3 text-sm text-oms-danger">
        {error}
      </div>
    );
  }
  if (!member) return <p className="text-sm text-oms-text-muted">Loading…</p>;

  return (
    <div className="rounded-xl border border-oms-surface-alt bg-oms-surface p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{member.fullName}</h2>
          <p className="text-sm text-oms-text-muted">{member.email}</p>
        </div>
        <div className="flex gap-2">
          <RoleBadge role={member.role} />
          <StatusBadge status={member.status} />
        </div>
      </div>

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-oms-text-muted">Joined</dt>
          <dd>{new Date(member.createdAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-oms-text-muted">Last updated</dt>
          <dd>{new Date(member.updatedAt).toLocaleString()}</dd>
        </div>
      </dl>

      {actionError && (
        <div role="alert" className="mt-4 rounded-lg border border-oms-danger/40 bg-oms-danger/10 px-3.5 py-2.5 text-sm text-oms-danger">
          {actionError}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {canEditMember(currentUser, member) && (
          <Link
            href={`/members/${member.id}/edit`}
            className="rounded-lg bg-oms-accent px-4 py-2 text-sm font-medium text-oms-bg hover:bg-oms-accent-hover"
          >
            Edit
          </Link>
        )}
        {canChangeStatus(currentUser, member) && (
          <button
            onClick={toggleStatus}
            disabled={busy}
            className="rounded-lg border border-oms-surface-alt px-4 py-2 text-sm font-medium hover:bg-oms-surface-alt disabled:opacity-60"
          >
            {member.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
          </button>
        )}
        <Link href="/members" className="rounded-lg px-4 py-2 text-sm text-oms-text-muted hover:text-oms-text">
          Back to members
        </Link>
      </div>
    </div>
  );
}
