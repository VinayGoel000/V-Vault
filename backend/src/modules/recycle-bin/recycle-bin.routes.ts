import { Router } from "express";
import { asyncHandler } from "../../middleware/error-handler";
import { AccountsController } from "../accounts/accounts.controller";
import { CardsController } from "../cards/cards.controller";
import { RecycleBinController } from "./recycle-bin.controller";

export function createRecycleBinRouter(
  controller: RecycleBinController,
  cardsController: CardsController,
  accountsController: AccountsController,
): Router {
  const router = Router();
  router.get("/recycle-bin", asyncHandler(controller.list));
  router.post(
    "/recycle-bin/:id/restore",
    asyncHandler(controller.restore),
  );
  router.delete(
    "/recycle-bin/:id",
    asyncHandler(controller.permanentlyDelete),
  );
  router.post(
    "/recycle-bin/cards/:id/restore",
    asyncHandler(cardsController.restore),
  );
  router.delete(
    "/recycle-bin/cards/:id",
    asyncHandler(cardsController.permanentlyDelete),
  );
  router.delete(
    "/recycle-bin/cards/:id/permanent",
    asyncHandler(cardsController.permanentlyDelete),
  );
  router.delete(
    "/recycle-bin/cards/:id/permanent-delete",
    asyncHandler(cardsController.permanentlyDelete),
  );
  router.post(
    "/recycle-bin/accounts/:id/restore",
    asyncHandler(accountsController.restore),
  );
  router.delete(
    "/recycle-bin/accounts/:id",
    asyncHandler(accountsController.permanentlyDelete),
  );
  router.delete(
    "/recycle-bin/accounts/:id/permanent",
    asyncHandler(accountsController.permanentlyDelete),
  );
  router.delete(
    "/recycle-bin/accounts/:id/permanent-delete",
    asyncHandler(accountsController.permanentlyDelete),
  );
  return router;
}
