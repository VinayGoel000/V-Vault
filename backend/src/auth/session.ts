export const AUTO_LOCK_AFTER_MS = 5 * 60 * 1000;

/**
 * Holds the derived vault key only in process memory. No session identifier or
 * key is serialized, and lock() overwrites the Buffer before releasing it.
 */
export class InMemorySession {
  private encryptionKey: Buffer | undefined;
  private autoLockTimer: NodeJS.Timeout | undefined;
  private lastActivityAt = 0;

  public constructor(
    private readonly autoLockAfterMs: number = AUTO_LOCK_AFTER_MS,
  ) {}

  public unlock(key: Buffer): void {
    this.lock();
    this.encryptionKey = Buffer.from(key);
    this.lastActivityAt = Date.now();
    this.scheduleAutoLock();
  }

  public lock(): void {
    if (this.encryptionKey !== undefined) {
      this.encryptionKey.fill(0);
    }
    this.encryptionKey = undefined;
    this.lastActivityAt = 0;
    if (this.autoLockTimer !== undefined) {
      clearTimeout(this.autoLockTimer);
      this.autoLockTimer = undefined;
    }
  }

  public isUnlocked(): boolean {
    if (this.isExpired()) {
      this.lock();
      return false;
    }

    return this.encryptionKey !== undefined;
  }

  /** Returns a copy so callers can wipe their working key independently. */
  public getKey(): Buffer | null {
    if (!this.isUnlocked() || this.encryptionKey === undefined) {
      return null;
    }

    this.touch();
    return Buffer.from(this.encryptionKey);
  }

  private touch(): void {
    this.lastActivityAt = Date.now();
    this.scheduleAutoLock();
  }

  private isExpired(): boolean {
    return (
      this.encryptionKey !== undefined &&
      Date.now() - this.lastActivityAt >= this.autoLockAfterMs
    );
  }

  private scheduleAutoLock(): void {
    if (this.autoLockTimer !== undefined) {
      clearTimeout(this.autoLockTimer);
    }

    this.autoLockTimer = setTimeout(() => this.lock(), this.autoLockAfterMs);
    this.autoLockTimer.unref();
  }
}
