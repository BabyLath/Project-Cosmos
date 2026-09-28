"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createMember, updateMember, type Member, type Role } from "@/lib/api/members";
import { ApiError } from "@/lib/api/auth";
import { assignableRoles } from "@/lib/permissions";
import { FormError } from "@/components/auth/FormError";

const inputClass =
  "w-full rounded-lg border border-oms-surface-alt bg-oms-surface-alt px-3 py-2.5 text-oms-text focus:outline-none focus:ring-2 focus:ring-oms-accent disabled:opacity-60";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type Props = {
  mode: "create" | "edit";
  actor: { id: string; role: Role };
  member?: Member;
};

export function MemberForm({ mode, actor, member }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(member?.fullName ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [role, setRole] = useState<Role>(member?.role ?? "MEMBER");
  const [errors, setErrors] = useState<{ fullName?: string; email?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const editingSelf = mode === "edit" && member?.id === actor.id;
  // Backend rejects self role changes; mirror that in the UI.
  const roleLocked = editingSelf;
  const roles = assignableRoles(actor.role);
  // Make sure the current role is always shown even if not assignable.
  const roleOptions = roles.includes(role) ? roles : [...roles, role];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const next: typeof errors = {};
    if (!fullName.trim()) next.fullName = "Full name is required";
    if (!email) next.email = "Email is required";
    else if (!isValidEmail(email)) next.email = "Enter a valid email address";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      if (mode === "create") {
        const { member: created } = await createMember({ fullName: fullName.trim(), email: email.trim(), role });
        router.push(`/members/${created.id}`);
      } else if (member) {
        const changes: Partial<{ fullName: string; email: string; role: Role }> = {};
        if (fullName.trim() !== member.fullName) changes.fullName = fullName.trim();
        if (email.trim().toLowerCase() !== member.email) changes.email = email.trim();
        if (!roleLocked && role !== member.role) changes.role = role;
        if (Object.keys(changes).length === 0) {
          router.push(`/members/${member.id}`);
          return;
        }
        await updateMember(member.id, changes);
        router.push(`/members/${member.id}`);
      }
      router.refresh();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Couldn't reach the server. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <FormError message={formError} />

      <div>
        <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium">Full name</label>
        <input id="fullName" className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} aria-invalid={Boolean(errors.fullName)} />
        {errors.fullName && <p className="mt-1.5 text-sm text-oms-danger">{errors.fullName}</p>}
      </div>

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email</label>
        <input id="email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(errors.email)} />
        {errors.email && <p className="mt-1.5 text-sm text-oms-danger">{errors.email}</p>}
        {mode === "edit" && (
          <p className="mt-1.5 text-xs text-oms-text-muted">
            Changing the email changes the address this member signs in with.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="role" className="mb-1.5 block text-sm font-medium">Role</label>
        <select id="role" className={inputClass} value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={roleLocked}>
          {roleOptions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {roleLocked && <p className="mt-1.5 text-xs text-oms-text-muted">You cannot change your own role.</p>}
      </div>

      {mode === "create" && (
        <p className="text-sm text-oms-text-muted">
          No password is set by you. The new member receives a link to choose their own.
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-oms-accent px-5 py-2.5 font-medium text-oms-bg transition hover:bg-oms-accent-hover disabled:opacity-60"
        >
          {submitting ? "Saving…" : mode === "create" ? "Create member" : "Save changes"}
        </button>
        <Link
          href={member ? `/members/${member.id}` : "/members"}
          className="rounded-lg border border-oms-surface-alt px-5 py-2.5 font-medium text-oms-text hover:bg-oms-surface-alt"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
