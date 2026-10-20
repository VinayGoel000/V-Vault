import { randomUUID } from "node:crypto";
import type { Account, Card, CustomFieldRequest } from "../../../../db";
import { encryptAesGcm } from "../../crypto/aes-gcm";
import { HttpError } from "../../middleware/error-handler";
import {
  appendActivity,
  isActive,
  UnlockedService,
  nowIso,
} from "../base.service";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2_000;
const PREVIEW_TTL_MS = 10 * 60 * 1000;
const MASKED_PASSWORD = "********";

export type ImportSource = "chrome" | "bitwarden";

interface ImportRecord {
  rowNumber: number;
  cardName: string;
  email: string;
  username?: string;
  password: string;
  websiteUrl?: string;
  notes?: string;
  customFields: CustomFieldRequest[];
}

interface PendingImport {
  source: ImportSource;
  records: ImportRecord[];
  expiresAt: number;
  timeout: NodeJS.Timeout;
}

export interface ImportPreviewRow {
  row: number;
  cardName: string;
  email: string;
  username?: string;
  websiteUrl?: string;
  notes?: string;
  customFields: Array<{
    id: string;
    key: string;
    value: string;
    isSecret: boolean;
  }>;
  password: string;
  duplicate: boolean;
  error?: string;
}

export interface ImportPreview {
  previewId: string;
  format: ImportSource;
  source: ImportSource;
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
  source: ImportSource;
  imported: number;
  skipped: number;
  cardsCreated: number;
  skippedDuplicates: number;
  skippedInvalid: number;
  errors: Array<{ row: number; error: string }>;
}

interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase();
}

/** Small RFC 4180 parser that keeps the upload entirely in memory. */
function parseCsv(contents: string): ParsedCsv {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];
    if (quoted) {
      if (character === '"') {
        if (contents[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && contents[index + 1] === "\n") {
        index += 1;
      }
      row.push(field);
      field = "";
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new HttpError(400, "CSV contains an unterminated quoted field");
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
  }
  if (rows.length === 0) {
    throw new HttpError(400, "CSV is empty");
  }

  const headers = (rows.shift() ?? []).map(normalizeHeader);
  if (headers.length === 0 || headers.every((header) => header.length === 0)) {
    throw new HttpError(400, "CSV header is missing");
  }
  return { headers, rows };
}

function valueFor(headers: string[], row: string[], name: string): string {
  const index = headers.indexOf(name);
  return index < 0 ? "" : (row[index] ?? "").trim();
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function importEmail(value: string, rowNumber: number): string {
  if (isEmail(value)) return value;
  return `imported-${rowNumber}@v-vault.invalid`;
}

function validUrl(value: string): string | undefined {
  if (value.length === 0) return undefined;
  try {
    const url = new URL(value);
    return url.toString();
  } catch {
    return undefined;
  }
}

function parseBitwardenFields(value: string): CustomFieldRequest[] {
  if (value.length === 0) return [];
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf(":");
      const name = separator < 0 ? entry : entry.slice(0, separator).trim();
      const fieldValue = separator < 0 ? "" : entry.slice(separator + 1).trim();
      return {
      key: name.slice(0, 50) || "Imported field",
      value: fieldValue.slice(0, 1_000),
      isSecret: false,
      };
    });
}

function parseRecords(sourceValue: string, contents: Buffer): ImportRecord[] {
  if (contents.length > MAX_IMPORT_BYTES) {
    throw new HttpError(413, "CSV file is larger than 5 MB");
  }
  const parsed = parseCsv(contents.toString("utf8"));
  const source = parseSource(sourceValue, parsed.headers);
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    throw new HttpError(400, "CSV contains more than 2000 rows");
  }

  const records: ImportRecord[] = [];
  for (const [index, row] of parsed.rows.entries()) {
    const rowNumber = index + 2;
    let record: ImportRecord;
    if (source === "chrome") {
      if (!parsed.headers.includes("name") || !parsed.headers.includes("password")) {
        throw new HttpError(400, "Chrome CSV must include name and password columns");
      }
      const username = valueFor(parsed.headers, row, "username");
      record = {
        rowNumber,
        cardName: valueFor(parsed.headers, row, "name"),
        email: username.length > 0 ? importEmail(username, rowNumber) : "",
        username: username || undefined,
        password: valueFor(parsed.headers, row, "password"),
        websiteUrl: validUrl(valueFor(parsed.headers, row, "url")),
        notes: valueFor(parsed.headers, row, "note") || undefined,
        customFields: [],
      };
    } else {
      if (
        !parsed.headers.includes("name") ||
        !parsed.headers.includes("login_username") ||
        !parsed.headers.includes("login_password")
      ) {
        throw new HttpError(
          400,
          "Bitwarden CSV must include name, login_username, and login_password columns",
        );
      }
      const username = valueFor(parsed.headers, row, "login_username");
      record = {
        rowNumber,
        cardName: valueFor(parsed.headers, row, "folder") || valueFor(parsed.headers, row, "name"),
        email: username.length > 0 ? importEmail(username, rowNumber) : "",
        username: username || undefined,
        password: valueFor(parsed.headers, row, "login_password"),
        websiteUrl: validUrl(valueFor(parsed.headers, row, "login_uri")),
        notes: valueFor(parsed.headers, row, "notes") || undefined,
        customFields: parseBitwardenFields(
          valueFor(parsed.headers, row, "fields"),
        ),
      };
    }
    records.push(record);
  }
  return records;
}

