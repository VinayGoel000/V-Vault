import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error-handler";
import type { AccountsService } from "../accounts/accounts.service";
import type { CardsService } from "../cards/cards.service";
import { RecycleBinService } from "./recycle-bin.service";

export class RecycleBinController {
  public constructor(
    private readonly service: RecycleBinService,
    private readonly cardsService: CardsService,
    private readonly accountsService: AccountsService,
  ) {}

  public list = async (_request: Request, response: Response): Promise<void> => {
    response.json(await this.service.list());
  };

  public restore = async (request: Request, response: Response): Promise<void> => {
    try {
      response.json({
        account: await this.accountsService.restore(String(request.params.id)),
      });
    } catch (error: unknown) {
      if (!isNotFound(error)) throw error;
      response.json({
        card: await this.cardsService.restore(String(request.params.id)),
      });
    }
  };

  public permanentlyDelete = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    try {
      await this.accountsService.permanentlyDelete(String(request.params.id));
    } catch (error: unknown) {
      if (!isNotFound(error)) throw error;
      await this.cardsService.permanentlyDelete(String(request.params.id));
    }
    response.status(204).send();
  };
}

function isNotFound(error: unknown): boolean {
  return error instanceof HttpError && error.statusCode === 404;
}
