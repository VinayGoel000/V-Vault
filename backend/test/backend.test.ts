import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { InMemorySession } from "../src/auth/session";
import { VaultRepository } from "../src/repositories/vault.repository";

const MASTER_PASSWORD = "correct horse battery staple";

describe("V-Vault backend", () => {
  let temporaryDirectory: string;
  let vaultPath: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    temporaryDirectory = await fs.mkdtemp(
      path.join(os.tmpdir(), "v-vault-test-"),
    );
    vaultPath = path.join(temporaryDirectory, "vault.vault");
    app = createApp({
      repository: new VaultRepository(vaultPath),
      session: new InMemorySession(),
    });
  });

  afterEach(async () => {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  it("supports setup, unlock, status, and lock", async () => {
    await request(app)
      .post("/vault/setup")
      .send({ masterPassword: MASTER_PASSWORD })
      .expect(201);

    await request(app)
      .post("/vault/setup")
      .send({ masterPassword: MASTER_PASSWORD })
      .expect(409);
    await request(app)
      .post("/vault/unlock")
      .send({ masterPassword: "wrong password" })
      .expect(401);
    await request(app)
      .post("/vault/unlock")
      .send({ masterPassword: MASTER_PASSWORD })
      .expect(200);

    await request(app)
      .get("/vault/status")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ isSetup: true, isUnlocked: true });
      });

    await request(app).post("/vault/lock").expect(200);
    await request(app)
      .get("/vault/status")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ isSetup: true, isUnlocked: false });
      });
  });

  it("returns 423 for every data route while locked", async () => {
    await request(app).get("/cards").expect(423);
    await request(app).post("/cards").send({ name: "Google" }).expect(423);
    await request(app)
      .post("/cards/not-a-card/accounts")
      .send({
        email: "test@example.com",
        username: "test",
        password: "secret",
      })
      .expect(423);
    await request(app).get("/accounts/not-an-account").expect(423);
    await request(app)
      .put("/accounts/not-an-account/password")
      .send({ newPassword: "new secret" })
      .expect(423);
    await request(app)
      .get("/accounts/not-an-account/history")
      .expect(423);
    await request(app)
      .post("/passwords/generate")
      .send({})
      .expect(423);
  });

  it("performs card and account CRUD without exposing passwords in lists", async () => {
    await setupAndUnlock();

    const cardResponse = await request(app)
      .post("/cards")
      .send({ name: "Google" })
      .expect(201);
    const cardId = cardResponse.body.card.id as string;

    const accountResponse = await request(app)
      .post(`/cards/${cardId}/accounts`)
      .send({
        email: "try@gmail.com",
        username: "try",
        password: "known-password-not-for-list",
        notes: "personal",
      })
      .expect(201);
    const accountId = accountResponse.body.account.id as string;

    const cards = await request(app).get("/cards").expect(200);
    expect(cards.body.cards[0].accountCount).toBe(1);

    const accounts = await request(app)
      .get(`/cards/${cardId}/accounts`)
      .expect(200);
    expect(accounts.body.accounts[0]).not.toHaveProperty("password");
    expect(accounts.body.accounts[0]).not.toHaveProperty("history");

    await request(app)
      .patch(`/accounts/${accountId}`)
      .send({ username: "renamed" })
      .expect(200);
    const detail = await request(app)
      .get(`/accounts/${accountId}`)
      .expect(200);
    expect(detail.body.account).toMatchObject({
      email: "try@gmail.com",
      username: "renamed",
      password: "known-password-not-for-list",
    });

    await request(app)
      .patch(`/cards/${cardId}`)
      .send({ name: "Google renamed" })
      .expect(200);
    await request(app).delete(`/cards/${cardId}`).expect(204);
    await request(app).get(`/accounts/${accountId}`).expect(404);
  });

  it("changes passwords and returns newest history entries with timestamps", async () => {
    await setupAndUnlock();
    const cardId = await createCard();
    const account = await request(app)
      .post(`/cards/${cardId}/accounts`)
      .send({
        email: "history@example.com",
        username: "history",
        password: "old-password",
      })
      .expect(201);
    const accountId = account.body.account.id as string;

    await request(app)
      .put(`/accounts/${accountId}/password`)
      .send({ newPassword: "new-password" })
      .expect(200);
    const history = await request(app)
      .get(`/accounts/${accountId}/history`)
      .expect(200);

    expect(history.body.history).toHaveLength(1);
    expect(history.body.history[0]).toMatchObject({
      password: "old-password",
    });
    expect(() => new Date(history.body.history[0].changedAt).toISOString()).not.toThrow();
  });

  it("allows accounts without a username", async () => {
    await setupAndUnlock();
    const cardId = await createCard();
    const account = await request(app)
      .post(`/cards/${cardId}/accounts`)
      .send({
        email: "no-username@example.com",
        password: "account-password",
      })
      .expect(201);

    expect(account.body.account).not.toHaveProperty("username");
    const detail = await request(app)
      .get(`/accounts/${account.body.account.id}`)
      .expect(200);
    expect(detail.body.account).not.toHaveProperty("username");
  });

  it("generates a password with the requested length and categories", async () => {
    await setupAndUnlock();
    const response = await request(app)
      .post("/passwords/generate")
      .send({
        length: 32,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
      })
      .expect(200);
    const password = response.body.password as string;

    expect(password).toHaveLength(32);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[!@#$%^&*()\-_=+\[\]{};:,.?]/);
  });

  it("does not contain a known plaintext password in raw vault bytes", async () => {
    await setupAndUnlock();
    const cardId = await createCard();
    await request(app)
      .post(`/cards/${cardId}/accounts`)
      .send({
        email: "encrypted@example.com",
        username: "encrypted",
        password: "known-plaintext-password-12345",
      })
      .expect(201);

    const rawVault = await fs.readFile(vaultPath);
    expect(rawVault.includes(Buffer.from("known-plaintext-password-12345"))).toBe(
      false,
    );
  });

  it("supports website URLs, validated notes, and encrypted custom fields", async () => {
    await setupAndUnlock();
    const cardId = await createCard();
    const secret = "custom-field-secret-123";
    const created = await request(app)
      .post(`/cards/${cardId}/accounts`)
      .send({
        email: "fields@example.com",
        password: "account-password",
        websiteUrl: "https://example.com/login",
        notes: "short note",
        customFields: [
          { key: "Department", value: "Finance", isSecret: false },
          { key: "PIN", value: secret, isSecret: true },
        ],
      })
      .expect(201);
    const accountId = created.body.account.id as string;

    expect(created.body.account.customFields[1]).toMatchObject({
      key: "PIN",
      value: "********",
      isSecret: true,
    });
    const detail = await request(app).get(`/accounts/${accountId}`).expect(200);
    expect(detail.body.account).toMatchObject({
      websiteUrl: "https://example.com/login",
      notes: "short note",
    });
    expect(detail.body.account.customFields[1]).toMatchObject({
      key: "PIN",
      value: secret,
      isSecret: true,
    });

    await request(app)
      .patch(`/accounts/${accountId}`)
      .send({ notes: "x".repeat(2_001) })
      .expect(400);
    const rawVault = await fs.readFile(vaultPath);
    expect(rawVault.includes(Buffer.from(secret))).toBe(false);
  });

  it("soft-deletes accounts, restores them, and permanently deletes recycle-bin entries", async () => {
    await setupAndUnlock();
    const cardId = await createCard();
    const account = await request(app)
      .post(`/cards/${cardId}/accounts`)
      .send({ email: "recycle@example.com", password: "recycle-password" })
      .expect(201);
    const accountId = account.body.account.id as string;

    await request(app).delete(`/accounts/${accountId}`).expect(204);
    await request(app).get(`/accounts/${accountId}`).expect(404);
    const recycle = await request(app).get("/recycle-bin").expect(200);
    expect(recycle.body.accounts.map((item: { id: string }) => item.id)).toContain(
      accountId,
    );

    await request(app)
      .post(`/recycle-bin/accounts/${accountId}/restore`)
      .expect(200);
    await request(app).get(`/accounts/${accountId}`).expect(200);
    await request(app).delete(`/accounts/${accountId}`).expect(204);
    await request(app)
      .delete(`/recycle-bin/accounts/${accountId}`)
      .expect(204);
    await request(app).get("/recycle-bin").expect(({ body }) => {
      expect(body.accounts.some((item: { id: string }) => item.id === accountId)).toBe(
        false,
      );
    });
  });

  it("returns encrypted activity events and keeps the log bounded", async () => {
    await setupAndUnlock();
    const cardId = await createCard();
    const account = await request(app)
      .post(`/cards/${cardId}/accounts`)
      .send({ email: "activity@example.com", password: "activity-password" })
      .expect(201);
    await request(app)
      .put(`/accounts/${account.body.account.id}/password`)
      .send({ newPassword: "new-activity-password" })
      .expect(200);

    const activity = await request(app).get("/activity").expect(200);
    const types = activity.body.activities.map((event: { type: string }) => event.type);
    expect(types).toEqual(expect.arrayContaining([
       "VAULT_UNLOCKED",
       "CARD_CREATED",
       "ACCOUNT_CREATED",
       "PASSWORD_CHANGED",
    ]));
    const rawVault = await fs.readFile(vaultPath, "utf8");
    expect(rawVault).not.toContain("PASSWORD_CHANGED");
  });

  it("previews and commits Chrome CSV imports without exposing passwords", async () => {
    await setupAndUnlock();
    const csv = Buffer.from(
      "name,url,username,password,note\nGoogle,https://google.com,import@example.com,import-secret,imported note\n",
    );
    const preview = await request(app)
      .post("/import/chrome/preview")
      .attach("file", csv, "chrome.csv")
      .expect(200);
    expect(preview.body.rows[0].password).toBe("********");
    expect(JSON.stringify(preview.body)).not.toContain("import-secret");

    await request(app)
      .post("/import/chrome/commit")
      .send({ previewId: preview.body.previewId })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ imported: 1, skippedDuplicates: 0 });
      });
    const cards = await request(app).get("/cards").expect(200);
    expect(cards.body.cards).toHaveLength(1);
    const importedAccounts = await request(app)
      .get(`/cards/${cards.body.cards[0].id}/accounts`)
      .expect(200);
    expect(importedAccounts.body.accounts).toHaveLength(1);
    const detail = await request(app)
      .get(`/accounts/${importedAccounts.body.accounts[0].id}`)
      .expect(200);
    expect(detail.body.account.password).toBe("import-secret");

    const duplicatePreview = await request(app)
      .post("/import/chrome/preview")
      .attach("file", csv, "chrome.csv")
      .expect(200);
    expect(duplicatePreview.body.duplicateRows).toBe(1);

    const bitwarden = Buffer.from(
      "folder,favorite,type,name,notes,fields,login_uri,login_username,login_password,login_totp\n,0,login,Bitwarden,bitwarden note,Team: Platform,https://vault.example.com,bw@example.com,bitwarden-secret,\n",
    );
    const bitwardenPreview = await request(app)
      .post("/imports/bitwarden/preview")
      .attach("file", bitwarden, "bitwarden.csv")
      .expect(200);
    expect(bitwardenPreview.body.rows[0].password).toBe("********");
    await request(app)
      .post("/imports/bitwarden/commit")
      .field("previewId", bitwardenPreview.body.previewId)
      .expect(200)
      .expect(({ body }) => expect(body.imported).toBe(1));
  });

  it("uses HIBP k-anonymity and caches successful results for 24 hours", async () => {
    const requestedUrls: string[] = [];
    app = createApp({
      repository: new VaultRepository(vaultPath),
      session: new InMemorySession(),
      hibpFetch: (async (input) => {
        requestedUrls.push(String(input));
        return new Response("");
      }) as typeof fetch,
    });
    await setupAndUnlock();
    const cardId = await createCard();
    const account = await request(app)
      .post(`/cards/${cardId}/accounts`)
      .send({ email: "hibp@example.com", password: "hibp-password" })
      .expect(201);
    const accountId = account.body.account.id as string;

    await request(app).post(`/accounts/${accountId}/leak-check`).expect(200);
    const cached = await request(app)
      .post(`/accounts/${accountId}/leak-check`)
      .expect(200);
    expect(cached.body).toMatchObject({ status: "safe", cached: true });
    expect(requestedUrls).toHaveLength(1);
    expect(new URL(requestedUrls[0]).pathname).toMatch(/\/range\/[A-F0-9]{5}$/);
    expect(requestedUrls[0]).not.toContain("hibp-password");
  });

  it("handles HIBP network failures without exposing password data", async () => {
    app = createApp({
      repository: new VaultRepository(vaultPath),
      session: new InMemorySession(),
      hibpFetch: (async () => {
        throw new Error("network unavailable");
      }) as typeof fetch,
    });
    await setupAndUnlock();
    const cardId = await createCard();
    const account = await request(app)
      .post(`/cards/${cardId}/accounts`)
      .send({ email: "offline@example.com", password: "offline-password" })
      .expect(201);

    await request(app)
      .post(`/accounts/${account.body.account.id}/leak-check`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ status: "unknown", count: null });
        expect(JSON.stringify(body)).not.toContain("offline-password");
      });
  });

  async function setupAndUnlock(): Promise<void> {
    await request(app)
      .post("/vault/setup")
      .send({ masterPassword: MASTER_PASSWORD })
      .expect(201);
    await request(app)
      .post("/vault/unlock")
      .send({ masterPassword: MASTER_PASSWORD })
      .expect(200);
  }

  async function createCard(): Promise<string> {
    const response = await request(app)
      .post("/cards")
      .send({ name: "Test service" })
      .expect(201);
    return response.body.card.id as string;
  }
});
