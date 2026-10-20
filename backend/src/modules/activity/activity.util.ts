import { randomUUID } from "node:crypto";
import type { Vault } from "../../../../db";

export interface ActivityEvent {
  id: string;
  type: string;
  entityType: "card" | "account" | "vault" | "import";
  entityLabel: string;
  createdAt: string;
}

type ActivityInput = Omit<ActivityEvent, "id" | "createdAt" | "entityLabel"> & {
  at?: string;
  createdAt?: string;
  entityLabel?: string;
  entityId?: string;
  details?: Record<string, boolean | number | string | null>;
};

/** Activity entries live inside the already encrypted vault payload. */
export function appendActivity(
  vault: Vault,
  _key: Buffer,
  event: ActivityInput,
): void {
  const imported = event.details?.imported;
  const skipped =
    Number(event.details?.skipped ?? event.details?.skippedDuplicates ?? 0) +
    Number(event.details?.skippedInvalid ?? 0);
  const entityLabel =
    event.entityLabel ??
    (event.type === "import_completed" && typeof imported === "number"
      ? `${imported} imported, ${skipped} skipped`
      : event.entityId ?? "");
  const value: ActivityEvent = {
    id: randomUUID(),
    type: event.type.toUpperCase(),
    entityType: event.entityType,
    entityLabel,
    createdAt: event.createdAt ?? event.at ?? new Date().toISOString(),
  };
  vault.activityLog = [...(vault.activityLog ?? []), value].slice(-500);
}
