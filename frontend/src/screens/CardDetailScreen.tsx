import { ArrowLeft, Mail, Pencil, Plus, RefreshCw, Trash2, UserRound } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Button,
  EmptyState,
  LoadingState,
  Modal,
  PasswordField,
  SectionHeading,
  TextArea,
  TextField,
} from "../components/ui";
import { api } from "../api/client";
import { useToast } from "../state/ToastContext";
import { useVault } from "../state/VaultContext";
import type { AccountSummary } from "../api/types";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function CardDetailScreen() {
  const { cardId = "" } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const { cards, refreshCards, reportError } = useVault();
  const { success } = useToast();
  const card = useMemo(() => cards.find((candidate) => candidate.id === cardId), [cards, cardId]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState("");
  const [accountForm, setAccountForm] = useState({
    email: "",
    username: "",
    password: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!cardId) return;
    setLoading(true);
    void api
      .listAccounts(cardId)
      .then(setAccounts)
      .catch((error: unknown) => reportError(error))
      .finally(() => setLoading(false));
  }, [cardId, reportError]);

  useEffect(() => {
    if (card) setName(card.name);
  }, [card]);

  if (!card) {
    return <LoadingState label="Opening card" />;
  }
  const activeCard = card;

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = name.trim();
    if (nextName.length === 0) return;
    setBusy(true);
    try {
      await api.renameCard(activeCard.id, nextName);
      await refreshCards();
      setRenameOpen(false);
      success("Card name updated.");
    } catch (error: unknown) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete “${activeCard.name}” and all of its accounts?`)) return;
    setBusy(true);
    try {
      await api.deleteCard(activeCard.id);
      await refreshCards();
      success("Card deleted.");
      navigate("/");
    } catch (error: unknown) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const created = await api.createAccount(activeCard.id, {
        email: accountForm.email,
        password: accountForm.password,
        ...(accountForm.username.trim().length > 0
          ? { username: accountForm.username.trim() }
          : {}),
        ...(accountForm.notes.length > 0 ? { notes: accountForm.notes } : {}),
      });
      setAccounts((current) => [...current, created]);
      await refreshCards();
      setAddOpen(false);
      setAccountForm({ email: "", username: "", password: "", notes: "" });
      success("Account added.");
    } catch (error: unknown) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateAccountPassword() {
    setGenerating(true);
    try {
      const password = await api.generatePassword({
        length: 18,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
      });
      setAccountForm((current) => ({ ...current, password }));
    } catch (error: unknown) {
      reportError(error);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <div className="mb-7">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 transition hover:text-ocean-700" to="/">
          <ArrowLeft size={16} />
          Back to vault
        </Link>
      </div>
      <SectionHeading
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setRenameOpen(true)} variant="secondary">
              <Pencil size={15} />
              Rename
            </Button>
            <Button disabled={busy} onClick={() => void handleDelete()} variant="danger">
              <Trash2 size={15} />
              Delete
            </Button>
          </div>
        }
        description={`${activeCard.accountCount} ${activeCard.accountCount === 1 ? "account" : "accounts"} in this collection.`}
        eyebrow="Vault card"
        title={activeCard.name}
      />

      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-ink-900">Accounts</h2>
          <p className="mt-1 text-sm text-ink-500">Choose an account to view its password and history.</p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm">
          <Plus size={16} />
          Add account
        </Button>
      </div>

      {loading ? (
        <LoadingState label="Loading accounts" />
      ) : accounts.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={() => setAddOpen(true)}>
              <Plus size={17} />
              Add the first account
            </Button>
          }
          description="Store the email, username, password, and notes you need for this service."
          title="No accounts in this card yet"
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
          <div className="hidden grid-cols-[1.4fr_1fr_1fr_120px] gap-4 border-b border-ink-100 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400 sm:grid">
            <span>Account</span>
            <span>Username</span>
            <span>Last updated</span>
            <span />
          </div>
          <div className="divide-y divide-ink-100">
            {accounts.map((account) => (
              <Link
                className="grid gap-3 px-5 py-4 transition hover:bg-ocean-50/60 sm:grid-cols-[1.4fr_1fr_1fr_120px] sm:items-center sm:gap-4"
                key={account.id}
                to={`/vault/${activeCard.id}/account/${account.id}`}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink-800">
                    <Mail className="shrink-0 text-ocean-600" size={15} />
                    <span className="truncate">{account.email}</span>
                  </span>
                  <span className="mt-1 block text-xs text-ink-400 sm:hidden">{account.username || "No username"}</span>
                </span>
                <span className="hidden items-center gap-2 truncate text-sm text-ink-600 sm:flex">
                  <UserRound className="shrink-0 text-ink-400" size={15} />
                  {account.username || "No username"}
                </span>
                <span className="hidden text-sm text-ink-500 sm:block">{formatDate(account.updatedAt)}</span>
                <span className="text-xs font-semibold text-ocean-700 sm:text-right">View account →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {renameOpen ? (
        <Modal
          onClose={() => setRenameOpen(false)}
          title="Rename card"
          footer={
            <>
              <Button onClick={() => setRenameOpen(false)} variant="ghost">
                Cancel
              </Button>
              <Button disabled={busy || name.trim().length === 0} form="rename-card-form" type="submit">
                {busy ? "Saving…" : "Save name"}
              </Button>
            </>
          }
        >
          <form id="rename-card-form" onSubmit={(event) => void handleRename(event)}>
            <TextField
              autoFocus
              label="Card name"
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </form>
        </Modal>
      ) : null}

      {addOpen ? (
        <Modal
          description="Passwords are encrypted by the backend and are only returned when you open an account."
          onClose={() => setAddOpen(false)}
          title="Add an account"
          wide
          footer={
            <>
              <Button onClick={() => setAddOpen(false)} variant="ghost">
                Cancel
              </Button>
              <Button disabled={busy} form="add-account-form" type="submit">
                {busy ? "Adding…" : "Add account"}
              </Button>
            </>
          }
        >
          <form className="grid gap-5 sm:grid-cols-2" id="add-account-form" onSubmit={(event) => void handleAddAccount(event)}>
            <TextField
              autoFocus
              autoComplete="email"
              label="Email"
              onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="name@example.com"
              required
              type="email"
              value={accountForm.email}
            />
            <TextField
              autoComplete="username"
              label="Username"
              onChange={(event) => setAccountForm((current) => ({ ...current, username: event.target.value }))}
              placeholder="Your username"
              value={accountForm.username}
            />
            <PasswordField
              autoComplete="new-password"
              label="Password"
              onChange={(event) => setAccountForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Enter the account password"
              required
              value={accountForm.password}
            />
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={generating}
                onClick={() => void handleGenerateAccountPassword()}
                size="sm"
                type="button"
                variant="secondary"
              >
                <RefreshCw size={14} />
                {generating ? "Generating…" : "Generate password"}
              </Button>
            </div>
            <div className="sm:col-span-2">
              <TextArea
                label="Notes"
                onChange={(event) => setAccountForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Optional recovery details or reminders"
                value={accountForm.notes}
              />
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