function recordKey(record: Pick<ImportRecord, "cardName" | "username">): string {
  return [record.cardName, record.username ?? ""]
    .map((value) => value.trim().toLowerCase())
    .join("\u0000");
}

function toPreviewRow(
  record: ImportRecord,
  duplicate: boolean,
  error?: string,
): ImportPreviewRow {
  return {
    row: record.rowNumber,
    cardName: record.cardName,
    email: record.email,
    username: record.username,
    websiteUrl: record.websiteUrl,
    notes: record.notes,
    customFields: record.customFields.map((field) => ({
      id: randomUUID(),
      key: field.key,
      value: field.isSecret ? MASKED_PASSWORD : field.value,
      isSecret: field.isSecret,
    })),
    password: MASKED_PASSWORD,
    duplicate,
    error,
  };
}

function recordError(record: ImportRecord): string | undefined {
  if (record.cardName.length === 0) return "Name is required";
  if (record.cardName.length > 200) return "Name must be at most 200 characters";
  if (record.username !== undefined && record.username.length > 200) {
    return "Username must be at most 200 characters";
  }
  if (!isEmail(record.email)) return "Username is required";
  if (record.password.length === 0) return "Password is required";
  if (record.notes !== undefined && record.notes.length > 2_000) {
    return "Notes must be at most 2000 characters";
  }
  if (record.customFields.length > 20) return "Too many custom fields";
  if (
    record.customFields.some(
      (field) =>
        field.key.length === 0 ||
        field.key.length > 50 ||
        field.value.length > 1_000,
    )
  ) {
    return "Custom field is invalid";
  }
  return undefined;
}

export class ImportService extends UnlockedService {
  private readonly pending = new Map<string, PendingImport>();

  public async preview(
    sourceValue: string,
    contents: Buffer,
  ): Promise<ImportPreview> {
    const source = parseSource(sourceValue, parseCsv(contents.toString("utf8")).headers)!;
    const records = parseRecords(source, contents);
    return this.withVault((vault) => {
      const existing = new Set<string>();
      for (const account of vault.accounts) {
        if (!isActive(account)) continue;
        const card = vault.cards.find(
          (candidate) => candidate.id === account.cardId && isActive(candidate),
        );
        if (card !== undefined) {
          existing.add(recordKey({
            cardName: card.name,
            username: account.username,
          }));
        }
      }

      const seen = new Set(existing);
      let duplicateRows = 0;
      let invalidRows = 0;
      const rows = records.map((record) => {
        const error = recordError(record);
        const duplicate = error === undefined && seen.has(recordKey(record));
        if (error !== undefined) invalidRows += 1;
        if (duplicate) duplicateRows += 1;
        if (error === undefined && !duplicate) seen.add(recordKey(record));
        return toPreviewRow(record, duplicate, error);
      });

      const previewId = randomUUID();
      const timeout = setTimeout(() => this.pending.delete(previewId), PREVIEW_TTL_MS);
      timeout.unref();
      this.pending.set(previewId, {
        source,
        records,
        expiresAt: Date.now() + PREVIEW_TTL_MS,
        timeout,
      });
       const cardMapping: Record<string, string> = {};
       for (const record of records) cardMapping[record.cardName] = record.cardName;
       return {
         previewId,
         format: source,
         source,
         totalRows: records.length,
          validRows: records.length - invalidRows - duplicateRows,
         skippedRows: duplicateRows + invalidRows,
         duplicateRows,
         invalidRows,
         preview: rows.slice(0, 10),
         rows,
         cardMapping,
       };
    });
  }

