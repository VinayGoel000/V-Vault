import type { Request, Response } from "express";
import { LeakCheckService } from "./leak-check.service";

export class LeakCheckController {
  public constructor(private readonly service: LeakCheckService) {}

  public check = async (request: Request, response: Response): Promise<void> => {
    const accountId = String(request.body?.accountId ?? request.params.id ?? "");
    response.json(await this.service.check(accountId));
  };

  public checkAll = async (_request: Request, response: Response): Promise<void> => {
    response.json({ results: await this.service.checkAll() });
  };
}
