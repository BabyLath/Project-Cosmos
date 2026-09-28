"use client";

import { useEffect, useState } from "react";
import { getMember, type Member, type Role } from "@/lib/api/members";
import { ApiError } from "@/lib/api/auth";
import { canEditMember } from "@/lib/permissions";
import { MemberForm } from "./MemberForm";

export function EditMemberLoader({ id, actor }: { id: string; actor: { id: string; role: Role } }) {
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMember(id)
      .then((r) => !cancelled && setMember(r.member))
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : "Couldn't reach the server."));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <p role="alert" className="text-sm text-oms-danger">{error}</p>;
  if (!member) return <p className="text-sm text-oms-text-muted">Loading…</p>;
  if (!canEditMember(actor, member)) {
    return <p className="text-sm text-oms-text-muted">You do not have permission to edit this account.</p>;
  }
  return <MemberForm mode="edit" actor={actor} member={member} />;
}
