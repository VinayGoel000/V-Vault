import { randomUUID } from "node:crypto";
import type { Card } from "../../../../db";
import { HttpError } from "../../middleware/error-handler";
import { UnlockedService, nowIso } from "../base.service";

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
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      vault.cards.push(card);
      await this.repository.save(vault, key);
      return card;
    });
  }

  public async list(): Promise<CardSummary[]> {
    return this.withVault((vault) =>
      vault.cards.map((card) => ({
        ...card,
        accountCount: vault.accounts.filter(
          (account) => account.cardId === card.id,
        ).length,
      })),
    );
  }

  public async rename(id: string, name: string): Promise<Card> {
    return this.withVault(async (vault, key) => {
      const card = vault.cards.find((candidate) => candidate.id === id);
      if (card === undefined) {
        throw new HttpError(404, "Card not found");
      }

      card.name = name;
      card.updatedAt = nowIso();
      await this.repository.save(vault, key);
      return card;
    });
  }

  public async remove(id: string): Promise<void> {
    return this.withVault(async (vault, key) => {
      const cardIndex = vault.cards.findIndex((card) => card.id === id);
      if (cardIndex < 0) {
        throw new HttpError(404, "Card not found");
      }

      vault.cards.splice(cardIndex, 1);
      for (let index = vault.accounts.length - 1; index >= 0; index -= 1) {
        if (vault.accounts[index]?.cardId === id) {
          vault.accounts.splice(index, 1);
        }
      }

      await this.repository.save(vault, key);
    });
  }
}
