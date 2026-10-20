import { ShieldCheck } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { AuthAside, AuthBrand } from "../components/Layout";
import { Button, PasswordField } from "../components/ui";
import { useVault } from "../state/VaultContext";
import { ApiError } from "../api/client";

function passwordStrength(password: string): { label: string; width: string; tone: string } {
  if (password.length === 0) {
    return { label: "Choose a strong passphrase", width: "w-0", tone: "bg-ink-200" };
  }
  if (password.length < 8) {
    return { label: "Too short", width: "w-1/4", tone: "bg-red-400" };
  }
  if (password.length < 12) {
    return { label: "Good start", width: "w-2/4", tone: "bg-amber-400" };
  }
  if (password.length < 16) {
    return { label: "Strong", width: "w-3/4", tone: "bg-ocean-400" };
  }
  return { label: "Excellent", width: "w-full", tone: "bg-ocean-600" };
}

export function SetupScreen() {
  const { setupVault, reportError, markLocked } = useVault();
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState<string | undefined>();
  const strength = useMemo(() => passwordStrength(masterPassword), [masterPassword]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (masterPassword.length === 0) {
      setValidation("Enter a master password to continue.");
      return;
    }
    if (masterPassword !== confirmation) {
      setValidation("The passwords do not match.");
      return;
    }

    setValidation(undefined);
    setBusy(true);
    try {
      await setupVault(masterPassword);
      setMasterPassword("");
      setConfirmation("");
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 409) {
        markLocked();
        return;
      }
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#ecfdf9]">
      <AuthAside
        title="Your keys stay yours."
        description="V-Vault keeps the encrypted vault on your machine. No account, cloud sync, or remote copy is required."
      />
      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <AuthBrand />
          </div>
          <div className="mb-8">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-ocean-100 text-ocean-700">
              <ShieldCheck size={22} strokeWidth={1.8} />
            </div>
            <p className="eyebrow">First-time setup</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-900">Create your vault</h1>
            <p className="mt-3 text-sm leading-6 text-ink-500">
              Set one master password. It is the only password V-Vault needs and it cannot be recovered for you.
            </p>
          </div>

          <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
            <PasswordField
              autoComplete="new-password"
              label="Master password"
              onChange={(event) => setMasterPassword(event.target.value)}
              placeholder="Create a memorable passphrase"
              value={masterPassword}
            />
            <div>
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-ink-500">
                <span>Password strength</span>
                <span>{strength.label}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                <div className={`h-full rounded-full transition-all ${strength.width} ${strength.tone}`} />
              </div>
            </div>
            <PasswordField
              autoComplete="new-password"
              error={validation}
              label="Confirm master password"
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Repeat your passphrase"
              value={confirmation}
            />
            <Button className="w-full" disabled={busy} size="lg" type="submit">
              {busy ? "Creating your vault…" : "Create vault"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs leading-5 text-ink-400">
            Your master password is used to derive the vault key and is never saved in the browser.
          </p>
        </div>
      </main>
    </div>
  );
}
