import multer from "multer";
import { Router } from "express";
import { asyncHandler } from "../../middleware/error-handler";
import { ImportController } from "./import.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

export function createImportRouter(controller: ImportController): Router {
  const router = Router();
  router.post(
    "/:source/preview",
    upload.any(),
    asyncHandler(controller.preview),
  );
  router.post("/preview", upload.any(), asyncHandler(controller.preview));
  router.post(
    "/:source/commit",
    upload.any(),
    asyncHandler(controller.commit),
  );
  router.post("/commit", upload.any(), asyncHandler(controller.commit));
  return router;
}
