import express, { type Express } from "express";
import { InMemorySession } from "./auth/session";
import { errorHandler } from "./middleware/error-handler";
import { requireUnlocked } from "./middleware/require-unlocked";
import { AccountsController } from "./modules/accounts/accounts.controller";
import { AccountsService } from "./modules/accounts/accounts.service";
import { CardsController } from "./modules/cards/cards.controller";
import { CardsService } from "./modules/cards/cards.service";
import { HistoryController } from "./modules/history/history.controller";
import { HistoryService } from "./modules/history/history.service";
import { PasswordsController } from "./modules/passwords/passwords.controller";
import { createPasswordsRouter } from "./modules/passwords/passwords.routes";
import { VaultController } from "./modules/vault/vault.controller";
import { createVaultRouter } from "./modules/vault/vault.routes";
import { VaultService } from "./modules/vault/vault.service";
import { createAccountsRouter } from "./modules/accounts/accounts.routes";
import { createCardsRouter } from "./modules/cards/cards.routes";
import { createHistoryRouter } from "./modules/history/history.routes";
import { VaultRepository } from "./repositories/vault.repository";

export interface AppDependencies {
  repository?: VaultRepository;
  session?: InMemorySession;
}

export function createApp(dependencies: AppDependencies = {}): Express {
  const repository = dependencies.repository ?? new VaultRepository();
  const session = dependencies.session ?? new InMemorySession();
  const vaultService = new VaultService(repository, session);
  const cardsService = new CardsService(repository, session);
  const accountsService = new AccountsService(repository, session);
  const historyService = new HistoryService(repository, session);

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));

  app.use("/vault", createVaultRouter(new VaultController(vaultService)));

  const unlocked = requireUnlocked(session);
  app.use(
    "/cards",
    unlocked,
    createCardsRouter(new CardsController(cardsService)),
  );
  app.use(
    "/",
    unlocked,
    createAccountsRouter(new AccountsController(accountsService)),
  );
  app.use(
    "/",
    unlocked,
    createHistoryRouter(new HistoryController(historyService)),
  );
  app.use(
    "/passwords",
    unlocked,
    createPasswordsRouter(new PasswordsController()),
  );

  app.use((_request, response) => {
    response.status(404).json({ error: "Not found" });
  });
  app.use(errorHandler);

  return app;
}
