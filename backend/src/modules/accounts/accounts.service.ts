import { randomUUID } from "node:crypto";
import type {
  Account,
  CustomField,
  CustomFieldRequest,
} from "../../../../db";
import { encryptAesGcm, decryptAesGcm } from "../../crypto/aes-gcm";
import { HttpError } from "../../middleware/error-handler";
import {
  appendActivity,
  isActive,
  UnlockedService,
  nowIso,
} from "../base.service";

export interface CustomFieldResponse {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
}

export type AccountSummary = Omit<
  Account,
  "password" | "history" | "customFields" | "leakCheckCache"
> & { customFields: CustomFieldResponse[] };

export type AccountDetails = AccountSummary & { password: string };

function toSummary(account: Account): AccountSummary {
  const {
    password: _password,
    history: _history,
    leakCheckCache: _leakCheckCache,
    customFields,
    ...summary
  } = account;
  return {
    ...summary,
    customFields: customFields.map((field) => ({
      id: field.id,
      key: field.key,
      value: field.isSecret ? "********" : field.value,
      isSecret: field.isSecret,
    })),
  } as AccountSummary;
}

function encryptCustomFields(fields: CustomFieldRequest[], key: Buffer): CustomField[] {
  return fields.map((field) =>
    field.isSecret
      ? {
          id: field.id ?? randomUUID(),
          key: field.key,
          value: encryptAesGcm(field.value, key),
          isSecret: true,
        }
      : {
          id: field.id ?? randomUUID(),
          key: field.key,
          value: field.value,
          isSecret: false,
        },
  );
}

function decryptCustomFields(
  fields: CustomField[],
  key: Buffer,
): CustomFieldResponse[] {
  return fields.map((field) => {
    if (!field.isSecret) {
      return { id: field.id, key: field.key, value: field.value, isSecret: false };
    }
    const plaintext = decryptAesGcm(field.value, key);
    try {
      return {
        id: field.id,
        key: field.key,
        value: plaintext.toString("utf8"),
        isSecret: true,
      };
    } finally {
      plaintext.fill(0);
    }
  });
}

