import { Fingerprint, LockKeyhole } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AuthAside, AuthBrand } from "../components/Layout";
import { Button, PasswordField } from "../components/ui";
import {
  attemptPlatformAuthenticator,
  isPlatformAuthenticatorAvailable,
} from "../webauthn/unlock";
import { useVault } from "../state/VaultContext";

export function LockScreen() {
  const { unlockVault, reportError } = useVault();
  const [masterPassword, setMasterPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [platformBusy, setPlatformBusy] = useState(false);
  const [platformAvailable, setPlatformAvailable] = useState(false);
  const [platformMessage, setPlatformMessage] = useState<string | undefined>();

  useEffect(() => {
    let active = true;
    void isPlatformAuthenticatorAvailable().then((available) => {
      if (active) setPlatformAvailable(available);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (masterPassword.length === 0) {
      reportError(new Error("Enter your master password to unlock the vault."));
      return;
    }

    setBusy(true);
    try {
      await unlockVault(masterPassword);
      setMasterPassword("");
    } catch (error: unknown) {
      reportError(error);
      setMasterPassword("");
    } finally {
      setBusy(false);
    }
  }

  async function handlePlatformAuthenticator() {
    setPlatformBusy(true);
    setPlatformMessage(undefined);
    const result = await attemptPlatformAuthenticator();
    setPlatformMessage(result.message);
    setPlatformBusy(false);
  }

  return (
    <div className="flex min-h-screen bg-[#ecfdf9]">
      <AuthAside
        title="Welcome back to your private space."
        description="Unlock once and your encrypted cards, accounts, and password history are available only in this local session."
      />
      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <AuthBrand />
          </div>
          <div className="mb-8">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-ocean-100 text-ocean-700">
              <LockKeyhole size={22} strokeWidth={1.8} />
            </div>
            <p className="eyebrow">Vault locked</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-900">Unlock V-Vault</h1>
            <p className="mt-3 text-sm leading-6 text-ink-500">
              Enter your master password to open the current local session.
            </p>
          </div>

          <div className={platformAvailable ? "grid gap-6 md:grid-cols-2" : undefined}>
            <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
              <PasswordField
                autoComplete="current-password"
                autoFocus
                label="Master password"
                onChange={(event) => setMasterPassword(event.target.value)}
                placeholder="Enter your master password"
                value={masterPassword}
              />
              <Button className="w-full" disabled={busy} size="lg" type="submit">
                {busy ? "Unlocking…" : "Unlock vault"}
              </Button>
            </form>

            {platformAvailable ? (
              <div className="flex flex-col justify-end">
                <div className="mb-5 flex items-center gap-3 md:mt-7">
                  <span className="h-px flex-1 bg-ink-200" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink-400">or</span>
                  <span className="h-px flex-1 bg-ink-200" />
                </div>
                <Button
                  className="w-full"
                  disabled={platformBusy}
                  onClick={() => void handlePlatformAuthenticator()}
                  variant="secondary"
                >
                  <Fingerprint size={17} strokeWidth={1.8} />
                  {platformBusy ? "Checking platform authenticator…" : "Windows se unlock"}
                </Button>
                {platformMessage ? (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
                    {platformMessage}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <p className="mt-8 text-center text-xs leading-5 text-ink-400">
            The local backend currently accepts only <code className="rounded bg-ink-100 px-1 py-0.5 text-[11px]">masterPassword</code> for unlock.
          </p>
        </div>
      </main>
    </div>
  );
}
