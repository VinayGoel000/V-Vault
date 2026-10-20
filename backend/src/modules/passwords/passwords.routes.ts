import { Router } from "express";
import { PasswordGeneratorRequestSchema } from "../../../../db";
import { asyncHandler, validateBody } from "../../middleware/error-handler";
import { PasswordsController } from "./passwords.controller";

export function createPasswordsRouter(controller: PasswordsController): Router {
  const router = Router();
  router.post(
    "/generate",
    validateBody(PasswordGeneratorRequestSchema),
    asyncHandler(controller.generate),
  );
  return router;
}
