import { Activity, KeyRound, LockKeyhole, Palette, Recycle, Settings, Sparkles, Upload, Vault as VaultIcon } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { cn } from "./ui";
import { useVault } from "../state/VaultContext";
import { themes, useTheme } from "../state/ThemeContext";

function Brand({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", compact && "gap-2.5")}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl font-display text-sm font-extrabold text-white shadow-sm" style={{ backgroundColor: "var(--accent-dark)" }}>
        V
      </span>
      <span className={cn("font-display text-lg font-bold tracking-tight", light ? "text-white" : "text-ink-900")}>V-Vault</span>
    </div>
  );
}

function NavigationLink({
  to,
  label,
  icon: Icon,
  dark = false,
}: {
  to: string;
  label: string;
  icon: typeof VaultIcon;
  dark?: boolean;
}) {
  return (
    <NavLink
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition",
          dark
            ? isActive
              ? "bg-white/20 text-white"
              : "text-teal-50 hover:bg-white/15 hover:text-white"
            : isActive
              ? "bg-ocean-100 text-ocean-800"
              : "text-ink-500 hover:bg-ink-50 hover:text-ink-800",
        )
      }
      to={to}
    >
      <Icon size={18} strokeWidth={1.8} />
      {label}
    </NavLink>
  );
}

export function AppShell() {
  const { lockVault } = useVault();
  const navigate = useNavigate();
  const location = useLocation();
  const { themeName, setTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function handleLock() {
    await lockVault();
    navigate("/unlock", { replace: true });
  }

  return (
    <div className="theme-page min-h-screen text-ink-900" style={{ backgroundColor: "var(--bg)" }}>
      <header className="text-white shadow-sm" style={{ backgroundColor: "var(--header)", color: "var(--header-text)" }}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
          <Brand compact light />
          <nav className="flex flex-wrap items-center gap-1 rounded-xl bg-white/10 p-1">
            <NavigationLink dark icon={VaultIcon} label="Vault" to="/" />
            <NavigationLink dark icon={Sparkles} label="Generator" to="/generator" />
            <NavigationLink dark icon={Recycle} label="Recycle Bin" to="/recycle-bin" />
            <NavigationLink dark icon={Activity} label="Activity" to="/activity" />
            <NavigationLink dark icon={Upload} label="Import" to="/import" />
          </nav>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 text-xs font-semibold text-teal-50 sm:flex">
              <span className="h-2 w-2 rounded-full bg-teal-200" />
              Auto-lock: 5 min idle
            </div>
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/25 px-3.5 text-sm font-semibold text-white transition hover:bg-white/15"
              onClick={() => void handleLock()}
              type="button"
            >
              <LockKeyhole size={17} strokeWidth={1.8} />
              <span className="hidden sm:inline">Lock vault</span>
              <span className="sm:hidden">Lock</span>
            </button>
            <div className="relative">
              <button
                aria-label="Theme settings"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/25 px-3 text-sm font-semibold text-white transition hover:bg-white/15"
                onClick={() => setSettingsOpen((current) => !current)}
                type="button"
              >
                <Settings size={17} />
                <span className="hidden lg:inline">Settings</span>
              </button>
              {settingsOpen ? (
                <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-ink-100 bg-white p-3 text-ink-900 shadow-soft">
                  <div className="mb-2 flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-400">
                    <Palette size={14} /> Theme
                  </div>
                  {themes.map((option) => (
                    <button
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-semibold transition",
                        themeName === option.name ? "bg-ink-100 text-ink-900" : "hover:bg-ink-50",
                      )}
                      key={option.name}
                      onClick={() => {
                        setTheme(option.name);
                        setSettingsOpen(false);
                      }}
                      type="button"
                    >
                      <span className="h-5 w-5 rounded-full border border-black/10" style={{ background: `linear-gradient(135deg, ${option.header} 50%, ${option.accent} 50%)` }} />
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto min-h-[calc(100vh-73px)] max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
        <div className="mb-8 flex items-center justify-between">
          <p className="text-xs font-semibold text-ink-500">
            {location.pathname.startsWith("/generator") ? "Tools / Generator" : location.pathname.startsWith("/activity") ? "Audit / Activity" : location.pathname.startsWith("/recycle-bin") ? "Vault / Recycle Bin" : location.pathname.startsWith("/import") ? "Vault / Import" : "Your private space"}
          </p>
          <p className="text-xs font-medium text-ink-400">Secrets stay in memory</p>
        </div>
        <Outlet />
      </main>
    </div>
  );
}

export function AuthBrand() {
  return (
    <div className="flex items-center justify-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ocean-700 font-display text-base font-extrabold text-white shadow-sm">
        V
      </span>
      <span className="font-display text-xl font-bold tracking-tight text-ink-900">V-Vault</span>
    </div>
  );
}

export function AuthAside({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="relative hidden overflow-hidden bg-ocean-900 px-12 py-12 text-white lg:flex lg:w-[43%] lg:flex-col lg:justify-between">
      <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full border-[38px] border-ocean-700/40" />
      <div className="absolute -bottom-40 -left-28 h-96 w-96 rounded-full border-[52px] border-ocean-800/70" />
      <div className="relative">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ocean-400 font-display text-base font-extrabold text-ocean-900">
            V
          </span>
          <span className="font-display text-xl font-bold">V-Vault</span>
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-ocean-300">Private by default</p>
      </div>
      <div className="relative max-w-sm">
        <p className="mb-4 text-sm font-semibold text-ocean-300">A quieter way to keep secrets.</p>
        <h2 className="font-display text-4xl font-bold leading-tight tracking-tight">{title}</h2>
        <p className="mt-5 text-sm leading-7 text-ocean-100/75">{description}</p>
      </div>
      <p className="relative text-xs text-ocean-200/60">Local-only storage · encrypted at rest</p>
    </div>
  );
}

export function BootScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#ecfdf9]">
      <div className="text-center">
        <KeyRound className="mx-auto animate-pulse text-ocean-600" size={28} strokeWidth={1.7} />
        <p className="mt-4 text-sm font-semibold text-ink-500">Opening V-Vault…</p>
      </div>
    </div>
  );
}
