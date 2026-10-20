import type { Request, Response } from "express";
import { CardsService } from "./cards.service";

export class CardsController {
  public constructor(private readonly service: CardsService) {}

  public create = async (request: Request, response: Response): Promise<void> => {
    const card = await this.service.create(request.body.name);
    response.status(201).json({ card });
  };

  public list = async (_request: Request, response: Response): Promise<void> => {
    response.json({ cards: await this.service.list() });
  };

  public rename = async (request: Request, response: Response): Promise<void> => {
    const card = await this.service.rename(String(request.params.id), request.body.name);
    response.json({ card });
  };

  public remove = async (request: Request, response: Response): Promise<void> => {
    await this.service.remove(String(request.params.id));
    response.status(204).send();
  };

  public restore = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    response.json({ card: await this.service.restore(String(request.params.id)) });
  };

  public permanentlyDelete = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    await this.service.permanentlyDelete(String(request.params.id));
    response.status(204).send();
  };
}
