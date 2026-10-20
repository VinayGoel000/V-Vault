import { Activity as ActivityIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState, LoadingState, SectionHeading } from "../components/ui";
import { api } from "../api/client";
import { useVault } from "../state/VaultContext";
import type { ActivityLogEntry } from "../api/types";

const labels: Record<string, string> = {
  VAULT_SETUP: "Vault setup",
  VAULT_UNLOCK: "Vault unlocked",
  VAULT_LOCK: "Vault locked",
  CARD_CREATED: "Card created",
  CARD_RENAMED: "Card renamed",
  CARD_DELETED: "Card moved to Recycle Bin",
  CARD_RESTORED: "Card restored",
  ACCOUNT_CREATED: "Account created",
  ACCOUNT_UPDATED: "Account updated",
  PASSWORD_CHANGED: "Password changed",
  ACCOUNT_DELETED: "Account moved to Recycle Bin",
  ACCOUNT_RESTORED: "Account restored",
  ACCOUNT_PERMANENTLY_DELETED: "Account permanently deleted",
  IMPORT_COMPLETED: "Import completed",
};

function displayDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ActivityScreen() {
  const { reportError } = useVault();
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api.listActivity(100)
      .then(setEntries)
      .catch((error: unknown) => reportError(error))
      .finally(() => setLoading(false));
  }, [reportError]);

  return (
    <>
      <SectionHeading description="A read-only timeline of changes made in this local vault." eyebrow="Audit trail" title="Activity" />
      {loading ? <LoadingState label="Loading activity" /> : entries.length === 0 ? (
        <EmptyState description="Vault activity will appear here as you work." title="No activity yet" />
      ) : (
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card sm:p-7">
          <div className="space-y-5">
            {entries.map((entry) => (
              <div className="grid gap-3 border-l-2 border-ocean-200 pl-5 sm:grid-cols-[180px_1fr] sm:border-l-0 sm:pl-0" key={entry.id}>
                <time className="text-xs font-semibold text-ink-400" dateTime={entry.createdAt}>{displayDate(entry.createdAt)}</time>
                <div className="flex items-start gap-3 text-sm text-ink-800">
                  <ActivityIcon className="mt-0.5 shrink-0 text-ocean-600" size={16} />
                  <span><strong>{labels[entry.type] ?? entry.type}</strong>{entry.entityLabel ? ` — ${entry.entityLabel}` : ""}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