  public async commit(
    sourceValue: string,
    previewId: string | undefined,
    contents: Buffer | undefined,
  ): Promise<ImportCommitResult> {
    let source: ImportSource;
    let records: ImportRecord[];
    let pendingId: string | undefined;
    if (previewId !== undefined && previewId.length > 0) {
      const pending = this.pending.get(previewId);
      if (
        pending === undefined || pending.expiresAt <= Date.now()
      ) {
        throw new HttpError(400, "Import preview has expired or is invalid");
      }
      const requestedSource = parseSource(sourceValue);
      if (requestedSource !== undefined && requestedSource !== pending.source) {
        throw new HttpError(400, "Import source does not match the preview");
      }
      source = pending.source;
      records = pending.records;
      pendingId = previewId;
    } else if (contents !== undefined) {
      source = parseSource(sourceValue, parseCsv(contents.toString("utf8")).headers)!;
      records = parseRecords(source, contents);
    } else {
      throw new HttpError(400, "An import previewId or CSV file is required");
    }

    try {
      return await this.withVault(async (vault, key) => {
        const existing = new Set<string>();
        const cardByName = new Map<string, Card>();
        for (const card of vault.cards) {
          if (isActive(card)) cardByName.set(card.name.toLowerCase(), card);
        }
        for (const account of vault.accounts) {
          if (!isActive(account)) continue;
          const card = vault.cards.find((candidate) => candidate.id === account.cardId);
          if (card !== undefined && isActive(card)) {
            existing.add(recordKey({
              cardName: card.name,
              username: account.username,
            }));
          }
        }

        let imported = 0;
        let cardsCreated = 0;
        let skippedDuplicates = 0;
        let skippedInvalid = 0;
        const errors: Array<{ row: number; error: string }> = [];
        for (const record of records) {
          const error = recordError(record);
          if (error !== undefined) {
            skippedInvalid += 1;
            errors.push({ row: record.rowNumber, error });
            continue;
          }
          const keyForRecord = recordKey(record);
          if (existing.has(keyForRecord)) {
            skippedDuplicates += 1;
            continue;
          }

          const cardNameKey = record.cardName.toLowerCase();
          let card = cardByName.get(cardNameKey);
          const timestamp = nowIso();
          if (card === undefined) {
            card = {
              id: randomUUID(),
              name: record.cardName,
              deletedAt: null,
              createdAt: timestamp,
              updatedAt: timestamp,
            };
            vault.cards.push(card);
            cardByName.set(cardNameKey, card);
            cardsCreated += 1;
            appendActivity(vault, key, {
              type: "card_created",
              at: timestamp,
              entityType: "card",
              entityId: card.id,
              entityLabel: card.name,
            });
          }

          const account: Account = {
            id: randomUUID(),
            cardId: card.id,
            email: record.email,
            username: record.username,
            websiteUrl: record.websiteUrl,
            password: encryptAesGcm(record.password, key),
            notes: record.notes,
            customFields: record.customFields.map((field) =>
              field.isSecret
                ? { id: field.id ?? randomUUID(), key: field.key, value: encryptAesGcm(field.value, key), isSecret: true }
                : { id: field.id ?? randomUUID(), key: field.key, value: field.value, isSecret: false },
            ),
            history: [],
            deletedAt: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          vault.accounts.push(account);
          existing.add(keyForRecord);
          imported += 1;
          appendActivity(vault, key, {
            type: "account_created",
            at: timestamp,
            entityType: "account",
            entityId: account.id,
            entityLabel: account.email,
          });
        }

        appendActivity(vault, key, {
          type: "import_completed",
          at: nowIso(),
          entityType: "import",
          details: {
            source,
            imported,
            skippedDuplicates,
            skippedInvalid,
          },
        });
        await this.repository.save(vault, key);
        return {
          source,
          imported,
          skipped: skippedDuplicates + skippedInvalid,
          cardsCreated,
          skippedDuplicates,
          skippedInvalid,
          errors,
        };
      });
    } finally {
      if (pendingId !== undefined) {
        const pending = this.pending.get(pendingId);
        if (pending !== undefined) clearTimeout(pending.timeout);
        this.pending.delete(pendingId);
      }
    }
  }
}

function parseSource(value: string, headers?: string[]): ImportSource | undefined {
  if (value === "chrome" || value === "bitwarden") return value;
  if (value.length > 0) {
    throw new HttpError(400, "Import format must be Chrome or Bitwarden");
  }
  if (headers?.includes("login_username") && headers.includes("login_password")) {
    return "bitwarden";
  }
  if (headers?.includes("name") && headers.includes("username") && headers.includes("password")) {
    return "chrome";
  }
  throw new HttpError(400, "CSV header does not match Chrome or Bitwarden format");
}

export function getUploadedFile(
  files: unknown,
): Express.Multer.File | undefined {
  if (!Array.isArray(files)) return undefined;
  return files.find((file): file is Express.Multer.File =>
    typeof file === "object" && file !== null && "buffer" in file,
  );
}
