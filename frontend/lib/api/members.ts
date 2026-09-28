import { ApiError } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type Role = "ADMIN" | "OFFICER" | "MEMBER";
export type AccountStatus = "ACTIVE" | "INACTIVE";

export type Member = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
};

export type MemberListParams = {
  search?: string;
  role?: Role | "";
  status?: AccountStatus | "";
  page?: number;
  pageSize?: number;
};

export type MemberListResult = {
  members: Member[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-Requested-With": "oms-frontend", ...options.headers },
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body
  }

  if (!res.ok) {
    const b = body as { error?: string; details?: Record<string, string[]> } | null;
    throw new ApiError(res.status, b?.error ?? "Something went wrong. Please try again.", b?.details);
  }
  return body as T;
}

export function listMembers(params: MemberListParams) {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.role) q.set("role", params.role);
  if (params.status) q.set("status", params.status);
  q.set("page", String(params.page ?? 1));
  q.set("pageSize", String(params.pageSize ?? 20));
  return apiFetch<MemberListResult>(`/api/members?${q.toString()}`);
}

export function getMember(id: string) {
  return apiFetch<{ member: Member }>(`/api/members/${encodeURIComponent(id)}`);
}

export function createMember(data: { fullName: string; email: string; role: Role }) {
  return apiFetch<{ member: Member }>("/api/members", { method: "POST", body: JSON.stringify(data) });
}

export function updateMember(id: string, data: Partial<{ fullName: string; email: string; role: Role }>) {
  return apiFetch<{ member: Member }>(`/api/members/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function updateMemberStatus(id: string, status: AccountStatus) {
  return apiFetch<{ member: Member }>(`/api/members/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
