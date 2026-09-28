"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listMembers, type AccountStatus, type Member, type MemberListResult, type Role } from "@/lib/api/members";
import { ApiError } from "@/lib/api/auth";
import { canEditMember, canManageMembers } from "@/lib/permissions";
import { RoleBadge, StatusBadge } from "./Badges";

const inputClass =
  "rounded-lg border border-oms-surface-alt bg-oms-surface-alt px-3 py-2 text-sm text-oms-text placeholder:text-oms-text-muted focus:outline-none focus:ring-2 focus:ring-oms-accent";

export function MembersTable({ currentUser }: { currentUser: { id: string; role: Role } }) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [status, setStatus] = useState<AccountStatus | "">("");
  const [page, setPage] = useState(1);

  // Results are tagged with the query that produced them, so "loading"
  // is derived (no setState inside the effect body).
  const queryKey = JSON.stringify({ search, role, status, page });
  const [result, setResult] = useState<{ key: string; data?: MemberListResult; error?: string } | null>(null);
  const loading = result?.key !== queryKey;
  const data = result?.data ?? null;
  const error = result?.key === queryKey ? (result.error ?? null) : null;

  // Debounce typing so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    listMembers({ search, role, status, page })
      .then((data) => !cancelled && setResult({ key: queryKey, data }))
      .catch((err) => {
        if (!cancelled) {
          setResult({ key: queryKey, error: err instanceof ApiError ? err.message : "Couldn't reach the server." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [search, role, status, page, queryKey]);

  const members: Member[] = data?.members ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Search members"
          placeholder="Search name or email"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className={`${inputClass} w-full sm:w-64`}
        />
        <select
          aria-label="Filter by role"
          value={role}
          onChange={(e) => {
            setRole(e.target.value as Role | "");
            setPage(1);
          }}
          className={inputClass}
        >
          <option value="">All roles</option>
          <option value="ADMIN">Admin</option>
          <option value="OFFICER">Officer</option>
          <option value="MEMBER">Member</option>
        </select>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as AccountStatus | "");
            setPage(1);
          }}
          className={inputClass}
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        {canManageMembers(currentUser.role) && (
          <Link
            href="/members/new"
            className="ml-auto rounded-lg bg-oms-accent px-4 py-2 text-sm font-medium text-oms-bg transition hover:bg-oms-accent-hover"
          >
            Add member
          </Link>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-oms-danger/40 bg-oms-danger/10 px-4 py-3 text-sm text-oms-danger">
          {error}
        </div>
      )}

      {!error && loading && <p className="py-8 text-center text-sm text-oms-text-muted">Loading members…</p>}

      {!error && !loading && members.length === 0 && (
        <p className="py-8 text-center text-sm text-oms-text-muted">No members match your filters.</p>
      )}

      {!error && members.length > 0 && (
        <div className={`overflow-x-auto rounded-xl border border-oms-surface-alt bg-oms-surface ${loading ? "opacity-60" : ""}`}>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-oms-surface-alt text-oms-text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-oms-surface-alt last:border-0">
                  <td className="px-4 py-3">{m.fullName}</td>
                  <td className="px-4 py-3 text-oms-text-muted">{m.email}</td>
                  <td className="px-4 py-3"><RoleBadge role={m.role} /></td>
                  <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                  <td className="px-4 py-3 text-oms-text-muted">{new Date(m.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <Link href={`/members/${m.id}`} className="text-oms-accent hover:text-oms-accent-hover">
                        View
                      </Link>
                      {canEditMember(currentUser, m) && (
                        <Link href={`/members/${m.id}/edit`} className="text-oms-accent hover:text-oms-accent-hover">
                          Edit
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-oms-text-muted">
          <span>
            Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} members)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-oms-surface-alt px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.pagination.totalPages}
              className="rounded-lg border border-oms-surface-alt px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
