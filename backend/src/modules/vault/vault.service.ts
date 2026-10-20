import { deriveVaultKey } from "../../crypto/argon2";
import { InMemorySession } from "../../auth/session";
import { HttpError } from "../../middleware/error-handler";
import {
  VaultAlreadyExistsError,
  VaultRepository,
} from "../../repositories/vault.repository";
import { MasterPasswordVerifier } from "../../auth/master-password.verifier";

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
      await this.repository.load(key);
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

  public lock(): void {
    this.session.lock();
  }
}
