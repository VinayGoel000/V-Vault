import { Check, Copy, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button, SectionHeading, TextField } from "../components/ui";
import { api } from "../api/client";
import { useToast } from "../state/ToastContext";
import { useVault } from "../state/VaultContext";
import type { PasswordGeneratorRequest } from "../api/types";

const initialOptions: PasswordGeneratorRequest = {
  length: 18,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
};

const categories: Array<{ key: keyof Omit<PasswordGeneratorRequest, "length">; label: string; sample: string }> = [
  { key: "uppercase", label: "Uppercase", sample: "A–Z" },
  { key: "lowercase", label: "Lowercase", sample: "a–z" },
  { key: "numbers", label: "Numbers", sample: "0–9" },
  { key: "symbols", label: "Symbols", sample: "!@#" },
];

export function GeneratorScreen() {
  const { reportError } = useVault();
  const { success } = useToast();
  const [options, setOptions] = useState<PasswordGeneratorRequest>(initialOptions);
  const [generated, setGenerated] = useState("");
  const [busy, setBusy] = useState(false);

  const enabledCount = categories.filter(({ key }) => options[key]).length;

  async function generate() {
    if (enabledCount === 0 || options.length < enabledCount) return;
    setBusy(true);
    try {
      setGenerated(await api.generatePassword(options));
    } catch (error: unknown) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(generated);
      success("Generated password copied to clipboard.");
    } catch {
      reportError(new Error("Could not copy to the clipboard."));
    }
  }

  return (
    <>
      <SectionHeading
        description="Create a strong password locally through the encrypted backend, then copy it into an account when you are ready."
        eyebrow="Password tools"
        title="Generate with confidence."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card sm:p-8">
          <div className="mb-8 flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ocean-100 text-ocean-700">
              <Sparkles size={21} strokeWidth={1.7} />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-ink-900">Password recipe</h2>
              <p className="mt-1.5 text-sm leading-6 text-ink-500">Choose the ingredients and let V-Vault do the rest.</p>
            </div>
          </div>

          <div className="space-y-7">
            <TextField
              label="Length"
              max={512}
              min={1}
              onChange={(event) =>
                setOptions((current) => ({ ...current, length: Number(event.target.value) || 1 }))
              }
              type="number"
              value={options.length}
            />
            <div>
              <p className="mb-3 text-sm font-semibold text-ink-800">Include character types</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {categories.map(({ key, label, sample }) => {
                  const checked = options[key];
                  return (
                    <label
                      className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 transition ${
                        checked ? "border-ocean-300 bg-ocean-50" : "border-ink-200 bg-white"
                      }`}
                      key={key}
                    >
                      <span>
                        <span className="block text-sm font-semibold text-ink-800">{label}</span>
                        <span className="mt-0.5 block text-xs text-ink-400">{sample}</span>
                      </span>
                      <span className="relative">
                        <input
                          checked={checked}
                          className="peer sr-only"
                          onChange={(event) =>
                            setOptions((current) => ({ ...current, [key]: event.target.checked }))
                          }
                          type="checkbox"
                        />
                        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-ink-300 text-transparent transition peer-checked:border-ocean-600 peer-checked:bg-ocean-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-ocean-300">
                          <Check size={15} strokeWidth={3} />
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <Button
              className="w-full"
              disabled={busy || enabledCount === 0 || options.length < enabledCount}
              onClick={() => void generate()}
              size="lg"
            >
              <RefreshCw size={17} />
              {busy ? "Generating…" : generated ? "Generate another" : "Generate password"}
            </Button>
            {enabledCount === 0 ? (
              <p className="-mt-4 text-xs text-red-600">Enable at least one character type.</p>
            ) : options.length < enabledCount ? (
              <p className="-mt-4 text-xs text-red-600">Length must fit every selected character type.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-ocean-200 bg-ocean-900 p-5 text-white shadow-card sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-ocean-300">Generated password</p>
          <div className="mt-6 flex min-h-32 items-center rounded-2xl border border-ocean-700 bg-ocean-800/70 px-5 py-6">
            <code className="w-full break-all text-lg leading-8 text-ocean-50">
              {generated || "Your new password will appear here."}
            </code>
          </div>
          <div className="mt-4 flex gap-3">
            <Button
              className="flex-1 border-ocean-600 bg-ocean-800 text-white hover:bg-ocean-700"
              disabled={!generated}
              onClick={() => void copyPassword()}
              variant="secondary"
            >
              <Copy size={16} />
              Copy password
            </Button>
          </div>
          <p className="mt-8 text-xs leading-5 text-ocean-200/70">
            Generated values are kept in this page's memory only. Locking the vault clears the active frontend state.
          </p>
        </section>
      </div>
    </>
  );
}
