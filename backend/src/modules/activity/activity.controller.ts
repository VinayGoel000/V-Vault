import type { Request, Response } from "express";
import { ActivityService } from "./activity.service";

export class ActivityController {
  public constructor(private readonly service: ActivityService) {}

  public list = async (request: Request, response: Response): Promise<void> => {
    const parsedLimit = Number(request.query.limit ?? 100);
    const limit = Number.isFinite(parsedLimit) ? Math.trunc(parsedLimit) : 100;
    response.json({ activities: await this.service.list(limit) });
  };
}
