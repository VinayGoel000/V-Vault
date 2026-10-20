import { randomUUID } from "node:crypto";
import type { Card } from "../../../../db";
import { HttpError } from "../../middleware/error-handler";
import { appendActivity, isActive, UnlockedService, nowIso } from "../base.service";

export interface CardSummary extends Card {
  accountCount: number;
}

export class CardsService extends UnlockedService {
  public async create(name: string): Promise<Card> {
    return this.withVault(async (vault, key) => {
      const timestamp = nowIso();
      const card: Card = {
        id: randomUUID(),
        name,
        deletedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      vault.cards.push(card);
      appendActivity(vault, key, {
        type: "card_created",
        at: timestamp,
        entityType: "card",
        entityId: card.id,
        entityLabel: card.name,
      });
      await this.repository.save(vault, key);
      return card;
    });
  }

  public async list(): Promise<CardSummary[]> {
    return this.withVault((vault) =>
      vault.cards.filter(isActive).map((card) => ({
        ...card,
        accountCount: vault.accounts.filter(
          (account) => account.cardId === card.id && isActive(account),
        ).length,
      })),
    );
  }

  public async rename(id: string, name: string): Promise<Card> {
    return this.withVault(async (vault, key) => {
      const card = vault.cards.find(
        (candidate) => candidate.id === id && isActive(candidate),
      );
      if (card === undefined) {
        throw new HttpError(404, "Card not found");
      }

      card.name = name;
      card.updatedAt = nowIso();
      appendActivity(vault, key, {
        type: "card_renamed",
        at: card.updatedAt,
        entityType: "card",
        entityId: card.id,
        entityLabel: card.name,
      });
      await this.repository.save(vault, key);
      return card;
    });
  }

  public async remove(id: string): Promise<void> {
    return this.withVault(async (vault, key) => {
      const cardIndex = vault.cards.findIndex(
        (card) => card.id === id && isActive(card),
      );
      if (cardIndex < 0) {
        throw new HttpError(404, "Card not found");
      }

      const deletedAt = nowIso();
      const card = vault.cards[cardIndex];
      if (card === undefined) {
        throw new HttpError(404, "Card not found");
      }
      card.deletedAt = deletedAt;
      card.updatedAt = deletedAt;
      for (const account of vault.accounts) {
        if (account.cardId === id && isActive(account)) {
          account.deletedAt = deletedAt;
          account.updatedAt = deletedAt;
          appendActivity(vault, key, {
            type: "account_deleted",
            at: deletedAt,
            entityType: "account",
            entityId: account.id,
            entityLabel: account.email,
          });
        }
      }

      appendActivity(vault, key, {
        type: "card_deleted",
        at: deletedAt,
        entityType: "card",
        entityId: id,
        entityLabel: card.name,
      });
      await this.repository.save(vault, key);
    });
  }

  public async restore(id: string): Promise<Card> {
    return this.withVault(async (vault, key) => {
      const card = vault.cards.find((candidate) => candidate.id === id);
      if (card === undefined || isActive(card)) {
        throw new HttpError(404, "Deleted card not found");
      }

      const deletedAt = card.deletedAt;
      card.deletedAt = null;
      card.updatedAt = nowIso();
      for (const account of vault.accounts) {
        if (account.cardId === id && account.deletedAt === deletedAt) {
          account.deletedAt = null;
          account.updatedAt = card.updatedAt;
        }
      }
      appendActivity(vault, key, {
        type: "card_restored",
        at: card.updatedAt,
        entityType: "card",
        entityId: id,
        entityLabel: card.name,
      });
      await this.repository.save(vault, key);
      return card;
    });
  }

  public async permanentlyDelete(id: string): Promise<void> {
    return this.withVault(async (vault, key) => {
      const cardIndex = vault.cards.findIndex(
        (card) => card.id === id && !isActive(card),
      );
      if (cardIndex < 0) {
        throw new HttpError(404, "Deleted card not found");
      }
      const card = vault.cards[cardIndex];
      const removedAccounts = vault.accounts.filter((account) => account.cardId === id);
      vault.cards.splice(cardIndex, 1);
      vault.accounts = vault.accounts.filter((account) => account.cardId !== id);
      for (const account of removedAccounts) {
        appendActivity(vault, key, {
          type: "account_permanently_deleted",
          at: nowIso(),
          entityType: "account",
          entityId: account.id,
          entityLabel: account.email,
        });
      }
      appendActivity(vault, key, {
        type: "card_permanently_deleted",
        at: nowIso(),
        entityType: "card",
        entityId: id,
        entityLabel: card?.name ?? id,
      });
      await this.repository.save(vault, key);
    });
  }
}
