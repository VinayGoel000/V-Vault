import type { Request, Response } from "express";
import { HistoryService } from "./history.service";

export class HistoryController {
  public constructor(private readonly service: HistoryService) {}

  public changePassword = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    await this.service.changePassword(
      String(request.params.id),
      request.body.newPassword,
    );
    response.json({ message: "Password changed" });
  };

  public list = async (request: Request, response: Response): Promise<void> => {
    response.json({ history: await this.service.list(String(request.params.id)) });
  };
}
