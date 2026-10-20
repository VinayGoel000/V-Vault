import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  VAULT_FILE_PATH,
  VaultFileSchema,
  VaultSchema,
  type Vault,
  type VaultFile,
  type VaultMetadata,
} from "../../../db";
import {
  decryptAesGcm,
  encryptAesGcm,
} from "../crypto/aes-gcm";
import {
  createSalt,
  createVerificationHash,
  deriveVaultKey,
} from "../crypto/argon2";

export class VaultAlreadyExistsError extends Error {
  public constructor() {
    super("Vault already exists");
    this.name = "VaultAlreadyExistsError";
  }
}

export class VaultNotFoundError extends Error {
  public constructor() {
    super("Vault not found");
    this.name = "VaultNotFoundError";
  }
}

export class VaultStorageError extends Error {
  public constructor() {
    super("Vault storage error");
    this.name = "VaultStorageError";
  }
}

const EMPTY_VAULT: Vault = {
  version: 1,
  cards: [],
  accounts: [],
  activityLog: [],
};

/** All filesystem access for the vault is kept in this repository. */
export class VaultRepository {
  private transactionTail: Promise<void> = Promise.resolve();

  public constructor(private readonly filePath: string = VAULT_FILE_PATH) {}

  public get path(): string {
    return this.filePath;
  }

  public async exists(): Promise<boolean> {
    try {
      await fs.access(this.filePath);
      return true;
    } catch (error: unknown) {
      if (isErrnoCode(error, "ENOENT")) {
        return false;
      }
      throw new VaultStorageError();
    }
  }

  /** Serialize read/decrypt/modify/encrypt/write transactions in this process. */
  public async withExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.transactionTail;
    let release!: () => void;
    this.transactionTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    try {
      return await operation();
    } finally {
      release();
    }
  }

  public async getMetadata(): Promise<VaultMetadata | null> {
    if (!(await this.exists())) {
      return null;
    }

    return (await this.readFile()).metadata;
  }

  public async create(masterPassword: string): Promise<void> {
    if (await this.exists()) {
      throw new VaultAlreadyExistsError();
    }

    const salt = createSalt();
    const verificationHash = await createVerificationHash(masterPassword, salt);
    const key = await deriveVaultKey(masterPassword, salt);

    try {
      const encryptedVault = encryptAesGcm(
        JSON.stringify(EMPTY_VAULT),
        key,
      );
      const file: VaultFile = {
        version: 1,
        metadata: {
          salt: salt.toString("base64"),
          verificationHash,
        },
        encryptedVault,
      };

      await this.writeNewFile(JSON.stringify(file));
    } finally {
      key.fill(0);
      salt.fill(0);
    }
  }

  public async load(key: Buffer): Promise<Vault> {
    const file = await this.readFile();
    const saltlessPayload = decryptAesGcm(file.encryptedVault, key);

    try {
      const parsed: unknown = JSON.parse(saltlessPayload.toString("utf8"));
      return VaultSchema.parse(parsed);
    } catch {
      throw new VaultStorageError();
    } finally {
      saltlessPayload.fill(0);
    }
  }

  public async save(vault: Vault, key: Buffer): Promise<void> {
    const validatedVault = VaultSchema.parse(vault);
    const existingFile = await this.readFile();
    const encryptedVault = encryptAesGcm(
      JSON.stringify(validatedVault),
      key,
    );
    const file: VaultFile = {
      ...existingFile,
      encryptedVault,
    };

    await this.writeAtomically(JSON.stringify(file));
  }

  private async readFile(): Promise<VaultFile> {
    let contents: string;
    try {
      contents = await fs.readFile(this.filePath, "utf8");
    } catch (error: unknown) {
      if (isErrnoCode(error, "ENOENT")) {
        throw new VaultNotFoundError();
      }
      throw new VaultStorageError();
    }

    try {
      return VaultFileSchema.parse(JSON.parse(contents));
    } catch {
      throw new VaultStorageError();
    }
  }

  private async writeNewFile(contents: string): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.writeFile(this.filePath, contents, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
    } catch (error: unknown) {
      if (isFileExistsError(error)) {
        throw new VaultAlreadyExistsError();
      }
      throw new VaultStorageError();
    }
  }

  private async writeAtomically(contents: string): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;

    try {
      await fs.writeFile(temporaryPath, contents, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      await fs.rename(temporaryPath, this.filePath);
    } catch {
      await fs.rm(temporaryPath, { force: true });
      throw new VaultStorageError();
    }
  }
}

function isFileExistsError(error: unknown): error is NodeJS.ErrnoException {
  return isErrnoCode(error, "EEXIST");
}

function isErrnoCode(
  error: unknown,
  code: string,
): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}
