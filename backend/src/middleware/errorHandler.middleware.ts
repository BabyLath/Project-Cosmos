import { Request, Response, NextFunction } from "express";
import { isProduction } from "../config/env";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Express 5 forwards rejected async handlers here automatically, so
// controllers don't need try/catch + next(err) boilerplate around
// every await.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error(err);

  // Never leak stack traces or raw error messages to the client in
  // production — they can reveal internal file paths, query
  // structure, or library versions.
  const message = isProduction ? "Something went wrong. Please try again." : (err as Error)?.message ?? "Unknown error";
  return res.status(500).json({ error: message });
}
