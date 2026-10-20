import type { Request, Response } from "express";
import { generatePassword } from "../../crypto/generator";

export class PasswordsController {
  public generate = async (
    request: Request,
    response: Response,
  ): Promise<void> => {
    response.json({ password: generatePassword(request.body) });
  };
}
