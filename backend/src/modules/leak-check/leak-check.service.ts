import { createHash } from "node:crypto";
import type { Account } from "../../../../db";
import { decryptAesGcm, encryptAesGcm } from "../../crypto/aes-gcm";
import { HttpError } from "../../middleware/error-handler";
import { appendActivity, isActive, UnlockedService, nowIso } from "../base.service";

const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const HIBP_TIMEOUT_MS = 10_000;

export type LeakStatus = "leaked" | "safe" | "unknown";

export interface LeakCheckResult {
  accountId: string;
  status: LeakStatus;
  count: number | null;
  checkedAt: string;
  cached: boolean;
}

interface CachedLeakResult {
  passwordHash: string;
  status: "leaked" | "safe";
  count: number;
  checkedAt: string;
}

type FetchLike = typeof fetch;

const defaultFetch: FetchLike = (input, init) => globalThis.fetch(input, init);

function sha1(value: string): string {
  return createHash("sha1").update(value, "utf8").digest("hex").toUpperCase();
}

async function queryHibp(
  passwordHash: string,
  fetchImpl: FetchLike,
): Promise<{ status: "leaked" | "safe"; count: number }> {
  const prefix = passwordHash.slice(0, 5);
  const suffix = passwordHash.slice(5);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${HIBP_RANGE_URL}${prefix}`, {
      method: "GET",
      headers: { "User-Agent": "V-Vault leak checker" },
      signal: controller.signal,
    });
    if (response.status === 404) {
      return { status: "safe", count: 0 };
    }
    if (!response.ok) {
      throw new Error("HIBP request failed");
    }
    const body = await response.text();
    for (const line of body.split(/\r?\n/)) {
      const separator = line.indexOf(":");
      if (separator < 0) continue;
      if (line.slice(0, separator).trim().toUpperCase() !== suffix) continue;
      const count = Number.parseInt(line.slice(separator + 1).trim(), 10);
      if (Number.isSafeInteger(count) && count >= 0) {
         return { status: count > 0 ? "leaked" : "safe", count };
      }
    }
    return { status: "safe", count: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

function decryptCache(account: Account, key: Buffer): CachedLeakResult | null {
  if (account.leakCheckCache === undefined) return null;
  const plaintext = decryptAesGcm(account.leakCheckCache, key);
  try {
    const parsed: unknown = JSON.parse(plaintext.toString("utf8"));
    if (!isCachedLeakResult(parsed)) return null;
    return parsed;
  } catch {
    return null;
  } finally {
    plaintext.fill(0);
  }
}

function isCachedLeakResult(value: unknown): value is CachedLeakResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<CachedLeakResult>;
  return (
    typeof candidate.passwordHash === "string" &&
    /^(?:[A-F0-9]{40})$/.test(candidate.passwordHash) &&
    (candidate.status === "leaked" || candidate.status === "safe") &&
    typeof candidate.count === "number" &&
    typeof candidate.checkedAt === "string"
  );
}

function resultFromCache(accountId: string, cache: CachedLeakResult): LeakCheckResult {
  return {
    accountId,
    status: cache.status,
    count: cache.count,
    checkedAt: cache.checkedAt,
    cached: true,
  };
}

export class LeakCheckService extends UnlockedService {
  public constructor(
    repository: import("../../repositories/vault.repository").VaultRepository,
    session: import("../../auth/session").InMemorySession,
    private readonly fetchImpl: FetchLike = defaultFetch,
  ) {
    super(repository, session);
  }

  public async check(accountId: string): Promise<LeakCheckResult> {
    return this.withVault(async (vault, key) => {
      const account = vault.accounts.find(
        (candidate) => candidate.id === accountId && isActive(candidate),
      );
      if (account === undefined) {
        throw new HttpError(404, "Account not found");
      }
      const password = decryptAesGcm(account.password, key);
      try {
        const passwordHash = sha1(password.toString("utf8"));
        const cached = decryptCache(account, key);
        if (
          cached !== null &&
          cached.passwordHash === passwordHash &&
          Date.now() - Date.parse(cached.checkedAt) < CACHE_TTL_MS
        ) {
          appendActivity(vault, key, {
            type: "leak_check_completed",
            at: nowIso(),
            entityType: "account",
            entityLabel: account.email,
            entityId: account.id,
            details: { status: cached.status, cached: true },
          });
          await this.repository.save(vault, key);
          return resultFromCache(account.id, cached);
        }

        let result: { status: "leaked" | "safe"; count: number };
        try {
          // HIBP receives only the first five SHA-1 characters. The complete
          // hash never leaves this process.
          result = await queryHibp(passwordHash, this.fetchImpl);
        } catch {
          appendActivity(vault, key, {
            type: "leak_check_unavailable",
            at: nowIso(),
            entityType: "account",
            entityLabel: account.email,
            entityId: account.id,
          });
          await this.repository.save(vault, key);
          return {
            accountId: account.id,
            status: "unknown",
            count: null,
            checkedAt: nowIso(),
            cached: false,
          };
        }

        const checkedAt = nowIso();
        const cache: CachedLeakResult = {
          passwordHash,
          status: result.status,
          count: result.count,
          checkedAt,
        };
        account.leakCheckCache = encryptAesGcm(JSON.stringify(cache), key);
        appendActivity(vault, key, {
          type: "leak_check_completed",
          at: checkedAt,
          entityType: "account",
          entityLabel: account.email,
          entityId: account.id,
          details: { status: result.status, cached: false },
        });
        await this.repository.save(vault, key);
        return {
          accountId: account.id,
          status: result.status,
          count: result.count,
          checkedAt,
          cached: false,
        };
      } finally {
        password.fill(0);
      }
    });
  }

  public async checkAll(): Promise<LeakCheckResult[]> {
    return this.withVault(async (vault, key) => {
      const results: LeakCheckResult[] = [];
      let changed = false;
      for (const account of vault.accounts.filter(isActive)) {
        const password = decryptAesGcm(account.password, key);
        try {
          const passwordHash = sha1(password.toString("utf8"));
          const cached = decryptCache(account, key);
          if (
            cached !== null &&
            cached.passwordHash === passwordHash &&
            Date.now() - Date.parse(cached.checkedAt) < CACHE_TTL_MS
          ) {
            results.push(resultFromCache(account.id, cached));
            appendActivity(vault, key, {
              type: "leak_check_completed",
              at: nowIso(),
              entityType: "account",
              entityLabel: account.email,
              entityId: account.id,
              details: { status: cached.status, cached: true },
            });
            changed = true;
            continue;
          }

          try {
            const result = await queryHibp(passwordHash, this.fetchImpl);
            const checkedAt = nowIso();
            account.leakCheckCache = encryptAesGcm(
              JSON.stringify({
                passwordHash,
                status: result.status,
                count: result.count,
                checkedAt,
              } satisfies CachedLeakResult),
              key,
            );
            results.push({
              accountId: account.id,
              status: result.status,
              count: result.count,
              checkedAt,
              cached: false,
            });
            appendActivity(vault, key, {
              type: "leak_check_completed",
              at: checkedAt,
              entityType: "account",
              entityLabel: account.email,
              entityId: account.id,
              details: { status: result.status, cached: false },
            });
            changed = true;
          } catch {
            results.push({
              accountId: account.id,
              status: "unknown",
              count: null,
              checkedAt: nowIso(),
              cached: false,
            });
            appendActivity(vault, key, {
              type: "leak_check_unavailable",
              at: nowIso(),
              entityType: "account",
              entityLabel: account.email,
              entityId: account.id,
            });
            changed = true;
          }
        } finally {
          password.fill(0);
        }
      }
      if (changed) await this.repository.save(vault, key);
      return results;
    });
  }
}
