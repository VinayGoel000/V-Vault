import type { Vault } from "../../../db";
import type { InMemorySession } from "../auth/session";
import { HttpError } from "../middleware/error-handler";
import { VaultRepository } from "../repositories/vault.repository";

/** Shared key lifecycle for every unlocked data operation. */
export abstract class UnlockedService {
  public constructor(
    protected readonly repository: VaultRepository,
    protected readonly session: InMemorySession,
  ) {}

  protected async withVault<T>(
    operation: (vault: Vault, key: Buffer) => Promise<T> | T,
  ): Promise<T> {
    return this.repository.withExclusive(async () => {
      const key = this.session.getKey();
      if (key === null) {
        throw new HttpError(423, "Vault is locked");
      }

      try {
        const vault = await this.repository.load(key);
        return await operation(vault, key);
      } finally {
        key.fill(0);
      }
    });
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
