export interface ApiErrorResponse {
  error: string;
}

export interface MessageResponse {
  message: string;
}

export interface VaultStatus {
  isSetup: boolean;
  isUnlocked: boolean;
}

export interface Card {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CardSummary extends Card {
  accountCount: number;
}

export interface AccountSummary {
  id: string;
  cardId: string;
  email: string;
  username: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountDetails extends AccountSummary {
  password: string;
}

export interface HistoryEntry {
  password: string;
  changedAt: string;
}

export interface CreateAccountRequest {
  email: string;
  username: string;
  password: string;
  notes?: string;
}

export interface UpdateAccountRequest {
  email?: string;
  username?: string;
  notes?: string | null;
}

export interface PasswordGeneratorRequest {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
}

export type VaultStage = "boot" | "setup" | "locked" | "ready";
