import express, { type Express } from "express";
import { InMemorySession } from "./auth/session";
import { errorHandler } from "./middleware/error-handler";
import { requireUnlocked } from "./middleware/require-unlocked";
import { ActivityController } from "./modules/activity/activity.controller";
import { ActivityService } from "./modules/activity/activity.service";
import { AccountsController } from "./modules/accounts/accounts.controller";
import { AccountsService } from "./modules/accounts/accounts.service";
import { CardsController } from "./modules/cards/cards.controller";
import { CardsService } from "./modules/cards/cards.service";
import { HistoryController } from "./modules/history/history.controller";
import { HistoryService } from "./modules/history/history.service";
import { ImportController } from "./modules/imports/import.controller";
import { ImportService } from "./modules/imports/import.service";
import { LeakCheckController } from "./modules/leak-check/leak-check.controller";
import { LeakCheckService } from "./modules/leak-check/leak-check.service";
import { PasswordsController } from "./modules/passwords/passwords.controller";
import { createActivityRouter } from "./modules/activity/activity.routes";
import { createImportRouter } from "./modules/imports/import.routes";
import { createLeakCheckRouter } from "./modules/leak-check/leak-check.routes";
import { createPasswordsRouter } from "./modules/passwords/passwords.routes";
import { RecycleBinController } from "./modules/recycle-bin/recycle-bin.controller";
import { RecycleBinService } from "./modules/recycle-bin/recycle-bin.service";
import { createRecycleBinRouter } from "./modules/recycle-bin/recycle-bin.routes";
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
  hibpFetch?: typeof fetch;
}

export function createApp(dependencies: AppDependencies = {}): Express {
  const repository = dependencies.repository ?? new VaultRepository();
  const session = dependencies.session ?? new InMemorySession();
  const vaultService = new VaultService(repository, session);
  const cardsService = new CardsService(repository, session);
  const accountsService = new AccountsService(repository, session);
  const historyService = new HistoryService(repository, session);
  const activityService = new ActivityService(repository, session);
  const recycleBinService = new RecycleBinService(repository, session);
  const importService = new ImportService(repository, session);
  const leakCheckService = new LeakCheckService(
    repository,
    session,
    dependencies.hibpFetch,
  );
  const cardsController = new CardsController(cardsService);
  const accountsController = new AccountsController(accountsService);

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));

  app.use("/vault", createVaultRouter(new VaultController(vaultService)));

  const unlocked = requireUnlocked(session);
  app.use(
    "/cards",
    unlocked,
    createCardsRouter(cardsController),
  );
  app.use(
    "/",
    unlocked,
    createLeakCheckRouter(new LeakCheckController(leakCheckService)),
  );
  app.use(
    "/",
    unlocked,
    createAccountsRouter(accountsController),
  );
  app.use(
    "/",
    unlocked,
    createHistoryRouter(new HistoryController(historyService)),
  );
  app.use(
    "/",
    unlocked,
    createActivityRouter(new ActivityController(activityService)),
  );
  app.use(
    "/",
    unlocked,
    createRecycleBinRouter(
      new RecycleBinController(
        recycleBinService,
        cardsService,
        accountsService,
      ),
      cardsController,
      accountsController,
    ),
  );
  const importRouter = createImportRouter(new ImportController(importService));
  app.use("/import", unlocked, importRouter);
  app.use("/imports", unlocked, importRouter);
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
