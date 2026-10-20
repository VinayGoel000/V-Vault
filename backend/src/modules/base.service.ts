import type { Vault } from "../../../db";
import type { InMemorySession } from "../auth/session";
import { HttpError } from "../middleware/error-handler";
import { VaultRepository } from "../repositories/vault.repository";
import { appendActivity } from "./activity/activity.util";

export { appendActivity } from "./activity/activity.util";

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

export function isActive(value: { deletedAt?: string | null }): boolean {
  return value.deletedAt == null;
}

export function purgeExpiredDeletedItems(
  vault: Vault,
  now = Date.now(),
  retentionMs = 30 * 24 * 60 * 60 * 1000,
): { cards: number; accounts: number } {
  const cutoff = now - retentionMs;
  const expired = (deletedAt: string | null | undefined): boolean =>
    deletedAt != null && Date.parse(deletedAt) <= cutoff;

  const expiredCardIds = new Set(
    vault.cards
      .filter((card) => expired(card.deletedAt))
      .map((card) => card.id),
  );
  const remainingCards = vault.cards.filter(
    (card) => !expiredCardIds.has(card.id),
  );
  const remainingAccounts = vault.accounts.filter(
    (account) =>
      !expired(account.deletedAt) && !expiredCardIds.has(account.cardId),
  );

  const purgedCards = vault.cards.length - remainingCards.length;
  const purgedAccounts = vault.accounts.length - remainingAccounts.length;
  vault.cards = remainingCards;
  vault.accounts = remainingAccounts;
  return { cards: purgedCards, accounts: purgedAccounts };
}
