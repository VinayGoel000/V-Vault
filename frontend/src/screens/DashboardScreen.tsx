import { Plus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, EmptyState, LoadingState, Modal, SectionHeading, TextField } from "../components/ui";
import { api } from "../api/client";
import { useToast } from "../state/ToastContext";
import { useVault } from "../state/VaultContext";

export function DashboardScreen() {
  const navigate = useNavigate();
  const { cards, refreshCards, reportError } = useVault();
  const { success } = useToast();
  const [loading, setLoading] = useState(true);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshCards()
      .catch((error: unknown) => reportError(error))
      .finally(() => setLoading(false));
  }, [refreshCards, reportError]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length === 0) return;
    setBusy(true);
    try {
      await api.createCard(trimmedName);
      await refreshCards();
      setName("");
      setNewCardOpen(false);
      success("Vault card created.");
    } catch (error: unknown) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionHeading
        action={
          <Button onClick={() => setNewCardOpen(true)}>
            <Plus size={17} strokeWidth={2} />
            Add card
          </Button>
        }
        description="Keep related accounts together in simple, private collections."
        eyebrow="Your vault"
        title="Everything in its place."
      />

      {loading ? (
        <LoadingState label="Loading your vault cards" />
      ) : cards.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={() => setNewCardOpen(true)}>
              <Plus size={17} strokeWidth={2} />
              Create your first card
            </Button>
          }
          description="Start with a collection for work, personal accounts, or anything else you want close at hand."
          title="Your vault is ready for its first card"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
           {cards.map((card) => (
            <button
              className="vault-card group text-left"
              key={card.id}
              onClick={() => navigate(`/vault/${card.id}`)}
              type="button"
            >
              <span className="block truncate font-display text-xl font-bold tracking-tight text-ink-900 transition group-hover:text-ocean-700">
                {card.name}
              </span>
              <span className="mt-2 block text-sm font-medium text-ink-500">
                {card.accountCount} {card.accountCount === 1 ? "account" : "accounts"}
              </span>
             </button>
           ))}
          <button
            className="min-h-40 rounded-2xl border-2 border-dashed border-ocean-300 bg-ocean-50/70 p-6 text-left text-ocean-800 transition hover:border-ocean-500 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-400 focus-visible:ring-offset-2"
            onClick={() => setNewCardOpen(true)}
            type="button"
          >
            <span className="block text-4xl font-light leading-none text-ocean-700">+</span>
            <span className="mt-4 block font-display text-xl font-bold tracking-tight">Add Card</span>
          </button>
         </div>
      )}

      {newCardOpen ? (
        <Modal
          description="Cards contain account details and never display passwords in the overview."
          onClose={() => {
            setNewCardOpen(false);
            setName("");
          }}
          title="Create a vault card"
          footer={
            <>
              <Button onClick={() => setNewCardOpen(false)} variant="ghost">
                Cancel
              </Button>
              <Button disabled={busy || name.trim().length === 0} form="new-card-form" type="submit">
                {busy ? "Creating…" : "Create card"}
              </Button>
            </>
          }
        >
          <form id="new-card-form" onSubmit={(event) => void handleCreate(event)}>
            <TextField
              autoFocus
              hint="Use a name that helps you recognize this collection."
              label="Card name"
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Personal, Work, Finance"
              value={name}
            />
          </form>
        </Modal>
      ) : null}
    </>
  );
}
