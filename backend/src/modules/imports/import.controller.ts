import type { Request, Response } from "express";
import { getUploadedFile, ImportService } from "./import.service";

export class ImportController {
  public constructor(private readonly service: ImportService) {}

  public preview = async (request: Request, response: Response): Promise<void> => {
    const file = getUploadedFile(request.files);
    if (file === undefined) {
      response.status(400).json({ error: "CSV file is required" });
      return;
    }
    if (!file.originalname.toLowerCase().endsWith(".csv")) {
      response.status(400).json({ error: "Only CSV files are supported" });
      return;
    }
    const source = String(request.params.source ?? request.body?.source ?? "");
    response.json(
      await this.service.preview(source, file.buffer),
    );
  };

  public commit = async (request: Request, response: Response): Promise<void> => {
    const file = getUploadedFile(request.files);
    if (file !== undefined && !file.originalname.toLowerCase().endsWith(".csv")) {
      response.status(400).json({ error: "Only CSV files are supported" });
      return;
    }
    const source = String(request.params.source ?? request.body?.source ?? "");
    response.json(
      await this.service.commit(
        source,
        typeof request.body?.previewId === "string"
          ? request.body.previewId
          : undefined,
        file?.buffer,
      ),
    );
  };
}
