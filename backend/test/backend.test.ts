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