export class AccountsService extends UnlockedService {
  public async create(
    cardId: string,
    data: {
      email: string;
      username?: string;
      password: string;
      websiteUrl?: string;
      notes?: string;
      customFields?: CustomFieldRequest[];
    },
  ): Promise<AccountSummary> {
    return this.withVault(async (vault, key) => {
      if (!vault.cards.some((card) => card.id === cardId && isActive(card))) {
        throw new HttpError(404, "Card not found");
      }

      const timestamp = nowIso();
      const account: Account = {
        id: randomUUID(),
        cardId,
        email: data.email,
        username: data.username,
        websiteUrl: data.websiteUrl,
        password: encryptAesGcm(data.password, key),
        notes: data.notes,
        customFields: encryptCustomFields(data.customFields ?? [], key),
        history: [],
        deletedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      vault.accounts.push(account);
      appendActivity(vault, key, {
        type: "account_created",
        at: timestamp,
        entityType: "account",
        entityId: account.id,
        entityLabel: account.email,
      });
      await this.repository.save(vault, key);
      return toSummary(account);
    });
  }

  public async listByCard(cardId: string): Promise<AccountSummary[]> {
    return this.withVault((vault) => {
       if (!vault.cards.some((card) => card.id === cardId && isActive(card))) {
        throw new HttpError(404, "Card not found");
      }
      return vault.accounts
        .filter((account) => account.cardId === cardId && isActive(account))
        .map(toSummary);
    });
  }

  public async get(id: string): Promise<AccountDetails> {
    return this.withVault((vault, key) => {
      const account = this.getAccount(vault.accounts, id);
      const plaintextBuffer = decryptAesGcm(account.password, key);
      const plaintext = plaintextBuffer.toString("utf8");
      plaintextBuffer.fill(0);
      return {
        ...toSummary(account),
        customFields: decryptCustomFields(account.customFields, key),
        password: plaintext,
      };
    });
  }

  public async update(
    id: string,
    data: {
      email?: string;
      username?: string;
      websiteUrl?: string | null;
      notes?: string | null;
      customFields?: CustomFieldRequest[];
    },
  ): Promise<AccountSummary> {
    return this.withVault(async (vault, key) => {
      const account = this.getAccount(vault.accounts, id);
      if (data.email !== undefined) account.email = data.email;
      if (data.username !== undefined) account.username = data.username;
      if (data.websiteUrl === null) {
        delete account.websiteUrl;
      } else if (data.websiteUrl !== undefined) {
        account.websiteUrl = data.websiteUrl;
      }
      if (data.notes === null) {
        delete account.notes;
      } else if (data.notes !== undefined) {
        account.notes = data.notes;
      }
      if (data.customFields !== undefined) {
        account.customFields = encryptCustomFields(data.customFields, key);
      }
      account.updatedAt = nowIso();
      appendActivity(vault, key, {
        type: "account_updated",
        at: account.updatedAt,
        entityType: "account",
        entityId: account.id,
        entityLabel: account.email,
      });
      await this.repository.save(vault, key);
      return toSummary(account);
    });
  }

  public async remove(id: string): Promise<void> {
    return this.withVault(async (vault, key) => {
      const accountIndex = vault.accounts.findIndex(
        (account) => account.id === id && isActive(account),
      );
      if (accountIndex < 0) {
        throw new HttpError(404, "Account not found");
      }
      const account = vault.accounts[accountIndex];
      if (account === undefined) {
        throw new HttpError(404, "Account not found");
      }
      const deletedAt = nowIso();
      account.deletedAt = deletedAt;
      account.updatedAt = deletedAt;
      appendActivity(vault, key, {
        type: "account_deleted",
        at: deletedAt,
        entityType: "account",
        entityId: id,
        entityLabel: account.email,
      });
      await this.repository.save(vault, key);
    });
  }

  public async restore(id: string): Promise<AccountSummary> {
    return this.withVault(async (vault, key) => {
      const account = vault.accounts.find((candidate) => candidate.id === id);
      if (account === undefined || isActive(account)) {
        throw new HttpError(404, "Deleted account not found");
      }
      const card = vault.cards.find((candidate) => candidate.id === account.cardId);
      if (card !== undefined && !isActive(card)) {
        throw new HttpError(409, "Restore the deleted card first");
      }
      account.deletedAt = null;
      account.updatedAt = nowIso();
      appendActivity(vault, key, {
        type: "account_restored",
        at: account.updatedAt,
        entityType: "account",
        entityId: id,
        entityLabel: account.email,
      });
      await this.repository.save(vault, key);
      return toSummary(account);
    });
  }

  public async permanentlyDelete(id: string): Promise<void> {
    return this.withVault(async (vault, key) => {
      const accountIndex = vault.accounts.findIndex(
        (account) => account.id === id && !isActive(account),
      );
      if (accountIndex < 0) {
        throw new HttpError(404, "Deleted account not found");
      }
      const account = vault.accounts[accountIndex];
      if (account === undefined) {
        throw new HttpError(404, "Deleted account not found");
      }
      vault.accounts.splice(accountIndex, 1);
      appendActivity(vault, key, {
        type: "account_permanently_deleted",
        at: nowIso(),
        entityType: "account",
        entityId: id,
        entityLabel: account.email,
      });
      await this.repository.save(vault, key);
    });
  }

  public getAccount(
    accounts: Account[],
    id: string,
    includeDeleted = false,
  ): Account {
    const account = accounts.find(
      (candidate) =>
        candidate.id === id && (includeDeleted || isActive(candidate)),
    );
    if (account === undefined) {
      throw new HttpError(404, "Account not found");
    }
    return account;
  }
}
