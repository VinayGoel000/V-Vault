import { CheckCircle2, FileUp, ShieldAlert } from "lucide-react";
import { useRef, useState } from "react";
import { Button, EmptyState, SectionHeading } from "../components/ui";
import { api } from "../api/client";
import { useToast } from "../state/ToastContext";
import { useVault } from "../state/VaultContext";
import type { ImportCommitResult, ImportPreview } from "../api/types";

export function ImportScreen() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { reportError, refreshCards } = useVault();
  const { success } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [warning, setWarning] = useState(false);
  const [busy, setBusy] = useState(false);

  function chooseFile(selected: File | null) {
    if (!selected) return;
    setFile(selected);
    setPreview(null);
    setResult(null);
    setWarning(true);
  }

  async function showPreview() {
    if (!file) return;
    setBusy(true);
    try {
      setPreview(await api.previewImport(file));
      setWarning(false);
    } catch (error: unknown) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!file || !preview) return;
    setBusy(true);
    try {
      const next = await api.commitImport(file, preview.previewId);
      setResult(next);
      setPreview(null);
      await refreshCards();
      success("Import completed.");
    } catch (error: unknown) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  }

  const rows = preview?.preview ?? [];
  const skipped = result?.skipped ?? 0;

  return (
    <>
      <SectionHeading description="Bring passwords in from Chrome or Bitwarden without writing the CSV to disk." eyebrow="Migration" title="Import passwords" />
      <div className="space-y-5">
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card sm:p-7">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="font-display text-xl font-bold text-ink-900">Choose a CSV file</p>
              <p className="mt-2 text-sm text-ink-500">The format is detected from the header row. Maximum size: 5 MB.</p>
            </div>
            <Button onClick={() => inputRef.current?.click()} variant="secondary">
              <FileUp size={17} /> {file ? "Choose another CSV" : "Choose CSV"}
            </Button>
            <input accept=".csv,text/csv" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} ref={inputRef} type="file" />
          </div>
          {file ? <p className="mt-4 text-xs font-medium text-ink-500">Selected: {file.name}</p> : null}
        </section>

        {warning ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-card sm:p-7">
            <div className="flex gap-3">
              <ShieldAlert className="mt-0.5 shrink-0" size={20} />
              <div>
                <p className="font-semibold">This CSV file is not protected — delete it after importing.</p>
                <Button className="mt-4" disabled={busy} onClick={() => void showPreview()} size="sm">{busy ? "Reading…" : "Continue to preview"}</Button>
              </div>
            </div>
          </section>
        ) : null}

        {preview ? (
          <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">{preview.format}</p>
                <h2 className="mt-2 font-display text-xl font-bold text-ink-900">Preview import</h2>
                <p className="mt-2 text-sm text-ink-500">{preview.totalRows} rows · {preview.validRows} valid · {preview.skippedRows} skipped</p>
              </div>
              <Button className="w-full sm:w-auto" disabled={busy || preview.validRows === 0} onClick={() => void commit()} size="lg">{busy ? "Importing…" : "Import"}</Button>
            </div>
            <div className="mt-5 overflow-x-auto rounded-xl border border-ink-100">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-ink-50 text-xs uppercase tracking-[0.12em] text-ink-400"><tr><th className="px-4 py-3">Card</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Username</th><th className="px-4 py-3">Password</th><th className="px-4 py-3">Status</th></tr></thead>
                <tbody className="divide-y divide-ink-100">{rows.map((row) => <tr key={row.row}><td className="px-4 py-3 font-medium text-ink-800">{row.cardName}</td><td className="px-4 py-3 text-ink-600">{row.email}</td><td className="px-4 py-3 text-ink-600">{row.username || "—"}</td><td className="px-4 py-3 font-mono text-ink-500">{row.password}</td><td className="px-4 py-3 text-xs font-semibold">{row.error || (row.duplicate ? "Duplicate" : "Ready")}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        ) : null}

        {result ? (
          <section className="rounded-2xl border border-ocean-200 bg-ocean-50 p-6 shadow-card">
            <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 text-ocean-700" size={22} /><div><h2 className="font-display text-xl font-bold text-ink-900">Import complete</h2><p className="mt-2 text-sm text-ink-700">Imported {result.imported} accounts and skipped {skipped} rows.</p></div></div>
          </section>
        ) : null}
        {!file && !preview && !result ? <EmptyState description="Select a Chrome or Bitwarden CSV to see a masked preview before anything is imported." title="No CSV selected" /> : null}
      </div>
    </>
  );
}
