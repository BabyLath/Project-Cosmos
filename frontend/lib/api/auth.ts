const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  role: "ADMIN" | "OFFICER" | "MEMBER";
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public fieldErrors?: Record<string, string[]>) {
    super(message);
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include", // send/receive the httpOnly session cookie
    headers: {
      "Content-Type": "application/json",
      // Matches requireCsrfHeader on the backend: a cross-site form
      // post can't set this header, so its presence proves the
      // request came from this app's own JS.
      "X-Requested-With": "oms-frontend",
      ...options.headers,
    },
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // no JSON body (e.g. network failure before a response arrived)
  }

  if (!res.ok) {
    const b = body as { error?: string; details?: Record<string, string[]> } | null;
    throw new ApiError(res.status, b?.error ?? "Something went wrong. Please try again.", b?.details);
  }

  return body as T;
}

export function login(email: string, password: string, rememberMe: boolean) {
  return apiFetch<{ user: SessionUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, rememberMe }),
  });
}

export function logout() {
  return apiFetch<{ success: true }>("/api/auth/logout", { method: "POST" });
}

export function getCurrentUser() {
  return apiFetch<{ user: SessionUser }>("/api/auth/me");
}

export function forgotPassword(email: string) {
  return apiFetch<{ message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, password: string, confirmPassword: string) {
  return apiFetch<{ message: string }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password, confirmPassword }),
  });
}
