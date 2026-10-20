import { useCallback } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppShell, BootScreen } from "./components/Layout";
import { AccountDetailScreen } from "./screens/AccountDetailScreen";
import { CardDetailScreen } from "./screens/CardDetailScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { GeneratorScreen } from "./screens/GeneratorScreen";
import { LockScreen } from "./screens/LockScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { ActivityScreen } from "./screens/ActivityScreen";
import { ImportScreen } from "./screens/ImportScreen";
import { RecycleBinScreen } from "./screens/RecycleBinScreen";
import { ToastProvider } from "./state/ToastContext";
import { useVault, VaultProvider } from "./state/VaultContext";
import { useIdleLock } from "./hooks/useIdleLock";
import { ThemeProvider } from "./state/ThemeContext";

function StageRedirect() {
  const { stage } = useVault();
  if (stage === "setup") return <Navigate replace to="/setup" />;
  if (stage === "locked") return <Navigate replace to="/unlock" />;
  return <Navigate replace to="/" />;
}

function ReadyRoutes() {
  const { stage } = useVault();
  if (stage !== "ready") return <StageRedirect />;
  return <Outlet />;
}

function RouterContent() {
  const { stage, lockVault } = useVault();

  const handleIdle = useCallback(() => {
    void lockVault("idle");
  }, [lockVault]);
  useIdleLock(stage === "ready", handleIdle);

  if (stage === "boot") return <BootScreen />;

  return (
    <Routes>
      <Route element={stage === "setup" ? <SetupScreen /> : <StageRedirect />} path="/setup" />
      <Route element={stage === "locked" ? <LockScreen /> : <StageRedirect />} path="/unlock" />
      <Route element={<ReadyRoutes />}>
        <Route element={<AppShell />}>
          <Route element={<DashboardScreen />} index />
          <Route element={<GeneratorScreen />} path="/generator" />
          <Route element={<RecycleBinScreen />} path="/recycle-bin" />
          <Route element={<ActivityScreen />} path="/activity" />
          <Route element={<ImportScreen />} path="/import" />
          <Route element={<CardDetailScreen />} path="/vault/:cardId" />
          <Route element={<AccountDetailScreen />} path="/vault/:cardId/account/:accountId" />
        </Route>
      </Route>
      <Route element={<StageRedirect />} path="*" />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <VaultProvider>
            <RouterContent />
          </VaultProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
