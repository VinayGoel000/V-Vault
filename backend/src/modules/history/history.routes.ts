import { Router } from "express";
import { ChangePasswordRequestSchema } from "../../../../db";
import { asyncHandler, validateBody } from "../../middleware/error-handler";
import { HistoryController } from "./history.controller";

export function createHistoryRouter(controller: HistoryController): Router {
  const router = Router();

  router.put(
    "/accounts/:id/password",
    validateBody(ChangePasswordRequestSchema),
    asyncHandler(controller.changePassword),
  );
  router.get(
    "/accounts/:id/history",
    asyncHandler(controller.list),
  );

  return router;
}
