import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import type { EncryptedValue } from "../../../db";

const AES_ALGORITHM = "aes-256-gcm";
const AES_KEY_BYTES = 32;
const AES_IV_BYTES = 12;

function assertKey(key: Buffer): void {
  if (key.length !== AES_KEY_BYTES) {
    throw new Error("Invalid encryption key");
  }
}

/** Encrypt arbitrary data with a fresh AES-GCM nonce. */
export function encryptAesGcm(
  plaintext: string | Buffer,
  key: Buffer,
): EncryptedValue {
  assertKey(key);
  const iv = randomBytes(AES_IV_BYTES);
  const cipher = createCipheriv(AES_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);

  return {
    iv: iv.toString("base64").replace(/\n/g, ""),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

/** Decrypt and authenticate an AES-GCM value. */
export function decryptAesGcm(
  encrypted: EncryptedValue,
  key: Buffer,
): Buffer {
  assertKey(key);
  const iv = Buffer.from(encrypted.iv, "base64");
  const authTag = Buffer.from(encrypted.authTag, "base64");
  const ciphertext = Buffer.from(encrypted.ciphertext, "base64");
  const decipher = createDecipheriv(AES_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
