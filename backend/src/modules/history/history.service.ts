import type { PasswordHistoryEntry } from "../../../../db";
import { decryptAesGcm, encryptAesGcm } from "../../crypto/aes-gcm";
import { HttpError } from "../../middleware/error-handler";
import { appendActivity, isActive, UnlockedService, nowIso } from "../base.service";

export interface HistoryResult {
  password: string;
  changedAt: string;
}

export class HistoryService extends UnlockedService {
  public async changePassword(
    accountId: string,
    newPassword: string,
  ): Promise<void> {
    return this.withVault(async (vault, key) => {
       const account = vault.accounts.find(
         (candidate) => candidate.id === accountId && isActive(candidate),
       );
      if (account === undefined) {
        throw new HttpError(404, "Account not found");
      }

      const historyEntry: PasswordHistoryEntry = {
        password: account.password,
        changedAt: nowIso(),
      };
       account.history.push(historyEntry);
       account.password = encryptAesGcm(newPassword, key);
       delete account.leakCheckCache;
       account.updatedAt = nowIso();
       appendActivity(vault, key, {
         type: "password_changed",
         at: account.updatedAt,
        entityType: "account",
        entityId: account.id,
        entityLabel: account.email,
       });
       await this.repository.save(vault, key);
    });
  }

  public async list(accountId: string): Promise<HistoryResult[]> {
    return this.withVault((vault, key) => {
       const account = vault.accounts.find(
         (candidate) => candidate.id === accountId && isActive(candidate),
       );
      if (account === undefined) {
        throw new HttpError(404, "Account not found");
      }

      return [...account.history].reverse().map((entry) => {
        const plaintextBuffer = decryptAesGcm(entry.password, key);
        const password = plaintextBuffer.toString("utf8");
        plaintextBuffer.fill(0);
        return { password, changedAt: entry.changedAt };
      });
    });
  }
}
