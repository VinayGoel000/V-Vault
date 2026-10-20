import { ArrowLeft, Copy, Eye, EyeOff, KeyRound, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, LoadingState, Modal, PasswordField, TextArea, TextField } from "../components/ui";
import { api } from "../api/client";
import { useToast } from "../state/ToastContext";
import { useVault } from "../state/VaultContext";
import type { AccountDetails, HistoryEntry, UpdateAccountRequest } from "../api/types";

function formatDate(value: string, includeTime = false): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function SecretValue({
  value,
  visible,
  onToggle,
  label,
  toggleable = true,
}: {
  value: string;
  visible: boolean;
  onToggle: () => void;
  label: string;
  toggleable?: boolean;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-xl border border-ink-200 bg-ink-50 px-3.5">
      <code className="min-w-0 flex-1 truncate text-sm text-ink-800">
        {visible ? value : "••••••••••••••••"}
      </code>
      {toggleable ? (
        <button
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          className="shrink-0 rounded-lg p-1.5 text-ink-400 transition hover:bg-white hover:text-ocean-700"
          onClick={onToggle}
          type="button"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      ) : null}
    </div>
  );
}

export function AccountDetailScreen() {
  const { cardId = "", accountId = "" } = useParams<{ cardId: string; accountId: string }>();
  const navigate = useNavigate();
  const { reportError } = useVault();
  const { success } = useToast();
  const [account, setAccount] = useState<AccountDetails | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ email: "", username: "", notes: "" });
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);

  async function loadAccount() {
    const [nextAccount, nextHistory] = await Promise.all([
      api.getAccount(accountId),
      api.listHistory(accountId),
    ]);
    setAccount(nextAccount);
    setHistory(nextHistory);
    setForm({
      email: nextAccount.email,
      username: nextAccount.username,
      notes: nextAccount.notes ?? "",
    });
  }

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    void loadAccount()
      .catch((error: unknown) => reportError(error))
      .finally(() => setLoading(false));
    // The account id is the resource identity for this request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, reportError]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const update: UpdateAccountRequest = {
        email: form.email,
        notes: form.notes.length > 0 ? form.notes : null,
      };
      if (form.username.trim().length > 0) {
        update.username = form.username.trim();
      }
      const summary = await api.updateAccount(accountId, update);
      setAccount((current) => (current ? { ...current, ...summary } : current));
      setEditing(false);
      success("Account details updated.");
    } catch (error: unknown) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length === 0) return;
    setBusy(true);
    try {
      await api.changePassword(accountId, newPassword);
      await loadAccount();
      setNewPassword("");
      setPasswordModalOpen(false);
      success("Password changed. The previous password is in history.");
    } catch (error: unknown) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  async function handleGeneratePassword() {
    setGenerating(true);
    try {
      const password = await api.generatePassword({
        length: 20,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
      });
      setNewPassword(password);
    } catch (error: unknown) {
      reportError(error);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      success(`${label} copied to clipboard.`);
      if (label === "Password" || label === "Historical password") {
        window.setTimeout(() => {
          void navigator.clipboard.writeText("");
        }, 30_000);
      }
    } catch {
      reportError(new Error("Could not copy to the clipboard."));
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this account and its password history?")) return;
    setBusy(true);
    try {
      await api.deleteAccount(accountId);
      success("Account deleted.");
      navigate(`/vault/${cardId}`);
    } catch (error: unknown) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  if (loading || account === null) {
    return <LoadingState label="Opening account" />;
  }

  return (
    <>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-ink-500 transition hover:text-ocean-700"
          to={`/vault/${cardId}`}
        >
          <ArrowLeft size={16} />
          Back to card
        </Link>
        <Button disabled={busy} onClick={() => void handleDelete()} size="sm" variant="danger">
          <Trash2 size={15} />
          Delete account
        </Button>
      </div>

      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Account details</p>
          <h1 className="mt-2 break-all font-display text-3xl font-bold tracking-tight text-ink-900">{account.email}</h1>
          <p className="mt-2 text-sm text-ink-500">{account.username || "No username"} · Updated {formatDate(account.updatedAt)}</p>
        </div>
        <Button onClick={() => setEditing((current) => !current)} variant="secondary">
          <Pencil size={15} />
          {editing ? "Close editor" : "Edit details"}
        </Button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <button
          className="rounded-xl border border-ink-100 bg-white px-4 py-3 text-left shadow-card transition hover:border-ocean-200 hover:bg-ocean-50"
          onClick={() => void handleCopy(account.email, "Email")}
          type="button"
        >
          <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400">Email · click to copy</span>
          <span className="mt-1 block truncate text-sm font-semibold text-ink-800">{account.email}</span>
        </button>
        <button
          className="rounded-xl border border-ink-100 bg-white px-4 py-3 text-left shadow-card transition hover:border-ocean-200 hover:bg-ocean-50"
          disabled={!account.username}
          onClick={() => {
            if (account.username) void handleCopy(account.username, "Username");
          }}
          type="button"
        >
          <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400">Username{account.username ? " · click to copy" : ""}</span>
          <span className="mt-1 block truncate text-sm font-semibold text-ink-800">{account.username || "Not provided"}</span>
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Current secret</p>
              <h2 className="mt-2 font-display text-xl font-bold text-ink-900">Password</h2>
            </div>
            <span className="rounded-full bg-ocean-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ocean-700">
              Decrypted on request
            </span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="min-w-0 flex-1">
              <SecretValue
                label="password"
                onToggle={() => undefined}
                value={account.password}
                toggleable={false}
                visible
              />
            </div>
            <Button onClick={() => void handleCopy(account.password, "Password")} variant="secondary">
              <Copy size={16} />
              Copy
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap gap-3 border-t border-ink-100 pt-5">
            <Button onClick={() => setPasswordModalOpen(true)}>
              <RefreshCw size={16} />
              Change password
            </Button>
            <Link className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-ink-500 transition hover:bg-ink-50 hover:text-ink-800" to="/generator">
              Open generator
            </Link>
          </div>
        </section>

        {editing ? (
          <section className="rounded-2xl border border-ocean-200 bg-ocean-50/60 p-5 sm:p-7 xl:row-span-2">
            <div className="mb-6">
              <p className="eyebrow">Account profile</p>
              <h2 className="mt-2 font-display text-xl font-bold text-ink-900">Edit details</h2>
            </div>
            <form className="space-y-5" onSubmit={(event) => void handleSave(event)}>
              <TextField
                autoComplete="email"
                label="Email"
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
                type="email"
                value={form.email}
              />
              <TextField
                autoComplete="username"
                label="Username"
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                value={form.username}
              />
              <TextArea
                label="Notes"
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                value={form.notes}
              />
              <Button className="w-full" disabled={busy} type="submit">
                {busy ? "Saving…" : "Save details"}
              </Button>
            </form>
          </section>
        ) : (
          <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card sm:p-7">
            <p className="eyebrow">Notes</p>
            <h2 className="mt-2 font-display text-xl font-bold text-ink-900">Account context</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ink-600">
              {account.notes || "No notes added for this account."}
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Password history</p>
              <h2 className="mt-2 font-display text-xl font-bold text-ink-900">Previous passwords</h2>
            </div>
            <KeyRound className="text-ocean-500" size={20} strokeWidth={1.7} />
          </div>
          {history.length === 0 ? (
            <p className="rounded-xl bg-ink-50 px-4 py-4 text-sm leading-6 text-ink-500">
              Previous passwords will appear here after the first change.
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((entry, index) => {
                return (
                  <div className="rounded-xl border border-ink-100 p-3.5" key={`${entry.changedAt}-${index}`}>
                    <div className="flex items-center justify-between gap-3">
                      <SecretValue
                        label={`history password ${index + 1}`}
                        onToggle={() => undefined}
                        toggleable={false}
                        value={entry.password}
                        visible
                      />
                      <button
                        aria-label="Copy historical password"
                        className="rounded-lg p-2 text-ink-400 transition hover:bg-ocean-50 hover:text-ocean-700"
                        onClick={() => void handleCopy(entry.password, "Historical password")}
                        type="button"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-ink-400">Changed {formatDate(entry.changedAt, true)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {passwordModalOpen ? (
        <Modal
          description="Changing the password moves the current value into this account's history."
          onClose={() => setPasswordModalOpen(false)}
          title="Change password"
          footer={
            <>
              <Button onClick={() => setPasswordModalOpen(false)} variant="ghost">
                Cancel
              </Button>
              <Button disabled={busy || newPassword.length === 0} form="change-password-form" type="submit">
                {busy ? "Changing…" : "Change password"}
              </Button>
            </>
          }
        >
          <form id="change-password-form" onSubmit={(event) => void handleChangePassword(event)}>
            <PasswordField
              autoFocus
              autoComplete="new-password"
              label="New password"
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Enter or generate a new password"
              value={newPassword}
            />
            <Button
              className="mt-3"
              disabled={generating}
              onClick={() => void handleGeneratePassword()}
              size="sm"
              variant="secondary"
            >
              <RefreshCw size={14} />
              {generating ? "Generating…" : "Generate a strong password"}
            </Button>
          </form>
        </Modal>
      ) : null}
    </>
  );
}
