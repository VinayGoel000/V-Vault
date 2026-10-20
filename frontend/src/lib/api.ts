import type {
  AccountDetails,
  AccountSummary,
  ActivityLogEntry,
  Card,
  CardSummary,
  CreateAccountRequest,
  HistoryEntry,
  ImportCommitResult,
  ImportPreview,
  LeakCheckResult,
  MessageResponse,
  PasswordGeneratorRequest,
  RecycleBinAccount,
  RecycleBinCard,
  UpdateAccountRequest,
  VaultStatus,
} from "../types";

// Vite development uses a same-origin proxy because the backend intentionally
// has no public CORS surface. Production can set VITE_API_URL to the local
// backend or to a same-origin reverse proxy.
const apiBase = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "/api" : "http://127.0.0.1:3765")
).replace(/\/$/, "");

export class ApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
    body:
      options.body === undefined || options.body instanceof FormData
        ? (options.body as BodyInit | undefined)
        : JSON.stringify(options.body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const rawBody = await response.text();
  let payload: unknown;
  try {
    payload = rawBody.length > 0 ? (JSON.parse(rawBody) as unknown) : undefined;
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export const api = {
  getStatus: () => request<VaultStatus>("/vault/status"),

  setup: (masterPassword: string) =>
    request<MessageResponse>("/vault/setup", {
      method: "POST",
      body: { masterPassword },
    }),

  unlock: (masterPassword: string) =>
    request<MessageResponse>("/vault/unlock", {
      method: "POST",
      body: { masterPassword },
    }),

  lock: () =>
    request<MessageResponse>("/vault/lock", {
      method: "POST",
    }),

  listCards: async () => {
    const response = await request<{ cards: CardSummary[] }>("/cards");
    return response.cards;
  },

  createCard: async (name: string) => {
    const response = await request<{ card: Card }>("/cards", {
      method: "POST",
      body: { name },
    });
    return response.card;
  },

  renameCard: async (id: string, name: string) => {
    const response = await request<{ card: Card }>(`/cards/${id}`, {
      method: "PATCH",
      body: { name },
    });
    return response.card;
  },

  deleteCard: (id: string) =>
    request<void>(`/cards/${id}`, {
      method: "DELETE",
    }),

  listAccounts: async (cardId: string) => {
    const response = await request<{ accounts: AccountSummary[] }>(
      `/cards/${cardId}/accounts`,
    );
    return response.accounts;
  },

  createAccount: async (cardId: string, body: CreateAccountRequest) => {
    const response = await request<{ account: AccountSummary }>(
      `/cards/${cardId}/accounts`,
      {
        method: "POST",
        body,
      },
    );
    return response.account;
  },

  getAccount: async (id: string) => {
    const response = await request<{ account: AccountDetails }>(
      `/accounts/${id}`,
    );
    return response.account;
  },

  updateAccount: async (id: string, body: UpdateAccountRequest) => {
    const response = await request<{ account: AccountSummary }>(
      `/accounts/${id}`,
      {
        method: "PATCH",
        body,
      },
    );
    return response.account;
  },

  deleteAccount: (id: string) =>
    request<void>(`/accounts/${id}`, {
      method: "DELETE",
    }),

  changePassword: (id: string, newPassword: string) =>
    request<MessageResponse>(`/accounts/${id}/password`, {
      method: "PUT",
      body: { newPassword },
    }),

  listHistory: async (id: string) => {
    const response = await request<{ history: HistoryEntry[] }>(
      `/accounts/${id}/history`,
    );
    return response.history;
  },

  generatePassword: async (body: PasswordGeneratorRequest) => {
    const response = await request<{ password: string }>("/passwords/generate", {
      method: "POST",
      body,
    });
    return response.password;
  },

  listRecycleBin: () =>
    request<{ cards: RecycleBinCard[]; accounts: RecycleBinAccount[] }>(
      "/recycle-bin",
    ),

  restoreCard: (id: string) =>
    request<{ card: Card }>(`/recycle-bin/cards/${id}/restore`, {
      method: "POST",
    }),

  restoreAccount: (id: string) =>
    request<{ account: AccountSummary }>(`/recycle-bin/accounts/${id}/restore`, {
      method: "POST",
    }),

  permanentlyDeleteCard: (id: string) =>
    request<void>(`/recycle-bin/cards/${id}/permanent`, { method: "DELETE" }),

  permanentlyDeleteAccount: (id: string) =>
    request<void>(`/recycle-bin/accounts/${id}/permanent`, { method: "DELETE" }),

  listActivity: async (limit = 100) => {
    const response = await request<{ activities: ActivityLogEntry[] }>(
      `/activity-log?limit=${encodeURIComponent(String(limit))}`,
    );
    return response.activities;
  },

  previewImport: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<ImportPreview>("/import/preview", {
      method: "POST",
      body: form,
    });
  },

  commitImport: async (file: File, previewId: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("previewId", previewId);
    return request<ImportCommitResult>("/import/commit", {
      method: "POST",
      body: form,
    });
  },

  checkLeak: (accountId: string) =>
    request<LeakCheckResult>("/security/leak-check", {
      method: "POST",
      body: { accountId },
    }),

  checkAllLeaks: async () => {
    const response = await request<{ results: LeakCheckResult[] }>(
      "/security/leak-check-all",
      { method: "POST" },
    );
    return response.results;
  },
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof TypeError) {
    return "V-Vault could not reach the local backend. Is it running on port 3765?";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
