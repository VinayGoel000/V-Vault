import { Router } from "express";
import { asyncHandler } from "../../middleware/error-handler";
import { ActivityController } from "./activity.controller";

export function createActivityRouter(controller: ActivityController): Router {
  const router = Router();
  router.get("/activity", asyncHandler(controller.list));
  router.get("/activity-log", asyncHandler(controller.list));
  return router;
}
