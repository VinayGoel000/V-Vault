import { randomUUID } from "node:crypto";
import type { Account } from "../../../../db";
import { encryptAesGcm, decryptAesGcm } from "../../crypto/aes-gcm";
import { HttpError } from "../../middleware/error-handler";
import { UnlockedService, nowIso } from "../base.service";

export type AccountSummary = Omit<Account, "password" | "history">;

function toSummary(account: Account): AccountSummary {
  const { password: _password, history: _history, ...summary } = account;
  return summary;
}

export class AccountsService extends UnlockedService {
  public async create(
    cardId: string,
    data: {
      email: string;
      username?: string;
      password: string;
      notes?: string;
    },
  ): Promise<AccountSummary> {
    return this.withVault(async (vault, key) => {
      if (!vault.cards.some((card) => card.id === cardId)) {
        throw new HttpError(404, "Card not found");
      }

      const timestamp = nowIso();
      const account: Account = {
        id: randomUUID(),
        cardId,
        email: data.email,
        username: data.username,
        password: encryptAesGcm(data.password, key),
        notes: data.notes,
        history: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      vault.accounts.push(account);
      await this.repository.save(vault, key);
      return toSummary(account);
    });
  }

  public async listByCard(cardId: string): Promise<AccountSummary[]> {
    return this.withVault((vault) => {
      if (!vault.cards.some((card) => card.id === cardId)) {
        throw new HttpError(404, "Card not found");
      }
      return vault.accounts
        .filter((account) => account.cardId === cardId)
        .map(toSummary);
    });
  }

  public async get(id: string): Promise<
    AccountSummary & { password: string }
  > {
    return this.withVault((vault, key) => {
      const account = this.getAccount(vault.accounts, id);
      const plaintextBuffer = decryptAesGcm(account.password, key);
      const plaintext = plaintextBuffer.toString("utf8");
      plaintextBuffer.fill(0);
      return { ...toSummary(account), password: plaintext };
    });
  }

  public async update(
    id: string,
    data: {
      email?: string;
      username?: string;
      notes?: string | null;
    },
  ): Promise<AccountSummary> {
    return this.withVault(async (vault, key) => {
      const account = this.getAccount(vault.accounts, id);
      if (data.email !== undefined) account.email = data.email;
      if (data.username !== undefined) account.username = data.username;
      if (data.notes === null) {
        delete account.notes;
      } else if (data.notes !== undefined) {
        account.notes = data.notes;
      }
      account.updatedAt = nowIso();
      await this.repository.save(vault, key);
      return toSummary(account);
    });
  }

  public async remove(id: string): Promise<void> {
    return this.withVault(async (vault, key) => {
      const accountIndex = vault.accounts.findIndex(
        (account) => account.id === id,
      );
      if (accountIndex < 0) {
        throw new HttpError(404, "Account not found");
      }
      vault.accounts.splice(accountIndex, 1);
      await this.repository.save(vault, key);
    });
  }

  public getAccount(accounts: Account[], id: string): Account {
    const account = accounts.find((candidate) => candidate.id === id);
    if (account === undefined) {
      throw new HttpError(404, "Account not found");
    }
    return account;
  }
}
