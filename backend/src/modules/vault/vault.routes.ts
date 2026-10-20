import { Router } from "express";
import { UnlockVaultRequestSchema, SetupVaultRequestSchema } from "../../../../db";
import { asyncHandler, validateBody } from "../../middleware/error-handler";
import { VaultController } from "./vault.controller";

export function createVaultRouter(controller: VaultController): Router {
  const router = Router();

  router.post(
    "/setup",
    validateBody(SetupVaultRequestSchema),
    asyncHandler(controller.setup),
  );
  router.post(
    "/unlock",
    validateBody(UnlockVaultRequestSchema),
    asyncHandler(controller.unlock),
  );
  router.post("/lock", asyncHandler(controller.lock));
  router.get("/status", asyncHandler(controller.status));

  return router;
}
