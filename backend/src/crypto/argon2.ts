import argon2 from "argon2";
import { randomBytes } from "node:crypto";

const ARGON2_MEMORY_COST_KIB = 19_456;
const ARGON2_TIME_COST = 2;
const ARGON2_PARALLELISM = 1;
const KEY_LENGTH_BYTES = 32;
const SALT_LENGTH_BYTES = 16;

const argon2Options = {
  type: argon2.argon2id,
  memoryCost: ARGON2_MEMORY_COST_KIB,
  timeCost: ARGON2_TIME_COST,
  parallelism: ARGON2_PARALLELISM,
};

export function createSalt(): Buffer {
  return randomBytes(SALT_LENGTH_BYTES);
}

export async function createVerificationHash(
  masterPassword: string,
  salt: Buffer,
): Promise<string> {
  return argon2.hash(masterPassword, {
    ...argon2Options,
    salt,
  });
}

export async function verifyMasterPassword(
  masterPassword: string,
  verificationHash: string,
): Promise<boolean> {
  try {
    return await argon2.verify(verificationHash, masterPassword, {
    });
  } catch {
    return false;
  }
}

/** Derive the 32-byte AES key from the stored salt. */
export async function deriveVaultKey(
  masterPassword: string,
  salt: Buffer,
): Promise<Buffer> {
  return argon2.hash(masterPassword, {
    ...argon2Options,
    salt,
    raw: true,
    hashLength: KEY_LENGTH_BYTES,
  });
}
