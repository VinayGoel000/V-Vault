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
  deletedAt: string | null;
}

export interface CardSummary extends Card {
  accountCount: number;
}

export interface AccountSummary {
  id: string;
  cardId: string;
  email: string;
  username?: string;
  websiteUrl?: string;
  notes?: string;
  customFields: CustomField[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountDetails extends AccountSummary {
  password: string;
}

export interface CustomField {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
}

export interface CustomFieldRequest {
  id?: string;
  key: string;
  value: string;
  isSecret: boolean;
}

export interface HistoryEntry {
  password: string;
  changedAt: string;
}

export interface CreateAccountRequest {
  email: string;
  username?: string;
  password: string;
  websiteUrl?: string;
  notes?: string;
  customFields?: CustomFieldRequest[];
}

export interface UpdateAccountRequest {
  email?: string;
  username?: string;
  notes?: string | null;
  websiteUrl?: string | null;
  customFields?: CustomFieldRequest[];
}

export interface RecycleBinCard extends Card {
  deletedAt: string;
  daysLeft: number;
}

export interface RecycleBinAccount extends AccountSummary {
  deletedAt: string;
  daysLeft: number;
}

export interface ActivityLogEntry {
  id: string;
  type: string;
  entityType: "vault" | "card" | "account" | "import";
  entityLabel: string;
  createdAt: string;
}

export type ImportFormat = "chrome" | "bitwarden";

export interface ImportPreviewRow {
  row: number;
  cardName: string;
  email: string;
  username?: string;
  websiteUrl?: string;
  notes?: string;
  customFields: CustomField[];
  password: string;
  duplicate: boolean;
  error?: string;
}

export interface ImportPreview {
  previewId: string;
  format: ImportFormat;
  source: ImportFormat;
  totalRows: number;
  validRows: number;
  skippedRows: number;
  duplicateRows: number;
  invalidRows: number;
  preview: ImportPreviewRow[];
  rows: ImportPreviewRow[];
  cardMapping: Record<string, string>;
}

export interface ImportCommitResult {
  source: ImportFormat;
  imported: number;
  skipped: number;
  cardsCreated: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  errors: Array<{ row: number; error: string }>;
}

export type LeakStatus = "leaked" | "safe" | "unknown";

export interface LeakCheckResult {
  accountId: string;
  status: LeakStatus;
  count: number | null;
  checkedAt: string;
  cached: boolean;
}

export interface PasswordGeneratorRequest {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
}

export type VaultStage = "boot" | "setup" | "locked" | "ready";
