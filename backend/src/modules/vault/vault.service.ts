import { deriveVaultKey } from "../../crypto/argon2";
import { InMemorySession } from "../../auth/session";
import { HttpError } from "../../middleware/error-handler";
import {
  VaultAlreadyExistsError,
  VaultRepository,
} from "../../repositories/vault.repository";
import { MasterPasswordVerifier } from "../../auth/master-password.verifier";
import { appendActivity, nowIso, purgeExpiredDeletedItems } from "../base.service";

export class VaultService {
  private readonly verifier: MasterPasswordVerifier;

  public constructor(
    private readonly repository: VaultRepository,
    private readonly session: InMemorySession,
  ) {
    this.verifier = new MasterPasswordVerifier(repository);
  }

  public async setup(masterPassword: string): Promise<void> {
    try {
      await this.repository.create(masterPassword);
      const metadata = await this.repository.getMetadata();
      if (metadata === null) {
        throw new HttpError(500, "Vault setup failed");
      }
      const salt = Buffer.from(metadata.salt, "base64");
      const key = await deriveVaultKey(masterPassword, salt);
      try {
        const vault = await this.repository.load(key);
        appendActivity(vault, key, {
          type: "vault_setup",
          entityType: "vault",
          entityLabel: "V-Vault",
          at: nowIso(),
        });
        await this.repository.save(vault, key);
      } finally {
        key.fill(0);
        salt.fill(0);
      }
    } catch (error: unknown) {
      if (error instanceof VaultAlreadyExistsError) {
        throw new HttpError(409, "Vault is already set up");
      }
      throw error;
    }
  }

  public async unlock(masterPassword: string): Promise<void> {
    if (!(await this.repository.exists())) {
      throw new HttpError(404, "Vault is not set up");
    }

    const valid = await this.verifier.verify(masterPassword);
    if (!valid) {
      throw new HttpError(401, "Invalid master password");
    }

    const metadata = await this.repository.getMetadata();
    if (metadata === null) {
      throw new HttpError(404, "Vault is not set up");
    }

    const salt = Buffer.from(metadata.salt, "base64");
    const key = await deriveVaultKey(masterPassword, salt);
    try {
       // Authenticate the encrypted payload before making the session active.
       const vault = await this.repository.load(key);
       const purged = purgeExpiredDeletedItems(vault);
       appendActivity(vault, key, {
          type: "vault_unlocked",
          at: nowIso(),
          entityType: "vault",
          entityLabel: "V-Vault",
         details: {
           purgedCards: purged.cards,
           purgedAccounts: purged.accounts,
         },
       });
       await this.repository.save(vault, key);
       this.session.unlock(key);
    } finally {
      key.fill(0);
      salt.fill(0);
    }
  }

  public async getStatus(): Promise<{
    isSetup: boolean;
    isUnlocked: boolean;
  }> {
    return {
      isSetup: await this.repository.exists(),
      isUnlocked: this.session.isUnlocked(),
    };
  }

  public async lock(): Promise<void> {
    try {
      if (this.session.isUnlocked()) {
        await this.repository.withExclusive(async () => {
          const key = this.session.getKey();
          if (key === null) {
            return;
          }
          try {
            const vault = await this.repository.load(key);
            appendActivity(vault, key, {
              type: "vault_locked",
              at: nowIso(),
              entityType: "vault",
              entityLabel: "V-Vault",
            });
            await this.repository.save(vault, key);
          } finally {
            key.fill(0);
          }
        });
      }
    } finally {
      this.session.lock();
    }
  }
}
