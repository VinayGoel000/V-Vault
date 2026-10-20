import type { Request, Response } from "express";
import { AccountsService } from "./accounts.service";

export class AccountsController {
  public constructor(private readonly service: AccountsService) {}

  public create = async (request: Request, response: Response): Promise<void> => {
    const account = await this.service.create(
      String(request.params.cardId),
      request.body,
    );
    response.status(201).json({ account });
  };

  public listByCard = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    response.json({
      accounts: await this.service.listByCard(String(request.params.cardId)),
    });
  };

  public get = async (request: Request, response: Response): Promise<void> => {
    response.json({ account: await this.service.get(String(request.params.id)) });
  };

  public update = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    response.json({
      account: await this.service.update(String(request.params.id), request.body),
    });
  };

  public remove = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    await this.service.remove(String(request.params.id));
    response.status(204).send();
  };

  public restore = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    response.json({
      account: await this.service.restore(String(request.params.id)),
    });
  };

  public permanentlyDelete = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    await this.service.permanentlyDelete(String(request.params.id));
    response.status(204).send();
  };
}
