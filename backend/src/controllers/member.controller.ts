import { Request, Response } from "express";
import {
  listMembersQuerySchema,
  createMemberSchema,
  updateMemberSchema,
  updateMemberStatusSchema,
} from "../validators/member.validators";
import * as memberService from "../services/member.service";

// Express 5 types route params loosely; with noUncheckedIndexedAccess
// they can be string | string[] | undefined. Route patterns guarantee a
// single string, so normalize once here.
function paramId(req: Request): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
}

export async function listMembersHandler(req: Request, res: Response) {
  const parsed = listMembersQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query", details: parsed.error.flatten().fieldErrors });
  }

  const result = await memberService.listMembers(parsed.data);
  return res.status(200).json(result);
}

export async function getMemberHandler(req: Request, res: Response) {
  try {
    const member = await memberService.getMemberById(paramId(req));
    return res.status(200).json({ member });
  } catch (err) {
    if (err instanceof memberService.MemberNotFoundError) {
      return res.status(404).json({ error: "Member not found" });
    }
    throw err;
  }
}

export async function createMemberHandler(req: Request, res: Response) {
  const parsed = createMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
  }

  // An OFFICER may create OFFICER/MEMBER accounts but never ADMIN
  // ones. Enforced server-side regardless of what the request body
  // (or a tampered frontend) claims.
  if (req.user!.role === "OFFICER" && parsed.data.role === "ADMIN") {
    return res.status(403).json({ error: "Officers cannot create admin accounts." });
  }

  try {
    const member = await memberService.createMember(parsed.data);
    return res.status(201).json({ member });
  } catch (err) {
    if (err instanceof memberService.DuplicateEmailError) {
      return res.status(409).json({ error: "A member with that email already exists." });
    }
    throw err;
  }
}

export async function updateMemberHandler(req: Request, res: Response) {
  const parsed = updateMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
  }

  const actor = req.user!;
  const targetId = paramId(req);

  if (parsed.data.role !== undefined) {
    // Never allow anyone to change their own role — the only path to
    // privilege escalation this endpoint would otherwise have.
    if (actor.id === targetId) {
      return res.status(403).json({ error: "You cannot change your own role." });
    }

    if (actor.role === "OFFICER") {
      let target;
      try {
        target = await memberService.getMemberById(targetId);
      } catch (err) {
        if (err instanceof memberService.MemberNotFoundError) {
          return res.status(404).json({ error: "Member not found" });
        }
        throw err;
      }

      if (parsed.data.role === "ADMIN") {
        return res.status(403).json({ error: "Officers cannot grant admin privileges." });
      }
      if (target.role === "ADMIN") {
        return res.status(403).json({ error: "Officers cannot modify admin accounts." });
      }
    }
  }

  try {
    const member = await memberService.updateMember(targetId, parsed.data);
    return res.status(200).json({ member });
  } catch (err) {
    if (err instanceof memberService.DuplicateEmailError) {
      return res.status(409).json({ error: "A member with that email already exists." });
    }
    if (err instanceof memberService.MemberNotFoundError) {
      return res.status(404).json({ error: "Member not found" });
    }
    throw err;
  }
}

export async function updateMemberStatusHandler(req: Request, res: Response) {
  const parsed = updateMemberStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
  }

  const actor = req.user!;
  const targetId = paramId(req);

  // Prevent an admin from locking themselves out by deactivating
  // their own account.
  if (parsed.data.status === "INACTIVE" && actor.id === targetId) {
    return res.status(403).json({ error: "You cannot deactivate your own account." });
  }

  try {
    const member = await memberService.updateMemberStatus(targetId, parsed.data.status);
    return res.status(200).json({ member });
  } catch (err) {
    if (err instanceof memberService.MemberNotFoundError) {
      return res.status(404).json({ error: "Member not found" });
    }
    throw err;
  }
}
