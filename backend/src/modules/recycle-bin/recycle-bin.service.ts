import type { Account, Card } from "../../../../db";
import { isActive, UnlockedService } from "../base.service";

export type RecycleBinAccount = Omit<
  Account,
  "password" | "history" | "leakCheckCache" | "customFields" | "deletedAt"
> & {
  deletedAt: string;
  daysLeft: number;
  customFields: Array<{
    id: string;
    key: string;
    value: string;
    isSecret: boolean;
  }>;
};

export type RecycleBinCard = Omit<Card, "deletedAt"> & {
  deletedAt: string;
  daysLeft: number;
};

function daysLeft(deletedAt: string): number {
  const elapsed = Math.floor((Date.now() - Date.parse(deletedAt)) / (24 * 60 * 60 * 1000));
  return Math.max(0, 30 - elapsed);
}

function toDeletedAccount(account: Account): RecycleBinAccount {
  const {
    password: _password,
    history: _history,
    leakCheckCache: _leakCheckCache,
    customFields,
    ...summary
  } = account;
  return {
    ...summary,
    deletedAt: account.deletedAt as string,
    daysLeft: daysLeft(account.deletedAt as string),
    customFields: customFields.map((field) => ({
      id: field.id,
      key: field.key,
      value: field.isSecret ? "********" : field.value,
      isSecret: field.isSecret,
    })),
  } as RecycleBinAccount;
}

export class RecycleBinService extends UnlockedService {
  public async list(): Promise<{
    cards: RecycleBinCard[];
    accounts: RecycleBinAccount[];
  }> {
    return this.withVault((vault) => ({
      cards: vault.cards
        .filter((card) => !isActive(card))
        .map((card) => ({
          ...card,
          deletedAt: card.deletedAt as string,
          daysLeft: daysLeft(card.deletedAt as string),
        })),
      accounts: vault.accounts
        .filter((account) => !isActive(account))
        .map(toDeletedAccount),
    }));
  }
}
