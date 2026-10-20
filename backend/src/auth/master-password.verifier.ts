import { verifyMasterPassword } from "../crypto/argon2";
import type { VaultMetadata } from "../../../db";
import type { VaultRepository } from "../repositories/vault.repository";
import type { IUnlockVerifier } from "./verifier.interface";

/** Verifies only the supplied master password against the stored Argon2id hash. */
export class MasterPasswordVerifier implements IUnlockVerifier {
  public constructor(private readonly repository: VaultRepository) {}

  public async verify(credential: unknown): Promise<boolean> {
    if (typeof credential !== "string") {
      return false;
    }

    const metadata: VaultMetadata | null = await this.repository.getMetadata();
    if (metadata === null) {
      return false;
    }

    return verifyMasterPassword(credential, metadata.verificationHash);
  }
}
