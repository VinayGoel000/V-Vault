import { Router } from "express";
import { asyncHandler } from "../../middleware/error-handler";
import { LeakCheckController } from "./leak-check.controller";

export function createLeakCheckRouter(controller: LeakCheckController): Router {
  const router = Router();
  router.post("/security/leak-check", asyncHandler(controller.check));
  router.post("/security/leak-check-all", asyncHandler(controller.checkAll));
  router.get("/accounts/:id/leak-check", asyncHandler(controller.check));
  router.post("/accounts/:id/leak-check", asyncHandler(controller.check));
  router.get("/accounts/:id/check-leak", asyncHandler(controller.check));
  router.post("/accounts/:id/check-leak", asyncHandler(controller.check));
  router.get("/accounts/:id/hibp", asyncHandler(controller.check));
  router.post("/accounts/:id/hibp", asyncHandler(controller.check));
  router.post("/accounts/leak-check-all", asyncHandler(controller.checkAll));
  router.get("/accounts/leak-check-all", asyncHandler(controller.checkAll));
  router.post("/accounts/leak-check", asyncHandler(controller.checkAll));
  router.get("/accounts/leak-check", asyncHandler(controller.checkAll));
  router.post("/leak-check-all", asyncHandler(controller.checkAll));
  router.get("/leak-check-all", asyncHandler(controller.checkAll));
  return router;
}
