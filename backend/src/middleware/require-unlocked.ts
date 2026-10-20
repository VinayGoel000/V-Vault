import type { RequestHandler } from "express";
import type { InMemorySession } from "../auth/session";

export function requireUnlocked(session: InMemorySession): RequestHandler {
  return (_request, response, next) => {
    if (!session.isUnlocked()) {
      response.status(423).json({ error: "Vault is locked" });
      return;
    }

    next();
  };
}
