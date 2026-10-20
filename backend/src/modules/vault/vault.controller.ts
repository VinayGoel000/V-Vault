import type { Request, Response } from "express";
import { VaultService } from "./vault.service";

export class VaultController {
  public constructor(private readonly service: VaultService) {}

  public setup = async (request: Request, response: Response): Promise<void> => {
    await this.service.setup(request.body.masterPassword);
    response.status(201).json({ message: "Vault setup complete" });
  };

  public unlock = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    await this.service.unlock(request.body.masterPassword);
    response.json({ message: "Vault unlocked" });
  };

  public status = async (
    _request: Request,
    response: Response,
  ): Promise<void> => {
    response.json(await this.service.getStatus());
  };

  public lock = async (_request: Request, response: Response): Promise<void> => {
    this.service.lock();
    response.json({ message: "Vault locked" });
  };
}
