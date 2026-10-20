import { Router } from "express";
import { CreateCardRequestSchema, RenameCardRequestSchema } from "../../../../db";
import { asyncHandler, validateBody } from "../../middleware/error-handler";
import { CardsController } from "./cards.controller";

export function createCardsRouter(controller: CardsController): Router {
  const router = Router();

  router.post(
    "/",
    validateBody(CreateCardRequestSchema),
    asyncHandler(controller.create),
  );
  router.get("/", asyncHandler(controller.list));
  router.patch(
    "/:id",
    validateBody(RenameCardRequestSchema),
    asyncHandler(controller.rename),
  );
  router.delete("/:id", asyncHandler(controller.remove));

  return router;
}
