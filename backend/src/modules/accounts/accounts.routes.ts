import { Router } from "express";
import {
  CreateAccountRequestSchema,
  UpdateAccountRequestSchema,
} from "../../../../db";
import { asyncHandler, validateBody } from "../../middleware/error-handler";
import { AccountsController } from "./accounts.controller";

export function createAccountsRouter(controller: AccountsController): Router {
  const router = Router();

  router.post(
    "/cards/:cardId/accounts",
    validateBody(CreateAccountRequestSchema),
    asyncHandler(controller.create),
  );
  router.get(
    "/cards/:cardId/accounts",
    asyncHandler(controller.listByCard),
  );
  router.get("/accounts/:id", asyncHandler(controller.get));
  router.patch(
    "/accounts/:id",
    validateBody(UpdateAccountRequestSchema),
    asyncHandler(controller.update),
  );
  router.delete("/accounts/:id", asyncHandler(controller.remove));
  router.post("/accounts/:id/restore", asyncHandler(controller.restore));
  router.delete(
    "/accounts/:id/permanent",
    asyncHandler(controller.permanentlyDelete),
  );
  router.delete(
    "/accounts/:id/permanent-delete",
    asyncHandler(controller.permanentlyDelete),
  );

  return router;
}
