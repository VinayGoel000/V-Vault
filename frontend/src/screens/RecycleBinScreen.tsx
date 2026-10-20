import { RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, LoadingState, SectionHeading } from "../components/ui";
import { api } from "../api/client";
import { useToast } from "../state/ToastContext";
import { useVault } from "../state/VaultContext";
import type { RecycleBinAccount, RecycleBinCard } from "../api/types";

function deletedDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function RecycleBinScreen() {
  const { reportError, refreshCards } = useVault();
  const { success } = useToast();
  const [cards, setCards] = useState<RecycleBinCard[]>([]);
  const [accounts, setAccounts] = useState<RecycleBinAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await api.listRecycleBin();
    setCards(result.cards);
    setAccounts(result.accounts);
  }, []);

  useEffect(() => {
    void load()
      .catch((error: unknown) => reportError(error))
      .finally(() => setLoading(false));
  }, [load, reportError]);

  async function restoreCard(id: string) {
    setBusyId(id);
    try {
      await api.restoreCard(id);
      await Promise.all([load(), refreshCards()]);
      success("Card restored.");
    } catch (error: unknown) {
      reportError(error);
    } finally {
      setBusyId(null);
    }
  }

  async function restoreAccount(id: string) {
    setBusyId(id);
    try {
      await api.restoreAccount(id);
      await load();
      await refreshCards();
      success("Account restored.");
    } catch (error: unknown) {
      reportError(error);
    } finally {
      setBusyId(null);
    }
  }

  async function permanentlyDelete(kind: "card" | "account", id: string, label: string) {
    if (!window.confirm(`Delete “${label}” forever? This cannot be undone.`)) return;
    setBusyId(id);
    try {
      if (kind === "card") await api.permanentlyDeleteCard(id);
      else await api.permanentlyDeleteAccount(id);
      await load();
      success("Deleted forever.");
    } catch (error: unknown) {
      reportError(error);
    } finally {
      setBusyId(null);
    }
  }

  const empty = cards.length === 0 && accounts.length === 0;

  return (
    <>
      <SectionHeading
        description="Deleted cards and accounts stay here for 30 days before they are permanently purged."
        eyebrow="Recovery"
        title="Recycle Bin"
      />
      {loading ? <LoadingState label="Loading deleted items" /> : empty ? (
        <EmptyState
          description="Items you move out of the vault will appear here for recovery."
          title="Recycle Bin is empty"
        />
      ) : (
        <div className="space-y-5">
          {cards.length > 0 ? (
            <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card sm:p-7">
              <h2 className="font-display text-xl font-bold text-ink-900">Cards</h2>
              <div className="mt-5 divide-y divide-ink-100">
                {cards.map((card) => (
                  <div className="flex flex-wrap items-center justify-between gap-4 py-4" key={card.id}>
                    <div>
                      <p className="font-semibold text-ink-900">{card.name}</p>
                      <p className="mt-1 text-xs text-ink-500">Deleted {deletedDate(card.deletedAt)} · {card.daysLeft} days left</p>
                    </div>
                    <div className="flex gap-2">
                      <Button disabled={busyId === card.id} onClick={() => void restoreCard(card.id)} size="sm" variant="secondary">
                        <RotateCcw size={15} /> Restore
                      </Button>
                      <Button disabled={busyId === card.id} onClick={() => void permanentlyDelete("card", card.id, card.name)} size="sm" variant="danger">
                        <Trash2 size={15} /> Delete forever
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {accounts.length > 0 ? (
            <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card sm:p-7">
              <h2 className="font-display text-xl font-bold text-ink-900">Accounts</h2>
              <div className="mt-5 divide-y divide-ink-100">
                {accounts.map((account) => (
                  <div className="flex flex-wrap items-center justify-between gap-4 py-4" key={account.id}>
                    <div>
                      <p className="font-semibold text-ink-900">{account.email}</p>
                      <p className="mt-1 text-xs text-ink-500">Deleted {deletedDate(account.deletedAt)} · {account.daysLeft} days left</p>
                    </div>
                    <div className="flex gap-2">
                      <Button disabled={busyId === account.id} onClick={() => void restoreAccount(account.id)} size="sm" variant="secondary">
                        <RotateCcw size={15} /> Restore
                      </Button>
                      <Button disabled={busyId === account.id} onClick={() => void permanentlyDelete("account", account.id, account.email)} size="sm" variant="danger">
                        <Trash2 size={15} /> Delete forever
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
