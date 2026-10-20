import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError, type ZodType } from "zod";

export class HttpError extends Error {
  public constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function asyncHandler(
  handler: RequestHandler,
): RequestHandler {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      next(new HttpError(400, "Invalid request body"));
      return;
    }

    request.body = result.data;
    next();
  };
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  next,
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({ error: "Invalid request" });
    return;
  }

  if (isBodyParserError(error)) {
    response.status(error.status).json({
      error:
        error.type === "entity.too.large"
          ? "Request body too large"
          : "Invalid JSON body",
    });
    return;
  }

  if (isMulterError(error)) {
    response.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      error:
        error.code === "LIMIT_FILE_SIZE"
          ? "CSV file is larger than 5 MB"
          : "Invalid CSV upload",
    });
    return;
  }

  response.status(500).json({ error: "Internal server error" });
};

function isBodyParserError(
  error: unknown,
): error is Error & { status: 400 | 413; type: string } {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as { status?: unknown; type?: unknown };
  return (
    (candidate.status === 400 || candidate.status === 413) &&
    typeof candidate.type === "string"
  );
}

function isMulterError(
  error: unknown,
): error is Error & { code: string } {
  return (
    error instanceof Error &&
    error.name === "MulterError" &&
    typeof (error as { code?: unknown }).code === "string"
  );
}
